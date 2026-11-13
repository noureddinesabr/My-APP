/**
 * Price and trip estimates shown to clients before any driver offer.
 * These are estimates only and are always labelled as such in the UI.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type VehicleId =
  | 'triporteur'
  | 'smallVan'
  | 'pickup'
  | 'cityTruck'
  | 'largeVan'
  | 'lightTruck'
  | 'truck35'
  | 'truck7'
  | 'truck12'
  | 'semi'
  | 'refrigerated'
  | 'flatbed';

/** Base fee and price per km in MAD, by vehicle. Tuned later from real offers. */
const RATES: Record<VehicleId, { base: number; perKm: number; maxTons: number }> = {
  triporteur: { base: 80, perKm: 2, maxTons: 0.5 },
  smallVan: { base: 150, perKm: 3, maxTons: 0.8 },
  pickup: { base: 200, perKm: 4, maxTons: 1.5 },
  cityTruck: { base: 210, perKm: 4.2, maxTons: 1.3 },
  largeVan: { base: 230, perKm: 4.5, maxTons: 1.4 },
  lightTruck: { base: 270, perKm: 4.8, maxTons: 2.5 },
  truck35: { base: 300, perKm: 5, maxTons: 3.5 },
  truck7: { base: 500, perKm: 7, maxTons: 7 },
  truck12: { base: 800, perKm: 9, maxTons: 20 },
  semi: { base: 1500, perKm: 12, maxTons: 40 },
  refrigerated: { base: 900, perKm: 10, maxTons: 20 },
  flatbed: { base: 900, perKm: 10, maxTons: 25 },
};

/** Vehicles suggested by weight, smallest first (special trucks are chosen explicitly). */
const STANDARD_ORDER: VehicleId[] = ['triporteur', 'smallVan', 'pickup', 'cityTruck', 'largeVan', 'truck35', 'lightTruck', 'truck7', 'truck12', 'semi'];

export const HELPER_FEE = 80;
/** Typical distance of a move inside one city, in km. */
export const IN_CITY_KM = 12;
const ROAD_FACTOR = 1.3;
const AVERAGE_SPEED_KMH = 60;

export function maxTons(vehicle: VehicleId) {
  return RATES[vehicle].maxTons;
}

export function suggestVehicle(tons: number, needsCold = false): VehicleId {
  if (needsCold) return 'refrigerated';
  return STANDARD_ORDER.find((id) => RATES[id].maxTons >= tons) ?? 'semi';
}

/** All vehicles that can carry the weight. */
export function suitableVehicles(tons: number): VehicleId[] {
  return (Object.keys(RATES) as VehicleId[]).filter((id) => RATES[id].maxTons >= tons);
}

type Point = { lat: number; lng: number };

/** Road distance estimate in km between two cities (straight line × road factor). */
export function estimateDistanceKm(from: Point, to: Point, sameCity: boolean) {
  if (sameCity) return IN_CITY_KM;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * 6371 * Math.asin(Math.sqrt(a));
  return Math.round(straight * ROAD_FACTOR);
}

export function estimateDurationMinutes(km: number) {
  return Math.round((km / AVERAGE_SPEED_KMH) * 60 + 20);
}

const roundTo10 = (value: number) => Math.round(value / 10) * 10;

/** Suggested fair price with a ±10% range, in MAD. */
export function estimatePrice(vehicle: VehicleId, km: number, helpers: number) {
  const rate = RATES[vehicle];
  const trip = rate.base + rate.perKm * km;
  const helpersFee = helpers * HELPER_FEE;
  const suggested = roundTo10(trip + helpersFee);
  return {
    suggested,
    low: roundTo10(suggested * 0.9),
    high: roundTo10(suggested * 1.1),
    helpersFee,
  };
}

/** Commission taken from the driver's wallet when a client accepts their offer (8–10%, set by admin). */
export const COMMISSION_RATE = 0.1;

export function commissionSplit(price: number, rate = COMMISSION_RATE) {
  const commission = Math.round(price * rate);
  return { commission, driverKeeps: price - commission };
}

// ---------------- The trip's real cost (round 6) ----------------
// Fuel prices at the pump in Morocco (November 2026: gasoil ≈ 16.90 DH/L, essence ≈ 15.50 DH/L).
// Update these when the prices change; every estimate follows.
export const DIESEL_DH_PER_L = 16.9;
export const PETROL_DH_PER_L = 15.5;

