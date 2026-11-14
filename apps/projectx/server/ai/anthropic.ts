import Anthropic from '@anthropic-ai/sdk';
import { applyPatch, isReady, type Booking, type Lang } from '../../src/models/booking';
import { BOOKING_PATCH_SCHEMA, bookingContext, SYSTEM_PROMPT, TRIP_PROMPT, type Patch } from '../../src/ai/prompt';
import { detectLang } from '../../src/ai/providers/demo/nlu';
import type { AssistantRequest, AssistantResponse, ChatMsg } from '../../src/ai/types';
import type { ServerAI } from './provider';
import { SCAN_PROMPT } from '../../src/ai/vision';

/**
 * Real AI: Claude through the official Anthropic SDK, on the server only (the API key never reaches
 * the browser). One customer turn = a short tool-use loop: Claude updates the structured booking
 * through tools, sees what is still missing, then writes its reply.
 */

const COLLECT_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'update_booking', description: 'Merge newly learned or corrected details into the transport request. Send only changed fields.', input_schema: BOOKING_PATCH_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema },
  { name: 'suggest_replies', description: 'Offer 2–4 short tap-able answers (customer language) for your question.', input_schema: { type: 'object', properties: { replies: { type: 'array', items: { type: 'string' }, maxItems: 4 } }, required: ['replies'] } },
  { name: 'request_review', description: 'The request is complete: show the customer the review card before searching for transport.', input_schema: { type: 'object', properties: {} } },
];
const TRIP_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'send_driver_note', description: 'Forward an instruction or message to the driver and add it to the pickup instructions.', input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } },
  { name: 'request_support', description: 'Open a support request for this booking.', input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } },
  { name: 'start_new_booking', description: 'The customer wants to book another transport.', input_schema: { type: 'object', properties: {} } },
  COLLECT_TOOLS[1],
];

const MAX_IMAGES = 4;

/** Chat history → Claude messages (alternating roles, images only on the most recent photo messages). */
function toMessages(msgs: ChatMsg[], context: string): Anthropic.Beta.BetaMessageParam[] {
  const withImages = new Set(msgs.filter((m) => m.role === 'user' && m.images?.length).slice(-2).map((m) => m.id));
  let imageBudget = MAX_IMAGES;
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of msgs) {
    if (m.role === 'system') continue;
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (m.role === 'user' && m.images?.length && withImages.has(m.id)) {
      for (const img of m.images) {
        const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(img.dataUrl);
        if (!match || imageBudget <= 0) continue;
        imageBudget--;
        blocks.push({ type: 'image', source: { type: 'base64', media_type: match[1] as 'image/jpeg', data: match[2] } });
      }
    }
    const text = m.text?.trim() || (m.images?.length ? '(photo of the cargo)' : '');
    if (text) blocks.push({ type: 'text', text });
    if (!blocks.length) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role && Array.isArray(prev.content)) prev.content.push(...blocks);
    else out.push({ role: m.role, content: blocks });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  const last = out[out.length - 1];
  if (!last || last.role !== 'user') out.push({ role: 'user', content: [{ type: 'text', text: '(continue)' }] });
  (out[out.length - 1].content as Anthropic.Beta.BetaContentBlockParam[]).push({ type: 'text', text: context });
  return out;
}

export class AnthropicAI implements ServerAI {
  readonly name = 'anthropic';
  private client: Anthropic;
  constructor(
    private model: string,
    private effort: 'low' | 'medium' | 'high',
  ) {
    this.client = new Anthropic();
  }

  /** Photo reading: one vision call, JSON answer. */
  async scan(images: string[]): Promise<unknown> {
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const d of images.slice(0, 4)) {
      const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(d);
      if (m) blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1] as 'image/jpeg', data: m[2] } });
    }
    if (!blocks.length) return { items: [] };
    blocks.push({ type: 'text', text: SCAN_PROMPT });
    const res = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: blocks }],
    });
    if (res.stop_reason === 'refusal') return { items: [] };
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    try {
      return json ? JSON.parse(json) : { items: [] };
    } catch {
      return { items: [] };
    }
  }

  async respond(req: AssistantRequest): Promise<AssistantResponse> {
    const trip = req.mode === 'trip' && req.trip;
    let booking: Booking = structuredClone(req.booking);
    let lang: Lang | null = null;
    let quick: string[] = [];
    let reviewRequested = false;
    let driverNote: string | null = null;
    let action: AssistantResponse['action'] = null;

    const context = trip
      ? `<context><now>${req.now}</now><trip>${JSON.stringify({ driver: trip.driverName, vehicle: trip.vehicle, price_mad: trip.price, status: trip.status, pickup_estimate: trip.pickupEta, delivery_estimate: trip.deliveryEta, gps_connected: trip.gpsConnected, instructions: trip.instructions })}</trip></context>`
      : bookingContext(booking, req.now);
    const messages = toMessages(req.messages, context);
    let finalText = '';

    for (let step = 0; step < 4; step++) {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 4000,
        system: trip ? TRIP_PROMPT : SYSTEM_PROMPT,
        tools: trip ? TRIP_TOOLS : COLLECT_TOOLS,
        output_config: { effort: this.effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages,
      });
      if (res.stop_reason === 'refusal') {
        finalText = '';
        break;
      }
      const texts = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text.trim()).filter(Boolean);
      if (texts.length) finalText = texts.join(' ');
      const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !uses.length) break;

      messages.push({ role: 'assistant', content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        const input = (u.input ?? {}) as Patch & { replies?: string[]; note?: string; reason?: string };
        let result = 'ok';
        if (u.name === 'update_booking') {
          if (typeof input.reply_lang === 'string' && ['darija', 'ar', 'fr', 'en'].includes(input.reply_lang)) lang = input.reply_lang as Lang;
          const { reply_lang: _l, asked, ...patch } = input;
          void _l;
          booking = applyPatch(booking, patch);
          if (Array.isArray(asked)) booking.meta.asked = [...new Set([...booking.meta.asked, ...asked.filter((a) => typeof a === 'string')])];
          result = bookingContext(booking, req.now);
        } else if (u.name === 'suggest_replies') {
          quick = (input.replies ?? []).filter((r) => typeof r === 'string').slice(0, 4);
        } else if (u.name === 'request_review') {
          reviewRequested = true;
          result = isReady(booking) ? 'Review card will be shown. Now tell the customer briefly.' : `Not ready yet. ${bookingContext(booking, req.now)}`;
        } else if (u.name === 'send_driver_note' && typeof input.note === 'string') {
          driverNote = input.note.slice(0, 400);
          booking.instructions = [booking.instructions, driverNote].filter(Boolean).join(' · ');
        } else if (u.name === 'request_support') action = 'support';
        else if (u.name === 'start_new_booking') action = 'new_booking';
        results.push({ type: 'tool_result', tool_use_id: u.id, content: result });
      }
      messages.push({ role: 'user', content: results });
    }

    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const replyLang = lang ?? detectLang(finalText || lastUser?.text || '', req.lang);
    if (!finalText) {
      finalText = replyLang === 'fr' ? 'Désolé, je n’ai pas pu traiter ce message. Pouvez-vous reformuler ?' : replyLang === 'en' ? 'Sorry, I couldn’t handle that message. Could you rephrase it?' : 'سمح ليا، ما قدرتش نعالج هاد الرسالة. عاود صيغها عافاك.';
    }
    const ready = !trip && isReady(booking) && (reviewRequested || booking.meta.review_requested);
    if (ready) booking.meta.review_requested = true;
    return { reply: finalText, lang: replyLang, booking, quickReplies: quick, ready, source: 'claude-server', driverNote, action };
  }
}
