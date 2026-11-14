/**
 * The structured transport request that the assistant fills in while the customer talks.
 * Shared by the web app, every AI provider and the server, so nothing is ever lost between turns.
 */

export type Lang = 'darija' | 'ar' | 'fr' | 'en';
export type UiLang = 'en' | 'fr' | 'ar';
export const uiLangOf = (l: Lang): UiLang => (l === 'darija' || l === 'ar' ? 'ar' : l);

export type Category = 'appliance' | 'furniture' | 'home_move' | 'boxes' | 'construction' | 'refrigerated' | 'goods' | 'equipment' | 'vehicle' | 'other';
export type VehicleType = 'triporteur' | 'smallVan' | 'largeVan' | 'pickup' | 'cityTruck' | 'truck35' | 'truck7' | 'refrigerated';

export type CargoItem = { key: string; qty: number; label?: string };
export type Place = { id: string | null; city: string; area: string | null; address: string | null; lat: number | null; lng: number | null };
export type Stop = Place & { floor: number | null; elevator: boolean | null };

export type Booking = {
  cargo: {
    category: Category | null;
    description: string | null;
    items: CargoItem[];
    items_confirmed: boolean;
    estimated_weight_kg: number | null;
    weight_source: 'customer' | 'estimate' | null;
    dimensions: string | null;
    fragile: boolean | null;
    temperature_control: boolean | null;
    special_handling: string | null;
    images: string[];
  };
  pickup: Stop | null;
  destination: Stop | null;
  schedule: { mode: 'now' | 'scheduled' | null; date: string | null; time: string | null; deadline: string | null };
  assistance: { loading: boolean | null; unloading: boolean | null; helpers: number | null };
  passengers: { accompany: boolean | null; count: number };
  shared_transport_accepted: boolean | null;
  return_trip_accepted: boolean | null;
  vehicle: { required: VehicleType | null; suggested: VehicleType | null };
  instructions: string | null;
  /** Conversation bookkeeping: which optional questions were already asked (never asked twice). */
  meta: { asked: string[]; pending: string | null; review_requested: boolean };
};

export const emptyBooking = (): Booking => ({
  cargo: { category: null, description: null, items: [], items_confirmed: false, estimated_weight_kg: null, weight_source: null, dimensions: null, fragile: null, temperature_control: null, special_handling: null, images: [] },
  pickup: null,
  destination: null,
  schedule: { mode: null, date: null, time: null, deadline: null },
  assistance: { loading: null, unloading: null, helpers: null },
  passengers: { accompany: null, count: 0 },
  shared_transport_accepted: null,
  return_trip_accepted: null,
  vehicle: { required: null, suggested: null },
  instructions: null,
  meta: { asked: [], pending: null, review_requested: false },
});

export const emptyStop = (city: string): Stop => ({ id: null, city, area: null, address: null, lat: null, lng: null, floor: null, elevator: null });

// ---------------------------------------------------------------- patching

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Applies a partial update (from any AI provider) onto a booking. Unknown keys and wrong types are
 * ignored, so a model can never corrupt the booking. Arrays (items, images) replace the old array.
 */
