import { pickupTime } from './engine';
import { COMMISSION_RATE } from './lib/pricing';
import { appMessage, getState, isLive, newId, notify, patchRequest, scheduleExampleOffers, setStage, takesOffers, update, type CustRecord, type Request } from './store';

/**
 * The owner's rules (rounds of questions, Nov 2026), in one place so each can be tested.
 * The same numbers are written in the document «Xapp Freight — How the whole app works», section 8.
 * In this test version everything runs on one phone while the app is open; SMS and WhatsApp
 * messages, the team's calls and the admin dashboard come with the server.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------- Rule 2: cancelling gets harder as the trip moves ----------

/**
 * What the customer can do to cancel at each step: 'free' before the driver sets off; 'problem' once
 * he is on his way (call him first, or change the time, then cancel); 'team' once he arrived or the
 * goods are loaded (only Xapp's team can end the trip; the missing-helpers case is Rule 11).
 */
export function customerCancelLevel(r: Request): 'free' | 'problem' | 'team' {
  if (r.stage === 'open' || r.stage === 'accepted') return 'free';
  if (r.stage === 'enroute') return 'problem';
  return 'team';
}

const recent = (list: number[] | undefined, now: number, days = 30) => (list ?? []).filter((at) => at > now - days * DAY);

/**
 * The customer's quiet record (only the team sees it; the cancel screen never mentions it):
 * 1st late cancel in 30 days noted, 2nd a gentle word, 3rd a pause (24 h in the test version)
 * and a call from the team.
 */
export function custStanding(rec: CustRecord | undefined, now = Date.now()) {
  const late = recent(rec?.lateCancels, now).length;
  const paused = rec?.pausedUntil && rec.pausedUntil > now ? rec.pausedUntil : 0;
  return { late, gentle: late === 2, paused };
}

function noteRecord(field: 'lateCancels' | 'noShows' | 'wrongClaims', now = Date.now()) {
  update((s) => {
    const rec: CustRecord = { ...(s.custRecord ?? {}) };
    rec[field] = [...recent(rec[field], now, 90), now];
    if (field === 'lateCancels' && recent(rec.lateCancels, now).length >= 3) rec.pausedUntil = now + DAY;
    return { ...s, custRecord: rec };
  });
}

/** A customer cancel: after the driver set off it is noted quietly (Rule 2). */
export function noteCustomerCancel(r: Request) {
  if (r.stage !== 'open' && r.stage !== 'accepted') noteRecord('lateCancels');
}

/** Rule 2: move the trip instead of cancelling. The driver answers; an example driver agrees by himself. */
export function askTimeChange(reqId: string, when: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || !isLive(r.stage)) return;
  patchRequest(reqId, { timeAsk: { when, at: Date.now() } });
  appMessage(reqId, 'tc_askMsg', { when });
  notify('driver', 'tc_askNt', 'offer', { when }, undefined, reqId);
  if (r.driverIsExample) setTimeout(() => answerTimeChange(reqId, true), 4500);
}

/** The driver accepts the new time (the trip waits for it again) or keeps the agreed one. */
export function answerTimeChange(reqId: string, yes: boolean) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r?.timeAsk) return;
  if (yes) {
    const now = Date.now();
    patchRequest(reqId, { when: r.timeAsk.when, timeAsk: undefined, stage: 'accepted', phaseAt: now, movedAt: now, reminders: [], driverPos: undefined, noAnswerAt: undefined });
    appMessage(reqId, 'tc_okMsg', { when: r.timeAsk.when });
    notify('customer', 'tc_okNt', 'success', { name: r.driverName ?? '' }, undefined, reqId);
  } else {
    patchRequest(reqId, { timeAsk: undefined });
    appMessage(reqId, 'tc_noMsg');
    notify('customer', 'tc_noNt', 'step', { name: r.driverName ?? '' }, undefined, reqId);
  }
}

// ---------- Rule 4: when a request with no deal closes ----------

