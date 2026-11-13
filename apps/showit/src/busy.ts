import { pickupTime } from './engine';
import { getPlace } from './lib/places';
import { handlingMinutes, type VehicleId } from './lib/pricing';
import { isLive, type Profile, type Request } from './store';
import { vehicleById } from './vehicles';

/**
 * The driver's schedule (round 10). Each booked job holds a time window: from its start, the drive
 * to the pickup, loading, the drive, a margin by vehicle size (and 30 min more between cities),
 * until 15 min after it is handed over. A private job holds the whole window. During a shared job,
 * only other shared loads that fit the room left and lie on the way can be taken. Loads that would
 * not fit his time are not shown at all; later jobs, after the window, are fine (also while on a trip).
 */

const MIN = 60_000;
/** Extra time kept free after a job, by vehicle (bigger vehicles take longer to park, tie, unload). */
export const marginMinutes = (v: VehicleId) =>
  v === 'triporteur' ? 20 : v === 'smallVan' ? 30 : v === 'cityTruck' || v === 'pickup' ? 40 : v === 'largeVan' ? 45 : v === 'truck35' || v === 'lightTruck' ? 60 : v === 'truck7' || v === 'refrigerated' ? 75 : v === 'truck12' ? 90 : 120;

/** Time to drive `km`: town speed (25 km/h) for short trips, road speed (70 km/h) between cities. */
const driveMinutes = (km: number) => (km > 40 ? (km / 70) * 60 : (km / 25) * 60);

/** The window a job holds in the driver's day, [start, end] in ms. */
export function jobWindow(r: Request, vehicle: VehicleId) {
  const start = r.when === 'now' && !r.acceptedAt ? Date.now() : pickupTime(r);
  const intercity = r.km > 40;
  const minutes = 20 + handlingMinutes(vehicle) + driveMinutes(r.km || 12) + marginMinutes(vehicle) + (intercity ? 30 : 0);
  let end = start + minutes * MIN;
  if (r.stage === 'delivered') end = (r.deliveredAt ?? end) + 15 * MIN;
  // Still on the way past the estimate: the job keeps him busy until it ends.
  else if (isLive(r.stage) && end < Date.now()) end = Date.now() + marginMinutes(vehicle) * MIN;
  return { start, end };
}

type LL = { lat: number; lng: number };
/** How far a point is from the segment a→b (km) and where along it it falls (0…1). */
function along(p: LL, a: LL, b: LL) {
  const r = Math.PI / 180;
  const k = Math.cos(((a.lat + b.lat) / 2) * r) * 111.32;
  const ax = a.lng * k, ay = a.lat * 110.57, bx = b.lng * k, by = b.lat * 110.57, px = p.lng * k, py = p.lat * 110.57;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { u, km: Math.hypot(px - (ax + u * dx), py - (ay + u * dy)) };
}

/** Whether a load's pickup and destination both lie on a job's way, in the same direction. */
export function onJobWay(load: Request, job: Request) {
  const p = getPlace(load.fromPlaceId), d = getPlace(load.toPlaceId);
  const a = getPlace(job.fromPlaceId), b = getPlace(job.toPlaceId);
  if (!p || !d || !a || !b) return false;
  // Inside one town the way is short: allow a little more room around it.
  const room = job.km > 40 ? 15 : 4;
  const s = along(p, a, b), e = along(d, a, b);
  return s.km <= room && e.km <= room && e.u >= s.u - 0.02;
}

/** The driver's own booked jobs that still hold time (booked or in progress). */
export const activeJobs = (requests: Request[], driver: Profile) => requests.filter((r) => !r.driverIsExample && !!driver.name && r.driverName === driver.name && isLive(r.stage));

/**
 * Whether this driver can take a load now, given his booked jobs: '' when he can, otherwise why not
 * (a key of the reason, for the record; such loads are simply not shown).
 */
export function scheduleClash(load: Request, driver: Profile, requests: Request[]): '' | 'busyPrivate' | 'busyShared' {
  const mine = activeJobs(requests, driver).filter((j) => j.id !== load.id);
  if (!mine.length) return '';
  const w = jobWindow(load, driver.vehicle);
  const overlap = mine.filter((j) => {
    const jw = jobWindow(j, driver.vehicle);
    return jw.start < w.end && w.start < jw.end;
  });
  if (!overlap.length) return '';
  // A private job (his or this one) keeps the time for itself.
  if (overlap.some((j) => !j.shared) || !load.shared) return 'busyPrivate';
  const room = vehicleById(driver.vehicle).maxKg - overlap.reduce((n, j) => n + (j.weightKg || 0), 0);
  if ((load.weightKg || 0) > room) return 'busyShared';
  if (!overlap.every((j) => onJobWay(load, j))) return 'busyShared';
  return '';
}

// ---------- Gentle pauses after a driver cancels (round 10) ----------

const DAY = 24 * 60 * MIN;
/**
 * After he cancels a booked job (not counting a price nobody agreed on, nor a customer's cancel):
 * the first time in 7 days nothing happens (a kind word); the second, new loads rest 15 minutes;
 * from the third, 1 hour, and someone from Xapp may call, only to ask if all is well. Jobs he
 * already has go on. Emergencies: support removes it.
 */
export function pauseState(driver: Profile, now = Date.now()) {
  const recent = (driver.cancels ?? []).filter((at) => at > now - 7 * DAY).sort((a, b) => a - b);
  const n = recent.length;
  if (n < 2) return { n, until: 0, call: false };
  const last = recent[n - 1];
  const until = last + (n === 2 ? 15 : 60) * MIN;
  return { n, until: until > now ? until : 0, call: n >= 3 };
}

/**
 * «سائق ملتزم» (committed driver, round 10): 3 or more trips delivered and no booked job cancelled
 * in the last 30 days. A thank-you, shown on his profile; never the opposite label.
 */
export function committedDriver(requests: Request[], name: string, now = Date.now()) {
  if (!name) return false;
  const done = requests.filter((r) => r.driverName === name && r.stage === 'delivered').length;
  const cancelled = requests.some((r) => (r.cancelledDrivers ?? []).some((d) => d.name === name && d.at > now - 30 * DAY));
  return done >= 3 && !cancelled;
}