/** What running each vehicle costs: fuel use (L/100 km), wear and upkeep per km, the driver's hour, and the least a trip is worth. */
const COSTS: Record<VehicleId, { l100: number; petrol?: boolean; wearKm: number; hour: number; minFare: number }> = {
  triporteur: { l100: 4.5, petrol: true, wearKm: 0.5, hour: 50, minFare: 70 },
  smallVan: { l100: 8, wearKm: 0.8, hour: 80, minFare: 150 },
  pickup: { l100: 10, wearKm: 1, hour: 90, minFare: 180 },
  cityTruck: { l100: 10.5, wearKm: 1, hour: 90, minFare: 190 },
  largeVan: { l100: 11, wearKm: 1.1, hour: 95, minFare: 200 },
  lightTruck: { l100: 14, wearKm: 1.4, hour: 110, minFare: 250 },
  truck35: { l100: 15, wearKm: 1.5, hour: 120, minFare: 300 },
  truck7: { l100: 20, wearKm: 2.2, hour: 150, minFare: 450 },
  truck12: { l100: 28, wearKm: 3, hour: 180, minFare: 700 },
  semi: { l100: 35, wearKm: 4, hour: 220, minFare: 1300 },
  refrigerated: { l100: 32, wearKm: 3.5, hour: 190, minFare: 900 },
  flatbed: { l100: 30, wearKm: 3.2, hour: 190, minFare: 900 },
};
/** Loading and unloading time, in minutes, by size of vehicle. */
const handlingMinutes = (v: VehicleId) => (v === 'triporteur' || v === 'smallVan' ? 30 : v === 'pickup' || v === 'cityTruck' || v === 'largeVan' || v === 'lightTruck' || v === 'truck35' ? 45 : 75);

/** Road km between two points: straight line × 1.3, at least 2 km. */
export function roadKm(from: Point, to: Point) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.max(2, Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * ROAD_FACTOR));
}

/**
 * The price from what the trip really costs the driver: fuel for the way to the pickup and the
 * trip (and half the empty way back on long trips), wear, and the driver's time (driving at town
 * or road speed, plus loading), with a 15% margin. `min` is what the trip costs without margin:
 * the customer can't offer less, since no driver could take it without losing money.
 */
export function tripCost(vehicle: VehicleId, km: number, helpers: number) {
  const c = COSTS[vehicle];
  const long = km > 40;
  const toPickup = long ? 10 : 5;
  const backEmpty = long ? km * 0.5 : 0;
  const drivenKm = toPickup + km + backEmpty;
  const fuel = (drivenKm * c.l100 * (c.petrol ? PETROL_DH_PER_L : DIESEL_DH_PER_L)) / 100;
  const wear = drivenKm * c.wearKm;
  const speed = long ? 70 : 25;
  const minutes = Math.round(((toPickup + km) / speed) * 60 + handlingMinutes(vehicle) + (long ? (backEmpty / speed) * 60 * 0.5 : 0));
  const time = (minutes / 60) * c.hour;
  const helpersFee = helpers * HELPER_FEE;
  const cost = Math.max(c.minFare, fuel + wear + time);
  const min = roundTo10(cost + helpersFee);
  const suggested = Math.max(min, roundTo10(cost * 1.15 + helpersFee));
  return { suggested, low: roundTo10(Math.max(min, suggested * 0.92)), high: roundTo10(suggested * 1.12), min, fuel: Math.round(fuel), minutes, helpersFee };
}

// ---------- Market memory (round 8) ----------

/** A price a customer accepted for a trip (kept on the phone in the test version; the server later). */
export type MarketSample = { vehicle: VehicleId; km: number; price: number; helpers: number; at: number };

/**
 * The cost model, corrected by what drivers really accepted for similar trips: the same vehicle,
 * a similar distance (half to double), in the last 90 days. With 3 or more such trips the
 * suggestion moves toward their median (by how far they were from the model), never more than
 * −25% / +40%. It stays a hint: the customer always sets the price.
 */
export function marketCost(vehicle: VehicleId, km: number, helpers: number, samples: MarketSample[]) {
  const base = tripCost(vehicle, km, helpers);
  const since = Date.now() - 90 * 24 * 3600 * 1000;
  const like = samples.filter((s) => s.vehicle === vehicle && s.at > since && s.km >= km / 2 && s.km <= km * 2);
  if (like.length < 3) return { ...base, learned: 0 };
  const ratios = like.map((s) => s.price / Math.max(1, tripCost(s.vehicle, s.km, s.helpers).suggested)).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const k = Math.min(1.4, Math.max(0.75, median));
  const suggested = roundTo10(base.suggested * k);
  return { ...base, suggested, low: roundTo10(suggested * 0.92), high: roundTo10(suggested * 1.12), learned: like.length };
}
