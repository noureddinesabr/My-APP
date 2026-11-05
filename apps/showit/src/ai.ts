import Anthropic from '@anthropic-ai/sdk';

import { bestFit, VEHICLES, type VehicleId } from './vehicles';

export type Draft = {
  load: string;
  weightKg: number;
  vehicle: VehicleId;
  from: string;
  to: string;
  when: string;
  price: number;
  fairMin: number;
  fairMax: number;
  km: number;
  notes: string;
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

function prompt(said: string, hasPhoto: boolean) {
  return `You turn a customer's request to move goods in Morocco into a booking card for drivers.
What the customer said (it may be Moroccan Darija in Arabic or Latin letters, Arabic, French or English; it may be empty):
"""${said.slice(0, 1500)}"""
${hasPhoto ? 'The attached photo shows the load: use it to name the goods and estimate their weight.' : 'There is no photo.'}
Reply with only one JSON object and nothing else. Text values are short plain English, except place names, which stay as the customer named them, written in Latin letters.
{"load": "what the goods are, e.g. Fridge + 3-seat sofa",
 "weightKg": estimated total weight as a number,
 "vehicle": the best vehicle id, one of ${ids},
 "from": "pickup neighbourhood and city, or empty string if not said",
 "to": "drop-off neighbourhood and city, or empty string if not said",
 "when": "e.g. Now, Today 16:00, Tomorrow 08:00-10:00",
 "priceDh": the price the customer offered in dirhams as a number, or null,
 "fairMin": low end of a fair cash price in dirhams for this trip and vehicle in Morocco,
 "fairMax": high end of that fair price,
 "km": estimated road distance in km as a number (0 if the places are unknown),
 "notes": "anything else the driver should know (floor, lift, fragile, helpers), or empty string"}`;
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
  return {
    load: str(raw.load),
    weightKg,
    vehicle,
    from: str(raw.from),
    to: str(raw.to),
    when: str(raw.when) || 'Now',
    price: Math.max(20, num(raw.priceDh) || mid),
    fairMin,
    fairMax,
    km: num(raw.km),
    notes: str(raw.notes),
  };
}

/** Reads the photo and the customer's words and fills the booking card. */
export async function fillCard(apiKey: string, said: string, photoBase64: string | null): Promise<Draft> {
  if (!apiKey.trim()) throw new AiError('no_key', 'No AI key set');
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (photoBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } });
  content.push({ type: 'text', text: prompt(said, !!photoBase64) });

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
