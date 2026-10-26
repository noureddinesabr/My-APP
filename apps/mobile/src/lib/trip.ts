/**
 * Trip logic shared by the client and driver live screens: GPS-driven automatic
 * steps, ETA, test simulation, scheduled-booking reminders, driver levels and reliability.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

type LatLng = { lat: number; lng: number };
export type Status =
  | 'scheduled'
  | 'toPickup'
  | 'atPickup'
  | 'loading'
  | 'inTransit'
  | 'atDropoff'
  | 'delivered'
  | 'completed'
  | 'cancelled';

const rad = (deg: number) => (deg * Math.PI) / 180;
export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Within this distance of a stop counts as arrived (GPS is ±20–50 m in cities). */
export const ARRIVE_KM = 0.15;
/** Moving this far from the pickup after arriving means the truck left, loaded. */
export const LEAVE_KM = 0.3;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "Loading" is part of the arrived step; older jobs may still carry it. */
const norm = (status: Status): Status => (status === 'loading' ? 'atPickup' : status);

/** Steps shown on the progress timeline, in order. Scheduled jobs start with the booking step. */
export const TIMELINE: Status[] = ['scheduled', 'toPickup', 'atPickup', 'inTransit', 'atDropoff', 'delivered', 'completed'];

export function timelineFor(scheduled: boolean): Status[] {
  return scheduled ? TIMELINE : TIMELINE.slice(1);
}

/**
 * The status the driver's GPS position implies, or null when nothing changes.
 * The driver never has to tap "arrived" or "on the road".
 */
export function autoStatus(status: Status, position: LatLng, from: LatLng, to: LatLng): Status | null {
  const s = norm(status);
  if (s === 'toPickup' && haversineKm(position, from) <= ARRIVE_KM) return 'atPickup';
  if (s === 'atPickup' && haversineKm(position, from) >= LEAVE_KM) return 'inTransit';
  if (s === 'inTransit' && haversineKm(position, to) <= ARRIVE_KM) return 'atDropoff';
  return null;
}

/** Where the driver is heading (for ETA), or null when stopped at a stop. */
export function targetFor(status: Status, from: LatLng, to: LatLng): LatLng | null {
  const s = norm(status);
  if (s === 'toPickup' || s === 'scheduled') return from;
  if (s === 'inTransit') return to;
  return null;
}

/** Test simulation: where the simulated truck drives now (it waits `dwellMs` at the pickup to "load"). */
export function simulationTarget(status: Status, from: LatLng, to: LatLng, arrivedAt: number | undefined, now: number, dwellMs = 10_000) {
  const s = norm(status);
  if (s === 'toPickup') return from;
  if (s === 'atPickup') return arrivedAt !== undefined && now - arrivedAt >= dwellMs ? to : null;
  if (s === 'inTransit') return to;
  return null;
}

/** Remaining road distance (km) and minutes at typical Moroccan speeds. */
export function remaining(position: LatLng, target: LatLng) {
  const km = haversineKm(position, target) * 1.3;
  const speed = km < 15 ? 30 : 70;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((km / speed) * 60)) };
}

/** Test-mode starting point for a driver: their home city if close, else about 4 km from the pickup. */
export function simulatedStart(pickup: LatLng, home: LatLng) {
  const km = haversineKm(pickup, home);
  if (km > 3 && km < 60) return home;
  return { lat: pickup.lat + 0.028, lng: pickup.lng + 0.03 };
}

/** Next simulated position: the leg takes about `legSeconds`, ticking every `tickSeconds`. Never overshoots. */
export function simulateStep(position: LatLng, target: LatLng, legKm: number, tickSeconds = 2, legSeconds = 40) {
  const stepKm = Math.max(0.15, (legKm * tickSeconds) / legSeconds);
  const left = haversineKm(position, target);
  if (left <= stepKm) return { ...target };
  const t = stepKm / left;
  return { lat: position.lat + (target.lat - position.lat) * t, lng: position.lng + (target.lng - position.lng) * t };
}

export function arrived(position: LatLng, target: LatLng) {
  return haversineKm(position, target) <= ARRIVE_KM;
}

/** Cancelling is allowed until the goods are loaded. */
export function canCancel(status: Status) {
  const s = norm(status);
  return s === 'scheduled' || s === 'toPickup' || s === 'atPickup';
}

/** Cancelling a scheduled booking less than 2 hours before pickup counts against the driver. */
export function isLateCancel(scheduledAt: number | null, now: number) {
  return scheduledAt !== null && scheduledAt - now < 2 * HOUR;
}

/** Minutes late on arrival at the pickup (0 when on time or not scheduled). Up to 10 minutes is on time. */
export function lateMinutes(scheduledAt: number | null, arrivedAt: number) {
  if (scheduledAt === null) return 0;
  const late = Math.round((arrivedAt - scheduledAt) / MINUTE);
  return late > 10 ? late : 0;
}

export type ReminderId = 'day' | 'twoHours' | 'leave' | 'late';
const REMINDERS: { id: ReminderId; before: number; who: ('client' | 'driver')[] }[] = [
  { id: 'day', before: 24 * HOUR, who: ['client', 'driver'] },
  { id: 'twoHours', before: 2 * HOUR, who: ['client', 'driver'] },
  { id: 'leave', before: 45 * MINUTE, who: ['driver'] },
  { id: 'late', before: -10 * MINUTE, who: ['client', 'driver'] },
];

/**
 * Which reminder to show now for a scheduled booking. Only the latest due one is shown;
 * earlier ones that were missed are marked sent without showing.
 * `started` is true once the driver is on the way (no "time to leave" or "late" then).
 */
export function dueReminder(scheduledAt: number, now: number, sent: readonly string[], role: 'client' | 'driver', started: boolean) {
  const due = REMINDERS.filter(
    (r) =>
      r.who.includes(role) &&
      now >= scheduledAt - r.before &&
      !sent.includes(`${role}:${r.id}`) &&
      !(started && (r.id === 'leave' || r.id === 'late')),
  );
  if (!due.length) return { show: null, markSent: [] as string[] };
  const show = due[due.length - 1];
  return { show: show.id, markSent: due.map((r) => `${role}:${r.id}`) };
}

export type Level = 'new' | 'bronze' | 'silver' | 'gold' | 'platinum';

/** Level from real completed trips and average rating. */
export function levelFor(trips: number, rating: number): Level {
  if (trips >= 150 && rating >= 4.85) return 'platinum';
  if (trips >= 50 && rating >= 4.7) return 'gold';
  if (trips >= 20 && rating >= 4.5) return 'silver';
  if (trips >= 5) return 'bronze';
  return 'new';
}

export type DriverStats = { accepted: number; cancelled: number; lateCancels: number; late: number; onTime: number };

/** Share of accepted jobs done as promised: cancellations and late arrivals count against it. */
export function reliability(stats: DriverStats) {
  if (stats.accepted === 0) return 100;
  const misses = stats.cancelled + stats.lateCancels + stats.late * 0.5;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - misses / stats.accepted))));
}

/** 4-digit code the client gives the driver at delivery. */
export function deliveryCode(random = Math.random) {
  return String(Math.floor(random() * 10_000)).padStart(4, '0');
}
