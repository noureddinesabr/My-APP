/**
 * Trip progress helpers shared by the client and driver live screens.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

type LatLng = { lat: number; lng: number };
type Status = 'toPickup' | 'atPickup' | 'loading' | 'inTransit' | 'atDropoff' | 'delivered' | 'completed' | 'cancelled';

const rad = (deg: number) => (deg * Math.PI) / 180;
function haversineKm(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Where the driver is heading in this status, or null when not moving. */
export function targetFor(status: Status, from: LatLng, to: LatLng): LatLng | null {
  if (status === 'toPickup') return from;
  if (status === 'inTransit') return to;
  return null;
}

/** Remaining road distance (km) and minutes at typical Moroccan speeds. */
export function remaining(position: LatLng, target: LatLng) {
  const km = haversineKm(position, target) * 1.3;
  const speed = km < 15 ? 30 : 70;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((km / speed) * 60)) };
}

/** Test-mode starting point for a driver: a few km from the pickup, toward their home city. */
export function simulatedStart(pickup: LatLng, home: LatLng) {
  const km = haversineKm(pickup, home);
  if (km > 3 && km < 60) return home;
  // Default: about 4 km north-east of the pickup.
  return { lat: pickup.lat + 0.028, lng: pickup.lng + 0.03 };
}

/**
 * Next simulated position: moves toward the target so the leg takes about
 * `legSeconds`, ticking every `tickSeconds`. Never overshoots.
 */
export function simulateStep(position: LatLng, target: LatLng, legKm: number, tickSeconds = 2, legSeconds = 40) {
  const stepKm = Math.max(0.15, (legKm * tickSeconds) / legSeconds);
  const left = haversineKm(position, target);
  if (left <= stepKm) return { ...target };
  const t = stepKm / left;
  return { lat: position.lat + (target.lat - position.lat) * t, lng: position.lng + (target.lng - position.lng) * t };
}

/** Within ~80 m counts as arrived. */
export function arrived(position: LatLng, target: LatLng) {
  return haversineKm(position, target) < 0.08;
}

/** Steps shown on the progress timeline, in order. */
export const TIMELINE: Status[] = ['toPickup', 'atPickup', 'loading', 'inTransit', 'atDropoff', 'delivered', 'completed'];

/** The next status the driver can move to. */
export function nextStatus(status: Status): Status | null {
  const index = TIMELINE.indexOf(status);
  return index >= 0 && index < TIMELINE.length - 2 ? TIMELINE[index + 1] : null;
}

/** Cancelling is allowed until the goods are loaded. */
export function canCancel(status: Status) {
  return status === 'toPickup' || status === 'atPickup';
}
