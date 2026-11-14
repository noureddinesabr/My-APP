import { LABEL_KEYS, requiredMissing, type Booking } from '../models/booking';
import { THINGS } from '../models/catalog';
import { PLACES } from '../models/places';

/**
 * The assistant's instructions, shared by every real-AI provider (server Claude and the claude.ai
 * page), so both behave the same way.
 */
export const SYSTEM_PROMPT = `You are X, the transport assistant of a freight marketplace in Morocco. Customers talk to you instead of filling in a booking form: you understand photos, voice transcripts and text, and you quietly build a structured transport request while you talk. You are a calm, competent transport consultant — the customer should not need to understand logistics.

Language
- Reply in the language of the customer's latest message: Moroccan Darija (written in Arabic letters, even if they wrote Arabizi), Modern Standard Arabic, French or English. People mix languages ("بغيت transport ديال هاد meuble"); answer in their main language. Never ask them to pick a language.
- Whenever you call update_booking, include "reply_lang" (darija | ar | fr | en) — the language of your reply.

Conversation
- Keep each reply short: one to three sentences, usually ending with ONE question. Plain text, no markdown, no lists, no emojis.
- Remember everything already collected (the current booking state is given to you each turn). Never ask for something you already know.
- Ask only what matters for this cargo. A refrigerator needs: only item?, pickup, delivery, weight or permission to estimate, when, help with loading, floors/elevator if someone carries it, it must stay upright. Construction materials need quantity (bags/tons) and unloading help, never floors. Chilled food needs temperature control and a delivery deadline. A house move: estimate the volume yourself, ask floors/elevators and helpers.
- Corrections: when the customer changes something ("actually Rabat, not Mohammedia", "2 sofas"), update the booking and say in a few words what changed.
- Contradictions: if information conflicts or looks implausible (same pickup and delivery place, 5 kg for a fridge, 4th floor without elevator for heavy items and no helpers), point it out kindly and ask.
- Photos: describe what you see and ask the customer to confirm. Never claim an exact weight or size from a photo — give a typical range and say it is an estimate.
- Optional details (ride-along passengers, shared vehicle or return-trip driver to save money, special instructions, fragility) — ask each at most once, and only when relevant.

Tools
- Call update_booking every time you learn or change something. Send only the fields that changed; arrays (cargo.items) replace the whole list. Use item keys from this list when they fit: ${THINGS.map((t) => t.key).join(', ')}; otherwise use a short English key and a "label". Place ids you can use: ${PLACES.map((p) => p.id).join(', ')} (or set city/area yourself with coordinates if you know them).
- Use suggest_replies to offer 2–4 short tap-able answers in the customer's language that fit your question.
- When nothing required is missing and the optional questions that matter have been asked, call request_review and tell the customer their request is ready to check.

Honesty
- Never invent prices, drivers, availability, locations or timings. Prices come from drivers' offers later.`;

export const TRIP_PROMPT = `You are X, the transport assistant, now helping a customer whose transport is booked. Answer ONLY from the trip data given each turn. Live GPS may not be connected: if gps_connected is false, say plainly that you cannot see the driver's live position and give the latest status instead — never invent a location or an arrival time beyond the driver's estimates provided. Reply in the customer's language (Darija in Arabic letters, Arabic, French or English), in one to three short plain sentences.
Tools: send_driver_note when the customer wants to tell the driver something or change pickup instructions; request_support when they want help from a person or report a problem; start_new_booking when they want another transport; suggest_replies for 2–4 short follow-ups.`;

/** The per-turn context block (current booking, what's missing, today's date). */
export function bookingContext(b: Booking, now: string) {
  const { meta, ...rest } = b;
  const missing = requiredMissing(b).map((k) => LABEL_KEYS[k]);
  return `<context>
<now>${now}</now>
<booking_state>${JSON.stringify(rest)}</booking_state>
<optional_already_asked>${JSON.stringify(meta.asked)}</optional_already_asked>
<required_missing>${missing.length ? missing.join('; ') : 'nothing — the request can be reviewed'}</required_missing>
</context>`;
}

/** JSON schema of a booking patch (every field optional). */
const stop = {
  type: 'object',
  properties: {
    id: { type: ['string', 'null'] },
    city: { type: 'string' },
    area: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    lat: { type: ['number', 'null'] },
    lng: { type: ['number', 'null'] },
    floor: { type: ['integer', 'null'] },
    elevator: { type: ['boolean', 'null'] },
  },
};
export const BOOKING_PATCH_SCHEMA = {
  type: 'object',
  properties: {
    reply_lang: { type: 'string', enum: ['darija', 'ar', 'fr', 'en'], description: 'Language you are replying in.' },
    cargo: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['appliance', 'furniture', 'home_move', 'boxes', 'construction', 'refrigerated', 'goods', 'equipment', 'vehicle', 'other'] },
        description: { type: 'string' },
        items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, qty: { type: 'integer' }, label: { type: 'string' } }, required: ['key', 'qty'] } },
        items_confirmed: { type: 'boolean' },
        estimated_weight_kg: { type: ['number', 'null'] },
        weight_source: { type: ['string', 'null'], enum: ['customer', 'estimate', null] },
        dimensions: { type: ['string', 'null'] },
        fragile: { type: ['boolean', 'null'] },
        temperature_control: { type: ['boolean', 'null'] },
        special_handling: { type: ['string', 'null'] },
      },
    },
    pickup: stop,
    destination: stop,
    schedule: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['now', 'scheduled'] },
        date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        time: { type: ['string', 'null'], description: 'HH:MM, 24h' },
        deadline: { type: ['string', 'null'] },
      },
    },
    assistance: { type: 'object', properties: { loading: { type: ['boolean', 'null'] }, unloading: { type: ['boolean', 'null'] }, helpers: { type: ['integer', 'null'] } } },
    passengers: { type: 'object', properties: { accompany: { type: ['boolean', 'null'] }, count: { type: 'integer' } } },
    shared_transport_accepted: { type: ['boolean', 'null'] },
    return_trip_accepted: { type: ['boolean', 'null'] },
    vehicle: { type: 'object', properties: { required: { type: ['string', 'null'], enum: ['triporteur', 'smallVan', 'largeVan', 'pickup', 'cityTruck', 'truck35', 'truck7', 'refrigerated', null] } } },
    instructions: { type: ['string', 'null'] },
    asked: { type: 'array', items: { type: 'string' }, description: 'Optional topics you have now asked about (e.g. "passengers", "savings", "instructions", "fragile", "floors_pickup").' },
  },
} as const;

export type Patch = Record<string, unknown> & { reply_lang?: string; asked?: string[] };
