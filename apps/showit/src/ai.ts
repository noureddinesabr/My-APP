import Anthropic from '@anthropic-ai/sdk';

import { GOODS, NOTE_TAGS, type Goods, type NoteTag } from './choices';
import type { Lang } from './i18n';
import { bestFit, VEHICLES, type VehicleId } from './vehicles';

export type Draft = {
  goods: Goods | '';
  load: string;
  weightKg: number;
  vehicle: VehicleId;
  from: string;
  to: string;
  /** 'now' or a local time "YYYY-MM-DDTHH:mm". */
  when: string;
  price: number;
  fairMin: number;
  fairMax: number;
  km: number;
  noteTags: NoteTag[];
  notes: string;
  helpers: number;
  rideAlong: boolean;
};

export class AiError extends Error {
  constructor(
    public code: 'no_key' | 'bad_key' | 'busy' | 'offline' | 'unclear' | 'declined',
    message: string,
  ) {
    super(message);
  }
}

const ids = VEHICLES.map((v) => `"${v.id}" (${v.name}, ${v.carries.toLowerCase()})`).join(', ');
const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
const pad = (n: number) => String(n).padStart(2, '0');

/** `current` is the card the customer already has, when they ask for a correction. */
function prompt(said: string, hasPhoto: boolean, lang: Lang, current?: Draft) {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const intro = current
    ? `A customer in Morocco already has this booking card for moving goods:\n${JSON.stringify(current)}\nThey now give a correction (it may be Moroccan Darija in Arabic or Latin letters, Arabic, French or English):\n"""${said.slice(0, 1500)}"""\nApply the correction and keep everything else as it is.`
    : `You turn a customer's request to move goods in Morocco into a booking card for drivers.\nWhat the customer said (it may be Moroccan Darija in Arabic or Latin letters, Arabic, French or English; it may be empty):\n"""${said.slice(0, 1500)}"""\n${hasPhoto ? 'The attached photo shows the load: use it to recognise the goods and estimate their weight.' : 'There is no photo.'}`;
  return `${intro}
The time now is ${today} (local time in Morocco).
Reply with only one JSON object and nothing else. Write "load" and "notes" in ${LANG_NAME[lang]}. Place names stay as the customer named them.
{"goods": one of ${GOODS.map((g) => `"${g}"`).join(', ')} or "" if unknown,
 "load": "short description of the goods, e.g. Fridge + 3-seat sofa",
 "weightKg": estimated total weight as a number (0 if no idea),
 "vehicle": the best vehicle id, one of ${ids},
 "from": "pickup neighbourhood and city, or empty string if not said",
 "to": "drop-off neighbourhood and city, or empty string if not said",
 "when": "now" or the pickup time as "YYYY-MM-DDTHH:mm" (e.g. tomorrow morning = tomorrow at 09:00),
 "priceDh": the price the customer offered in dirhams as a number, or null,
 "fairMin": low end of a fair cash price in dirhams for this trip and vehicle in Morocco,
 "fairMax": high end of that fair price,
 "km": estimated road distance in km as a number (0 if the places are unknown),
 "noteTags": the ones that apply among ${NOTE_TAGS.map((n) => `"${n}"`).join(', ')} (lift = there is a lift, noLift = no lift, ground = ground floor, upstairs = an upper floor, heavy = very heavy items, narrow = narrow street, strap = bring straps),
 "notes": "anything else the driver should know that the tags do not say, or empty string",
 "helpers": number of helpers asked for (0 if not said),
 "rideAlong": true if the customer travels with the goods}`;
}