export function applyPatch(b: Booking, patch: unknown): Booking {
  const out = structuredClone(b) as unknown as Record<string, Json>;
  const walk = (target: Record<string, Json>, p: Record<string, unknown>, template: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(p)) {
      if (!(k in template)) continue;
      const t = template[k];
      if (k === 'pickup' || k === 'destination') {
        if (v === null) target[k] = null;
        else if (isObj(v)) {
          const base = (isObj(target[k]) ? target[k] : emptyStop(typeof v.city === 'string' ? v.city : '')) as Record<string, Json>;
          walk(base, v, emptyStop('') as unknown as Record<string, unknown>);
          if (typeof base.city === 'string' && base.city.trim()) target[k] = base;
        }
        continue;
      }
      if (k === 'items' && Array.isArray(v)) {
        target[k] = v
          .filter((x) => isObj(x) && typeof x.key === 'string' && x.key)
          .map((x) => {
            const r = x as Record<string, unknown>;
            const it: Record<string, Json> = { key: String(r.key).slice(0, 60), qty: Math.max(1, Math.min(999, Math.round(Number(r.qty) || 1))) };
            if (typeof r.label === 'string' && r.label.trim()) it.label = r.label.trim().slice(0, 80);
            return it;
          })
          .slice(0, 40);
        continue;
      }
      if ((k === 'images' || k === 'asked') && Array.isArray(v)) {
        target[k] = v.filter((x) => typeof x === 'string').slice(0, 40) as Json[];
        continue;
      }
      if (isObj(t) && isObj(v)) {
        if (!isObj(target[k])) target[k] = structuredClone(t) as Json;
        walk(target[k] as Record<string, Json>, v, t);
        continue;
      }
      if (v === null) {
        target[k] = null;
        continue;
      }
      const sample = t;
      if (typeof v === 'boolean' && (typeof sample === 'boolean' || sample === null)) target[k] = v;
      else if (typeof v === 'number' && Number.isFinite(v) && (typeof sample === 'number' || sample === null)) target[k] = v;
      else if (typeof v === 'string' && (typeof sample === 'string' || sample === null)) target[k] = v.slice(0, 500);
    }
  };
  walk(out, isObj(patch) ? patch : {}, TEMPLATE);
  return out as unknown as Booking;
}
const TEMPLATE = (() => {
  const t = emptyBooking() as unknown as Record<string, unknown>;
  // types for nullable leaves (null in the empty booking) are accepted as any primitive
  return t;
})();

// ---------------------------------------------------------------- what is still missing

export type Need =
  | 'cargo'
  | 'items_confirmed'
  | 'pickup'
  | 'destination'
  | 'same_place'
  | 'quantity'
  | 'weight'
  | 'temperature'
  | 'schedule'
  | 'time'
  | 'assistance'
  | 'helpers'
  | 'floors_pickup'
  | 'floors_destination'
  | 'fragile'
  | 'passengers'
  | 'savings'
  | 'instructions';

/** Things without which no driver can quote. */
export function requiredMissing(b: Booking): Need[] {
  const out: Need[] = [];
  if (!b.cargo.items.length && !b.cargo.description && !b.cargo.category) out.push('cargo');
  if (!b.pickup?.city) out.push('pickup');
  if (!b.destination?.city) out.push('destination');
  if (b.cargo.category === 'construction' && b.cargo.estimated_weight_kg == null) out.push('quantity');
  else if (b.cargo.estimated_weight_kg == null && b.cargo.weight_source !== 'estimate') out.push('weight');
  if (b.cargo.category === 'refrigerated' && b.cargo.temperature_control == null) out.push('temperature');
  if (!b.schedule.mode) out.push('schedule');
  if (b.assistance.loading == null && b.assistance.unloading == null) out.push('assistance');
  return out;
}
export const isReady = (b: Booking) => requiredMissing(b).length === 0;

export const LABEL_KEYS: Record<Need, string> = {
  cargo: 'what is being transported',
  items_confirmed: 'whether these are all the items',
  pickup: 'pickup city/area',
  destination: 'delivery city/area',
  same_place: 'pickup and delivery are the same place',
  quantity: 'quantity (bags, tons…)',
  weight: 'approximate weight (or agreement to use an estimate)',
  temperature: 'whether temperature control is needed',
  schedule: 'when (now or a date)',
  time: 'preferred pickup time',
  assistance: 'loading/unloading help',
  helpers: 'number of helpers',
  floors_pickup: 'pickup floor and elevator',
  floors_destination: 'delivery floor and elevator',
  fragile: 'fragile items',
  passengers: 'whether someone rides along',
  savings: 'shared or return-trip vehicle acceptable',
  instructions: 'special instructions',
};