/**
 * «Now»: after 1 hour without a deal, ask «keep looking, raise the price, or stop?»; no answer in
 * 15 minutes → it closes quietly. Keep or raise → the same question again an hour later.
 * Another day: asked 3 hours before the chosen time; whatever the answer, it stays open until that
 * time, then fades away.
 */
export function expiryDue(r: Request, now = Date.now()): 'ask' | 'close' | null {
  if (r.stage !== 'open' || r.closedQuietly) return null;
  if (r.when === 'now') {
    if (!r.expiryAskAt) return now >= (r.openSince ?? r.createdAt) + HOUR ? 'ask' : null;
    return now >= r.expiryAskAt + 15 * MIN ? 'close' : null;
  }
  const T = pickupTime(r);
  if (now >= T) return 'close';
  if (!r.expiryAskAt && now >= T - 3 * HOUR) return 'ask';
  return null;
}

/** The customer keeps looking (or raised the price): a «now» request gets another hour. */
export function keepLooking(reqId: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || r.stage !== 'open') return;
  if (r.when === 'now') patchRequest(reqId, { openSince: Date.now(), expiryAskAt: undefined });
  else patchRequest(reqId, { expiryAskAt: r.expiryAskAt ?? Date.now() });
}

function checkExpiry(now: number) {
  for (const r of getState().requests) {
    const due = expiryDue(r, now);
    if (due === 'ask') {
      patchRequest(r.id, { expiryAskAt: now });
      notify('customer', 'ex_askNt', 'offer', undefined, undefined, r.id);
    } else if (due === 'close') {
      update((s) => ({
        ...s,
        activeRequestId: s.activeRequestId === r.id ? null : s.activeRequestId,
        offers: s.offers.filter((o) => o.requestId !== r.id),
        requests: s.requests.map((x) => (x.id === r.id ? { ...x, stage: 'cancelled', closedQuietly: true, phaseAt: now } : x)),
      }));
    }
  }
}

/** Send a closed request again with one tap: the same answers, a new request. */
export function sendAgain(r: Request) {
  const now = Date.now();
  const copy: Request = {
    ...r,
    id: newId(),
    createdAt: now,
    stage: 'open',
    when: r.when !== 'now' && pickupTime(r) <= now ? 'now' : r.when,
    messages: [],
    seenByCustomer: 0,
    seenByDriver: 0,
    openSince: undefined,
    expiryAskAt: undefined,
    closedQuietly: undefined,
    cancelledBy: undefined,
    cancelReason: undefined,
    driverName: undefined,
    driverVehicle: undefined,
    driverIsExample: undefined,
    acceptedAt: undefined,
    takenAt: undefined,
    phaseAt: undefined,
    reminders: [],
    cancelledDrivers: [],
    priceAsk: undefined,
    priceLog: undefined,
    reopenedAt: undefined,
    noAnswerAt: undefined,
    timeAsk: undefined,
  };
  update((s) => ({ ...s, requests: [copy, ...s.requests], activeRequestId: copy.id }));
  scheduleExampleOffers(copy);
  return copy;
}

// ---------- Rule 7b: the driver doesn't answer before the trip ----------

/** How long to wait for a sign from the driver: < 3 h before the trip 15 min, later the same day 1 h, another day 2 h. */
export function waitMinutes(r: Request, now = Date.now()) {
  const T = pickupTime(r);
  if (T - now < 3 * HOUR) return 15;
  return new Date(T).toDateString() === new Date(now).toDateString() ? 60 : 120;
}

/** Any sign the driver is there since `since`: a message he wrote, a step, his position, «I take it». */
export function driverSign(r: Request, since: number) {
  if (r.stage !== 'accepted') return true;
  if ((r.messages ?? []).some((m) => m.from === 'driver' && !m.auto && m.at > since)) return true;
  if (r.driverPos && r.driverPos.at > since) return true;
  return !!r.takenAt && r.takenAt > since;
}