function parse(text: string): Draft {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('unclear', 'No JSON in the answer');
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError('unclear', 'The answer was not valid JSON');
  }
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const weightKg = num(raw.weightKg);
  const vehicle = VEHICLES.some((v) => v.id === raw.vehicle) ? (raw.vehicle as VehicleId) : bestFit(weightKg || 300);
  const fairMin = num(raw.fairMin);
  const fairMax = Math.max(fairMin, num(raw.fairMax));
  const mid = fairMin && fairMax ? Math.round((fairMin + fairMax) / 20) * 10 : 300;
  const when = str(raw.when);
  const goods = (GOODS as readonly string[]).includes(str(raw.goods)) ? (str(raw.goods) as Goods) : '';
  const tags = Array.isArray(raw.noteTags) ? raw.noteTags.filter((x): x is NoteTag => (NOTE_TAGS as readonly string[]).includes(String(x))) : [];
  return {
    goods,
    load: str(raw.load),
    weightKg,
    vehicle,
    from: str(raw.from),
    to: str(raw.to),
    when: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? when : 'now',
    price: Math.max(20, num(raw.priceDh) || mid),
    fairMin,
    fairMax,
    km: num(raw.km),
    noteTags: tags,
    notes: str(raw.notes),
    helpers: Math.min(4, num(raw.helpers)),
    rideAlong: raw.rideAlong === true,
  };
}

// ---- In the claude.ai browser preview, the page can ask Claude itself (the viewer's own account). ----
type PreviewSample = {
  json: (input: string, options?: { images?: Blob; modelTier?: 'quick' | 'default' | 'complex' }) => Promise<unknown>;
  limits: () => Promise<{ images?: unknown }>;
};
let preview: PreviewSample | null = null;
let previewImages = false;

/** Looks for the preview page's built-in Claude once at start-up (always absent in the phone app). */
export async function detectPreviewAi() {
  const runtime = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!runtime?.use) return;
  try {
    preview = (await runtime.use('sample')) as PreviewSample | null;
    if (preview) previewImages = !!(await preview.limits().catch(() => null))?.images;
  } catch {
    preview = null;
  }
}
export const previewAi = () => !!preview;

function base64ToBlob(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

async function fillCardInPreview(said: string, photoBase64: string | null, lang: Lang, current?: Draft): Promise<Draft> {
  const withPhoto = !!photoBase64 && previewImages && !current;
  try {
    const answer = await preview!.json(prompt(said, withPhoto, lang, current), { modelTier: 'quick', ...(withPhoto ? { images: base64ToBlob(photoBase64!) } : {}) });
    return parse(JSON.stringify(answer));
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'rate_limited') throw new AiError('busy', 'Rate limited');
    if (code === 'invalid_json') throw new AiError('unclear', 'Unclear answer');
    if (code === 'refused') throw new AiError('declined', 'Declined');
    if (code === 'not_granted' || code === 'sampling_disabled') {
      preview = null;
      throw new AiError('no_key', 'AI not allowed');
    }
    throw new AiError('offline', 'No connection');
  }
}

/**
 * Reads the photo and the customer's words and fills the booking card; with `current`,
 * applies the customer's spoken or typed correction to the card they already have.
 */
export async function fillCard(apiKey: string, said: string, photoBase64: string | null, lang: Lang, current?: Draft): Promise<Draft> {
  if (!apiKey.trim() && preview) return fillCardInPreview(said, photoBase64, lang, current);
  if (!apiKey.trim()) throw new AiError('no_key', 'No AI key set');
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const withPhoto = !!photoBase64 && !current;
  if (withPhoto) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64! } });
  content.push({ type: 'text', text: prompt(said, withPhoto, lang, current) });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('bad_key', 'The AI key was not accepted');
    }
    if (error instanceof Anthropic.RateLimitError) throw new AiError('busy', 'Rate limited');
    if (error instanceof Anthropic.APIConnectionError) throw new AiError('offline', 'No connection');
    if (error instanceof Anthropic.APIError) throw new AiError('busy', `API error ${error.status}`);
    throw new AiError('offline', 'Unknown error');
  }
  if (response.stop_reason === 'refusal') throw new AiError('declined', 'The AI declined this request');
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return parse(text);
}
