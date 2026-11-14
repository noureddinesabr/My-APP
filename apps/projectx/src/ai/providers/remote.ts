import { applyPatch, isReady, type Lang } from '../../models/booking';
import { host } from '../../lib/hostCapabilities';
import { bookingContext, SYSTEM_PROMPT, TRIP_PROMPT, type Patch } from '../prompt';
import type { AIProvider, AssistantRequest, AssistantResponse } from '../types';
import { detectLang } from './demo/nlu';

/** Real AI through the X server (`/api/assistant`, Claude with tool use; the key stays on the server). */
export class ServerProvider implements AIProvider {
  readonly source = 'claude-server' as const;
  async respond(req: AssistantRequest): Promise<AssistantResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ctrl.signal });
      if (!r.ok) throw new Error(`assistant ${r.status}`);
      return (await r.json()) as AssistantResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}

const b64ToBlob = (dataUrl: string) => {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: /data:(.*?);/.exec(head)?.[1] ?? 'image/jpeg' });
};

/**
 * Real AI when this app runs as a claude.ai preview page: the page's own Claude access (`sample`).
 * Same instructions as the server; one JSON answer per turn instead of a tool loop.
 */
export class ClaudePageProvider implements AIProvider {
  readonly source = 'claude-page' as const;
  async respond(req: AssistantRequest): Promise<AssistantResponse> {
    const sample = host.sample;
    if (!sample) throw new Error('no page AI');
    const trip = req.mode === 'trip' ? req.trip : undefined;
    const transcript = req.messages
      .filter((m) => m.role !== 'system')
      .slice(-24)
      .map((m) => `${m.role === 'user' ? 'Customer' : 'X'}: ${m.text || (m.images?.length ? `(sent ${m.images.length} photo${m.images.length > 1 ? 's' : ''})` : '')}`)
      .join('\n');
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const images = (lastUser?.images ?? []).slice(0, 4).map((i) => b64ToBlob(i.dataUrl));
    const context = trip
      ? `<trip>${JSON.stringify({ driver: trip.driverName, vehicle: trip.vehicle, price_mad: trip.price, status: trip.status, pickup_estimate: trip.pickupEta, delivery_estimate: trip.deliveryEta, gps_connected: trip.gpsConnected, instructions: trip.instructions })}</trip><now>${req.now}</now>`
      : bookingContext(req.booking, req.now);
    const format = trip
      ? `Answer with JSON only: {"reply": string, "reply_lang": "darija"|"ar"|"fr"|"en", "quick_replies": string[], "driver_note": string|null, "action": "support"|"new_booking"|null}`
      : `Answer with JSON only: {"reply": string, "reply_lang": "darija"|"ar"|"fr"|"en", "patch": object (only changed booking fields, same shape as booking_state; arrays replace; may include "asked": [optional topics you now asked]), "quick_replies": string[] (2-4), "request_review": boolean}`;
    const prompt = `${trip ? TRIP_PROMPT : SYSTEM_PROMPT}\n\nInstead of tools, put your booking changes in "patch".\n\n${context}\n\nConversation so far:\n${transcript}\n${images.length ? `\n(The customer's latest message includes ${images.length} photo(s), attached.)` : ''}\n\n${format}`;
    const out = (await sample.json(prompt, { ...(images.length ? { images } : {}), modelTier: 'default' })) as {
      reply?: string;
      reply_lang?: string;
      patch?: Patch;
      quick_replies?: string[];
      request_review?: boolean;
      driver_note?: string | null;
      action?: 'support' | 'new_booking' | null;
    };
    if (!out || typeof out.reply !== 'string') throw new Error('bad answer');
    const lang: Lang = (['darija', 'ar', 'fr', 'en'] as const).includes(out.reply_lang as Lang) ? (out.reply_lang as Lang) : detectLang(lastUser?.text ?? out.reply, req.lang);
    let booking = structuredClone(req.booking);
    if (!trip && out.patch && typeof out.patch === 'object') {
      const { asked, ...patch } = out.patch;
      booking = applyPatch(booking, patch);
      if (Array.isArray(asked)) booking.meta.asked = [...new Set([...booking.meta.asked, ...asked.filter((a): a is string => typeof a === 'string')])];
    }
    if (trip && out.driver_note) booking.instructions = [booking.instructions, out.driver_note].filter(Boolean).join(' · ');
    const ready = !trip && isReady(booking) && (!!out.request_review || booking.meta.review_requested);
    if (ready) booking.meta.review_requested = true;
    return {
      reply: out.reply,
      lang,
      booking,
      quickReplies: Array.isArray(out.quick_replies) ? out.quick_replies.filter((q) => typeof q === 'string').slice(0, 4) : [],
      ready,
      source: 'claude-page',
      driverNote: trip ? out.driver_note ?? null : null,
      action: trip ? out.action ?? null : null,
    };
  }
}