/** Where the customer's «the driver doesn't answer» stands: waiting for a sign, answered, or time to choose. */
export function noAnswerState(r: Request, now = Date.now()): 'waiting' | 'answered' | 'choose' | null {
  if (!r.noAnswerAt) return null;
  if (driverSign(r, r.noAnswerAt)) return 'answered';
  return now >= r.noAnswerAt + waitMinutes(r, r.noAnswerAt) * MIN ? 'choose' : 'waiting';
}

/** The customer tapped «The driver doesn't answer»: the app reaches him at once. */
export function reportNoAnswer(reqId: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || r.stage !== 'accepted' || !r.driverName) return;
  patchRequest(reqId, { noAnswerAt: Date.now() });
  appMessage(reqId, 'na_drvMsg', { when: r.when }, 'driver');
  appMessage(reqId, 'na_sentMsg', { name: r.driverName, min: waitMinutes(r) }, 'customer');
  notify('driver', 'na_drvNt', 'offer', undefined, reqId);
}

/** «Keep waiting»: nothing changes. */
export const keepWaiting = (reqId: string) => patchRequest(reqId, { noAnswerAt: undefined });

/** «Let other drivers make offers too»: the first driver keeps the trip until another is accepted. */
export function letOthersOffer(reqId: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || r.stage !== 'accepted') return;
  patchRequest(reqId, { reopenedAt: Date.now() });
  appMessage(reqId, 'na_reopenMsg', { name: r.driverName ?? '' }, 'customer');
  const now = getState().requests.find((x) => x.id === reqId);
  if (now) scheduleExampleOffers(now);
}

/** The first driver showed a sign: the extra offers stop and the trip goes on with him. */
function checkNoAnswer() {
  for (const r of getState().requests) {
    if (r.noAnswerAt && r.stage === 'accepted' && driverSign(r, r.noAnswerAt)) {
      const was = !!r.reopenedAt;
      patchRequest(r.id, { noAnswerAt: undefined, reopenedAt: undefined });
      if (was) update((s) => ({ ...s, offers: s.offers.filter((o) => !(o.requestId === r.id && o.driverName !== r.driverName)) }));
      notify('customer', 'na_answeredNt', 'success', { name: r.driverName ?? '' }, undefined, r.id);
    }
  }
}

export { takesOffers };

/**
 * Accepting an offer (moved here from the offers page so the trip page can use it too). On a
 * reopened trip the first driver is released; that counts like a driver cancel (Rule 7b).
 */
export function acceptOffer(reqId: string, offerId: string) {
  const s0 = getState();
  const r = s0.requests.find((x) => x.id === reqId);
  const o = s0.offers.find((x) => x.id === offerId);
  if (!r || !o || !takesOffers(r)) return;
  const now = Date.now();
  if (r.stage === 'accepted' && r.driverName) {
    const first = r.driverName;
    update((s) => ({
      ...s,
      offers: s.offers.filter((x) => !(x.requestId === reqId && x.driverName === first)),
      driver: first === s.driver.name ? { ...s.driver, cancels: [...(s.driver.cancels ?? []).filter((at) => at > now - 7 * DAY), now] } : s.driver,
    }));
    patchRequest(reqId, { cancelledDrivers: [...(r.cancelledDrivers ?? []), { name: first, reason: 'noAnswer', at: now }] });
    appMessage(reqId, 'na_releasedMsg', { name: first });
    notify('driver', 'na_releasedNt', 'step', undefined, undefined, reqId);
  }
  update((s) => ({ ...s, market: [...(s.market ?? []), { vehicle: o.vehicle, km: r.km, price: o.price, helpers: r.helpers, at: now }].slice(-300) }));
  patchRequest(reqId, {
    price: o.price,
    driverName: o.driverName,
    driverVehicle: o.vehicle,
    driverIsExample: o.example,
    acceptedAt: now,
    takenAt: o.example ? now : undefined,
    reminders: [],
    driverPos: undefined,
    noAnswerAt: undefined,
    reopenedAt: undefined,
    company: o.company,
    // Rule 5: the app's share is fixed when the trip is booked.
    commissionRate: getState().commission ?? COMMISSION_RATE,
  });
  setStage(reqId, 'accepted');
}

