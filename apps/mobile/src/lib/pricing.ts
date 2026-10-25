/**
 * Price and trip estimates shown to clients before any driver offer.
 * These are estimates only and are always labelled as such in the UI.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type VehicleId =
  | 'triporteur'
  | 'smallVan'
  | 'pickup'
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
  truck35: { base: 300, perKm: 5, maxTons: 3.5 },
  truck7: { base: 500, perKm: 7, maxTons: 7 },
  truck12: { base: 800, perKm: 9, maxTons: 20 },
  semi: { base: 1500, perKm: 12, maxTons: 40 },
  refrigerated: { base: 900, perKm: 10, maxTons: 20 },
  flatbed: { base: 900, perKm: 10, maxTons: 25 },
};

/** Vehicles suggested by weight, smallest first (special trucks are chosen explicitly). */
const STANDARD_ORDER: VehicleId[] = ['triporteur', 'smallVan', 'pickup', 'truck35', 'truck7', 'truck12', 'semi'];

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
