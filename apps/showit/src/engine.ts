import { translate, type Key } from './i18n';
import { fromLocalString } from './lib/schedule';
import { appMessage, driverAutoMessage, getState, isLive, notify, patchRequest, runExampleTrip, setStage, SIM, type Request } from './store';

/**
 * The trip engine: from the moment a booking is made until the driver sets off, it sends the
 * right message at the right time to the customer and to the driver, whether the trip is now,
 * later today, tomorrow or days ahead, and it watches for a driver who is late.
 *
 * Every message shows as a notice (with sound) and is also written in the trip's conversation,
 * so nothing is missed on the side that wasn't looking. In this test version it runs while the
 * app is open; a real launch sends the same plan from the server as phone notifications.
 */

export type Who = 'customer' | 'driver' | 'both';
export type PlanStep = { key: string; at: number; who: Who; text: Key; important?: boolean };

const MIN = 60_000;
const HOUR = 60 * MIN;
/** Until real driving times are known: time a driver needs to reach a pickup, plus a margin. */
const LEAD = 40 * MIN;

/** The pickup time: "now" counts from the moment the offer was accepted. */
export function pickupTime(r: Request) {
  if (r.when === 'now') return r.acceptedAt ?? r.createdAt;
  const t = fromLocalString(r.when).getTime();
  return Number.isNaN(t) ? (r.acceptedAt ?? r.createdAt) : t;
}

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Everything planned for a booked trip, in time order (also shown to both sides as the trip's timeline). */
export function tripPlan(r: Request): PlanStep[] {
  const booked = r.acceptedAt ?? r.createdAt;
  const T = pickupTime(r);
  const steps: PlanStep[] = [{ key: 'booked', at: booked, who: 'both', text: 'en_booked' }];
  if (r.when === 'now') {
    steps.push({ key: 'goNow', at: booked, who: 'driver', text: 'en_goNow', important: true });
    steps.push({ key: 'late', at: booked + 45 * MIN, who: 'both', text: 'en_lateNow', important: true });
    return steps;
  }
  const ahead = T - booked;
  // Days ahead: the driver confirms the day before; without an answer the customer is told in time.
  if (ahead > 30 * HOUR) {
    steps.push({ key: 'confirm', at: T - 24 * HOUR, who: 'driver', text: 'en_confirmAsk', important: true });
    steps.push({ key: 'noConfirm', at: T - 12 * HOUR, who: 'customer', text: 'en_noConfirm', important: true });
  }
  // Another day: the evening before (20:00) and the morning of the day (08:00).
  if (dayStart(T) > dayStart(booked)) {
    const eve = dayStart(T) - 4 * HOUR;
    if (eve > booked) steps.push({ key: 'eve', at: eve, who: 'both', text: 'en_tomorrow' });
    const morning = dayStart(T) + 8 * HOUR;
    if (morning > booked && T - morning > 2 * HOUR) steps.push({ key: 'morning', at: morning, who: 'both', text: 'en_today' });
  }
  if (ahead > 2.5 * HOUR) steps.push({ key: 'h2', at: T - 2 * HOUR, who: 'both', text: 'en_in2h' });
  steps.push({ key: 'leave', at: T - LEAD, who: 'driver', text: 'en_leave', important: true });
  steps.push({ key: 'ready', at: T - 30 * MIN, who: 'customer', text: 'en_ready' });
  steps.push({ key: 'late', at: T + 10 * MIN, who: 'both', text: 'en_late', important: true });
  return steps.sort((a, b) => a.at - b.at);
}

/** Whether a planned step still applies (e.g. no "late" once the driver set off, no "no answer" once confirmed). */
function applies(r: Request, step: PlanStep) {
  if (step.key === 'late' || step.key === 'leave' || step.key === 'goNow') return r.stage === 'accepted';
  if (step.key === 'noConfirm' || step.key === 'confirm') return r.stage === 'accepted' && !r.driverConfirmedAt;
  return isLive(r.stage);
}

/** The trip's details a step's sentence is filled with. */
export function stepVars(r: Request) {
  const d = new Date(pickupTime(r));
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { driver: r.driverName ?? '', time, from: r.from.split(/[,،]/)[0], to: r.to.split(/[,،]/)[0] };
}

/** What a step says, with the trip's details filled in. */
export function stepText(r: Request, step: PlanStep, lang = getState().lang) {
  return translate(lang, step.text, stepVars(r));
}

function tick() {
  const now = Date.now();
  for (const r of getState().requests) {
    if (!isLive(r.stage) || r.driverName === undefined) continue;
    const sent = new Set(r.reminders ?? []);
    const due = tripPlan(r).filter((s) => s.at <= now && !sent.has(s.key));
    if (!due.length) continue;
    // Old reminders that were missed while the app was closed are marked done without a burst of notices;
    // only the latest one (and important ones less than 6 h old) are shown.
    const latest = due[due.length - 1];
    for (const step of due) {
      sent.add(step.key);
      if (!applies(r, step)) continue;
      // The driver's automatic lines (round 6): on booking (now or another day), and the
      // confirmation the day before (example drivers confirm by themselves; real ones tap Confirm).
      if (step.key === 'booked' && now - step.at < 6 * HOUR) driverAutoMessage(r.id, r.when === 'now' ? 'drvAuto_bookedNow' : 'drvAuto_bookedLater', stepVars(r));
      if (step.key === 'confirm' && r.driverIsExample && !r.driverConfirmedAt) {
        patchRequest(r.id, { driverConfirmedAt: Date.now() });
        driverAutoMessage(r.id, 'drvAuto_confirmed', stepVars(r));
      }
      const fresh = step === latest || (step.important && now - step.at < 6 * HOUR);
      if (!fresh) continue;
      const text = stepText(r, step);
      appMessage(r.id, step.text, stepVars(r));
      const sound = step.important ? 'offer' : 'step';
      if (step.who !== 'driver') notify('customer', 'en_notice', sound, { text }, undefined, r.id);
      if (step.who !== 'customer') notify('driver', 'en_notice', sound, { text }, undefined, r.id);
    }
    patchRequest(r.id, { reminders: Array.from(sent) });
  }
}

/**
 * Example drivers (test version) keep their trips moving even after the app was closed and
 * reopened: each stage lasts its set time, and a booking for later starts at its time.
 */
function advanceExamples() {
  const now = Date.now();
  for (const r of getState().requests) {
    if (!r.driverIsExample || !isLive(r.stage)) continue;
    const since = now - (r.phaseAt ?? now);
    if (r.stage === 'accepted' && now >= pickupTime(r) - LEAD) runExampleTrip(r.id);
    else if (r.stage === 'enroute' && since > SIM.toPickup + 4000) setStage(r.id, 'arrived');
    else if (r.stage === 'arrived' && since > SIM.loading + 4000) setStage(r.id, 'loaded');
    else if (r.stage === 'loaded' && since > SIM.toDrop + 4000) setStage(r.id, 'delivered');
  }
}

let started = false;
/** Starts the engine once (reminders checked every 20 seconds while the app is open). */
export function startTripEngine() {
  if (started) return;
  started = true;
  setTimeout(tick, 1500);
  setInterval(tick, 20_000);
  setInterval(advanceExamples, 2000);
}

/** Runs the engine right away (after a booking or a change), instead of waiting for the next check. */
export const checkTripsNow = () => setTimeout(tick, 300);