// ---------- Rule 1: nobody answers at the pickup ----------

/** The driver is at the pickup and nobody answers: the app reaches the customer on every channel. */
export function reportNoShow(reqId: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || r.stage !== 'arrived') return;
  patchRequest(reqId, { noShowAt: Date.now() });
  appMessage(reqId, 'ns_custMsg', { name: r.driverName ?? '' }, 'customer');
  appMessage(reqId, 'ns_drvMsg', undefined, 'driver');
  notify('customer', 'ns_custNt', 'offer', { name: r.driverName ?? '' }, reqId);
}

/** The driver ends a trip because nobody came: noted on the customer's record, never against him. */
export const noteNoShow = () => noteRecord('noShows');

// ---------- Rule 3: the driver rates the customer, quietly ----------

export const CUST_TAGS = ['ct_onTime', 'ct_asDescribed', 'ct_friendly'] as const;
export function rateCustomer(reqId: string, stars: number, tags: string[]) {
  patchRequest(reqId, { custRating: { stars, tags, at: Date.now() } });
}

// ---------- Rule 11: helpers promised but not brought ----------

/** The customer may say «the helpers didn't come» only between «Arrived» and «Loaded». */
export const canClaimHelpers = (r: Request) => r.stage === 'arrived' && (r.helpers ?? 0) > 0 && !r.helpersClaim;

export function claimHelpersMissing(reqId: string) {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r || !canClaimHelpers(r)) return;
  patchRequest(reqId, { helpersClaim: { at: Date.now() } });
  appMessage(reqId, 'hc_askMsg', { n: r.helpers }, 'driver');
  notify('driver', 'hc_askNt', 'offer', { n: r.helpers }, reqId);
  // An example driver admits it after a moment, so the next step can be tried on one phone.
  if (r.driverIsExample) setTimeout(() => answerHelpersClaim(reqId, 'yes'), 4500);
}

/**
 * The driver answers. Yes → they agree a new price, or either side cancels and nobody is counted.
 * No → the price stays; a cancel would be a normal late cancel; the photo and both answers stay in
 * the trip, and the claim is noted for the team.
 */
export function answerHelpersClaim(reqId: string, answer: 'yes' | 'no') {
  const r = getState().requests.find((x) => x.id === reqId);
  if (!r?.helpersClaim || r.helpersClaim.driver) return;
  patchRequest(reqId, { helpersClaim: { ...r.helpersClaim, driver: answer }, helpersCame: answer === 'yes' ? 'fewer' : 'yes' });
  appMessage(reqId, answer === 'yes' ? 'hc_yesMsg' : 'hc_noMsg', { name: r.driverName ?? '' });
  notify('customer', answer === 'yes' ? 'hc_yesNt' : 'hc_noNt', 'step', { name: r.driverName ?? '' }, undefined, reqId);
  if (answer === 'no') noteRecord('wrongClaims');
}

/** A cancel over missing helpers counts against nobody only once the driver said they didn't come. */
export const helpersCancelFree = (r: Request) => r.helpersClaim?.driver === 'yes';

// ---------- The rules' clock ----------

let started = false;
/** Checked with the trip engine (every 20 s while the app is open). */
export function startRules() {
  if (started) return;
  started = true;
  const run = () => {
    const now = Date.now();
    checkExpiry(now);
    checkNoAnswer();
  };
  // Rule 4: a request that closed while the app was away is shown when it opens again.
  setTimeout(() => {
    if (getState().requests.some((r) => r.closedQuietly && !r.closedSeen)) notify('customer', 'ex_closedNt', 'pop');
  }, 4000);
  setTimeout(run, 2000);
  setInterval(run, 20_000);
}

/** For the cancel sheet: the customer's cancel at this step, noted when late. */
export const cancelNotes = { noteCustomerCancel, noteNoShow };
export const _test = { noteRecord };
