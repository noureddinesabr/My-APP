/* Rule checks for Xapp Freight (run with: node build.js && node out.js). Each check names its rule. */
import { pickupTime, tripDay, tripPlan } from '../../src/engine';
import { toLocalString } from '../../src/lib/schedule';
import {
  acceptOffer,
  answerHelpersClaim,
  answerTimeChange,
  askTimeChange,
  canClaimHelpers,
  claimHelpersMissing,
  customerCancelLevel,
  custStanding,
  driverSign,
  expiryDue,
  helpersCancelFree,
  keepLooking,
  letOthersOffer,
  noAnswerState,
  noteCustomerCancel,
  reportNoAnswer,
  reportNoShow,
  sendAgain,
  takesOffers,
  waitMinutes,
} from '../../src/rules';
import { canOffer, nameDone, papersDone, youDone } from '../../src/signup';
import { addOffer, getState, hidePhones, update, whenWords as ww, type Request } from '../../src/store';
const whenWords = (...a: Parameters<typeof ww>) => ww(...a).replace(/[\u200e\u200f\u2066-\u2069]/g, '');
import { misfit, workDone } from '../../src/work';

let pass = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) pass++;
  else fails.push(`${name}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ''}`);
}

const MIN = 60_000, HOUR = 60 * MIN;
const base = (over: Partial<Request> = {}): Request => ({
  id: 'r' + Math.random().toString(36).slice(2, 8), createdAt: Date.now(), load: '', weightKg: 100, vehicle: 'smallVan', from: 'Casablanca', to: 'Rabat',
  when: 'now', price: 500, fairMin: 0, fairMax: 0, km: 90, notes: '', noteTags: [], said: '', photoUri: '', voiceUri: '', voiceMs: 0, stage: 'open',
  helpers: 0, rideAlong: false, messages: [], fromPlaceId: 'casablanca', toPlaceId: 'rabat', ...over,
});
const put = (r: Request) => update((s) => ({ ...s, requests: [r, ...s.requests.filter((x) => x.id !== r.id)] }));
const get = (id: string) => getState().requests.find((r) => r.id === id)!;
const at = (d: Date) => toLocalString(d);

// ---------- Rule 13: the day in full ----------
{
  const now = new Date(2026, 10, 20, 12, 0); // Friday 20 Nov 2026
  ok('R13 tomorrow en', whenWords(at(new Date(2026, 10, 21, 10, 0)), 'en', now) === 'Tomorrow, Saturday 10:00', whenWords(at(new Date(2026, 10, 21, 10, 0)), 'en', now));
  ok('R13 tomorrow fr', whenWords(at(new Date(2026, 10, 21, 10, 0)), 'fr', now) === 'Demain, samedi 10:00', whenWords(at(new Date(2026, 10, 21, 10, 0)), 'fr', now));
  ok('R13 tomorrow ar', whenWords(at(new Date(2026, 10, 21, 10, 0)), 'ar', now).includes('السبت'));
  ok('R13 later en', whenWords(at(new Date(2026, 10, 25, 9, 30)), 'en', now) === 'Wednesday 25 Nov, 09:30', whenWords(at(new Date(2026, 10, 25, 9, 30)), 'en', now));
  ok('R13 today', whenWords(at(new Date(2026, 10, 20, 15, 0)), 'en', now) === 'Today 15:00');
  ok('R13 now', whenWords('now', 'en', now) === 'Now');
}

// ---------- Rule 2: cancel by step ----------
{
  ok('R2 open free', customerCancelLevel(base({ stage: 'open' })) === 'free');
  ok('R2 accepted free', customerCancelLevel(base({ stage: 'accepted' })) === 'free');
  ok('R2 enroute problem', customerCancelLevel(base({ stage: 'enroute' })) === 'problem');
  for (const st of ['arrived', 'loaded', 'dropoff'] as const) ok(`R2 ${st} team only`, customerCancelLevel(base({ stage: st })) === 'team');
  update((s) => ({ ...s, custRecord: {} }));
  noteCustomerCancel(base({ stage: 'accepted' }));
  ok('R2 early cancel not noted', custStanding(getState().custRecord).late === 0);
  noteCustomerCancel(base({ stage: 'enroute' }));
  ok('R2 1st late cancel noted, no word yet', custStanding(getState().custRecord).late === 1 && !custStanding(getState().custRecord).gentle);
  noteCustomerCancel(base({ stage: 'enroute' }));
  ok('R2 2nd late cancel: gentle word', custStanding(getState().custRecord).gentle);
  ok('R2 2nd: no pause', !custStanding(getState().custRecord).paused);
  noteCustomerCancel(base({ stage: 'enroute' }));
  ok('R2 3rd late cancel: pause', !!custStanding(getState().custRecord).paused);
  update((s) => ({ ...s, custRecord: {} }));
}

// ---------- Rule 2: change the time instead ----------
{
  const r = base({ stage: 'enroute', driverName: 'Hassan', when: 'now', acceptedAt: Date.now() });
  put(r);
  const later = at(new Date(Date.now() + 26 * HOUR));
  askTimeChange(r.id, later);
  ok('R2 time asked', get(r.id).timeAsk?.when === later);
  answerTimeChange(r.id, true);
  ok('R2 time accepted: new time, back to booked', get(r.id).when === later && get(r.id).stage === 'accepted' && !get(r.id).timeAsk && !!get(r.id).movedAt);
  const r2 = base({ stage: 'enroute', driverName: 'Hassan' });
  put(r2);
  askTimeChange(r2.id, later);
  answerTimeChange(r2.id, false);
  ok('R2 time refused: unchanged', get(r2.id).when === 'now' && get(r2.id).stage === 'enroute' && !get(r2.id).timeAsk);
}

// ---------- Rule 4: requests close by themselves ----------
{
  const t0 = Date.now();
  const r = base({ createdAt: t0 });
  ok('R4 now: nothing before 1 h', expiryDue(r, t0 + 59 * MIN) === null);
  ok('R4 now: ask after 1 h', expiryDue(r, t0 + 61 * MIN) === 'ask');
  const asked = base({ createdAt: t0, expiryAskAt: t0 + 61 * MIN });
  ok('R4 now: waits 15 min for an answer', expiryDue(asked, t0 + 75 * MIN) === null);
  ok('R4 now: closes after 15 min', expiryDue(asked, t0 + 77 * MIN) === 'close');
  put(asked);
  keepLooking(asked.id);
  ok('R4 now: keep looking gives another hour', !get(asked.id).expiryAskAt && expiryDue(get(asked.id), Date.now() + 30 * MIN) === null && expiryDue(get(asked.id), Date.now() + 61 * MIN) === 'ask');
  const T = new Date(t0 + 10 * HOUR);
  const later = base({ createdAt: t0, when: at(T) });
  const Tm = pickupTime(later);
  ok('R4 later: nothing before T-3h', expiryDue(later, Tm - 3 * HOUR - MIN) === null);
  ok('R4 later: ask at T-3h', expiryDue(later, Tm - 3 * HOUR + MIN) === 'ask');
  const laterAsked = { ...later, expiryAskAt: Tm - 3 * HOUR + MIN };
  ok('R4 later: stays open after the ask (no 15-min close)', expiryDue(laterAsked, Tm - 30 * MIN) === null);
  ok('R4 later: closes at the time', expiryDue(laterAsked, Tm + MIN) === 'close');
  ok('R4 booked: never closes', expiryDue(base({ stage: 'accepted', createdAt: t0 }), t0 + 5 * HOUR) === null);
  const closed = base({ stage: 'cancelled', closedQuietly: true, price: 777, helpers: 2 });
  put(closed);
  const again = sendAgain(closed);
  ok('R4 send again: same answers, open, new id', again.id !== closed.id && again.stage === 'open' && again.price === 777 && again.helpers === 2 && !again.closedQuietly);
}

// ---------- Rule 7: no confirm step, reminders ----------
{
  const T = new Date(Date.now() + 3 * 24 * HOUR);
  T.setHours(10, 0, 0, 0);
  const r = base({ stage: 'accepted', when: at(T), acceptedAt: Date.now(), driverName: 'Hassan' });
  const keys = tripPlan(r).map((s) => s.key);
  ok('R7 no confirm steps', !keys.includes('confirm') && !keys.includes('noConfirm'), keys);
  ok('R7 driver reminder the day before', tripPlan(r).some((s) => s.key === 'eve' && s.who === 'driver'));
  ok('R7 customer told the driver was reminded', tripPlan(r).some((s) => s.key === 'eveCust' && s.who === 'customer'));
}

// ---------- Rule 7b: the driver doesn't answer ----------
{
  const now = Date.now();
  const soon = base({ stage: 'accepted', when: at(new Date(now + 2 * HOUR)) });
  ok('R7b < 3 h: wait 15 min', waitMinutes(soon, now) === 15, waitMinutes(soon, now));
  const nextDay = base({ stage: 'accepted', when: at(new Date(now + 30 * HOUR)) });
  ok('R7b another day: wait 2 h', waitMinutes(nextDay, now) === 120);
  const noon = new Date(); noon.setHours(8, 0, 0, 0);
  const evening = new Date(noon); evening.setHours(20, 0, 0, 0);
  ok('R7b later the same day: wait 1 h', waitMinutes(base({ stage: 'accepted', when: at(evening) }), noon.getTime()) === 60);

  const r = base({ stage: 'accepted', driverName: 'Hassan', takenAt: now - HOUR, when: at(new Date(now + 2 * HOUR)), acceptedAt: now - HOUR });
  put(r);
  reportNoAnswer(r.id);
  const x = get(r.id);
  ok('R7b reported', !!x.noAnswerAt);
  ok('R7b waiting first', noAnswerState(x, x.noAnswerAt! + 5 * MIN) === 'waiting');
  ok('R7b then choose', noAnswerState(x, x.noAnswerAt! + 16 * MIN) === 'choose');
  ok('R7b a driver message counts as a sign', driverSign({ ...x, messages: [{ id: 'm', from: 'driver', text: 'on my way', at: x.noAnswerAt! + 1 }] }, x.noAnswerAt!));
  ok('R7b an automatic line is not a sign', !driverSign({ ...x, messages: [{ id: 'm', from: 'driver', text: 'auto', auto: true, at: x.noAnswerAt! + 1 }] }, x.noAnswerAt!));
  ok('R7b setting off is a sign', driverSign({ ...x, stage: 'enroute' }, x.noAnswerAt!));

  ok('R7b booked trip takes no offers', !takesOffers(get(r.id)));
  addOffer({ id: 'o-block', requestId: r.id, driverName: 'Karim', vehicle: 'pickup', price: 600, createdAt: now, example: false });
  ok('R7b offer refused before reopening', !getState().offers.some((o) => o.id === 'o-block'));
  letOthersOffer(r.id);
  ok('R7b reopened', takesOffers(get(r.id)) && get(r.id).stage === 'accepted' && get(r.id).driverName === 'Hassan');
  addOffer({ id: 'o-1', requestId: r.id, driverName: 'Karim', vehicle: 'pickup', price: 600, createdAt: now, example: false });
  ok('R7b other driver can offer', getState().offers.some((o) => o.id === 'o-1'));
  addOffer({ id: 'o-self', requestId: r.id, driverName: 'Hassan', vehicle: 'pickup', price: 650, createdAt: now, example: false });
  ok('R7b the first driver cannot offer on his own trip', !getState().offers.some((o) => o.id === 'o-self'));
  acceptOffer(r.id, 'o-1');
  const y = get(r.id);
  ok('R7b new driver booked', y.driverName === 'Karim' && y.price === 600 && y.stage === 'accepted' && !y.reopenedAt && !y.noAnswerAt);
  ok('R7b first driver released and noted', (y.cancelledDrivers ?? []).some((d) => d.name === 'Hassan' && d.reason === 'noAnswer'));
}

// ---------- Rule 5: commission fixed when booked ----------
{
  const r = base();
  put(r);
  update((s) => ({ ...s, commission: 0.12 }));
  addOffer({ id: 'o-c', requestId: r.id, driverName: 'Said', vehicle: 'smallVan', price: 400, createdAt: Date.now(), example: false });
  acceptOffer(r.id, 'o-c');
  update((s) => ({ ...s, commission: 0.15 }));
  ok('R5 trip keeps the rate it was booked with', get(r.id).commissionRate === 0.12, get(r.id).commissionRate);
  update((s) => ({ ...s, commission: undefined }));
}

// ---------- Rule 8: the customer's number only on the trip day ----------
{
  const today = new Date(); today.setHours(23, 30, 0, 0);
  const tomorrow = new Date(Date.now() + 24 * HOUR);
  ok('R8 booked today: trip day', tripDay(base({ stage: 'accepted', when: at(today) })));
  ok('R8 booked tomorrow: not yet', !tripDay(base({ stage: 'accepted', when: at(tomorrow) })));
  ok('R8 on the way: trip day', tripDay(base({ stage: 'enroute', when: 'now', acceptedAt: Date.now() })));
  ok('R8 finished: no more', !tripDay(base({ stage: 'delivered', when: 'now' })));
  ok('R8 numbers hidden in chat', hidePhones('call me 06 12 34 56 78') === 'call me •••• ••••', hidePhones('call me 06 12 34 56 78'));
}

// ---------- Rule 1: nobody answers at the pickup ----------
{
  const r = base({ stage: 'enroute', driverName: 'Hassan' });
  put(r);
  reportNoShow(r.id);
  ok('R1 only once arrived', !get(r.id).noShowAt);
  update((s) => ({ ...s, requests: s.requests.map((x) => (x.id === r.id ? { ...x, stage: 'arrived' } : x)) }));
  reportNoShow(r.id);
  ok('R1 reaches the customer', !!get(r.id).noShowAt && (get(r.id).messages ?? []).some((m) => m.tKey === 'ns_custMsg' && m.to === 'customer'));
}

// ---------- Rule 11: helpers ----------
{
  ok('R11 claim only at the pickup', canClaimHelpers(base({ stage: 'arrived', helpers: 2 })) && !canClaimHelpers(base({ stage: 'loaded', helpers: 2 })) && !canClaimHelpers(base({ stage: 'enroute', helpers: 2 })));
  ok('R11 no claim without helpers', !canClaimHelpers(base({ stage: 'arrived', helpers: 0 })));
  const a = base({ stage: 'arrived', helpers: 2, driverName: 'Hassan' });
  put(a);
  claimHelpersMissing(a.id);
  ok('R11 claim waits for the driver', !!get(a.id).helpersClaim && !helpersCancelFree(get(a.id)));
  answerHelpersClaim(a.id, 'yes');
  ok('R11 driver says yes: free cancel', helpersCancelFree(get(a.id)));
  update((s) => ({ ...s, custRecord: {} }));
  const b = base({ stage: 'arrived', helpers: 2, driverName: 'Hassan' });
  put(b);
  claimHelpersMissing(b.id);
  answerHelpersClaim(b.id, 'no');
  ok('R11 driver says no: not free, claim noted', !helpersCancelFree(get(b.id)) && (getState().custRecord?.wrongClaims ?? []).length === 1);
  answerHelpersClaim(b.id, 'yes');
  ok('R11 the answer cannot be changed afterwards', get(b.id).helpersClaim?.driver === 'no');
}

// ---------- Rule 10: only loads that fit ----------
{
  const d = (work: Record<string, unknown>, vehicle = 'smallVan') => ({ vehicle: vehicle as 'smallVan', work: work as never });
  const casaRabat = base({ km: 90, fromPlaceId: 'casablanca-anfa', toPlaceId: 'rabat-agdal' });
  const inCasa = base({ km: 6, fromPlaceId: 'casablanca-anfa', toPlaceId: 'casablanca-marif-extension' });
  const casaMoh = base({ km: 25, fromPlaceId: 'casablanca', toPlaceId: 'mohammedia' });
  ok('R10 city only: no trips between cities', misfit(casaRabat, d({ helpers: 'no', area: 'city', shared: false })) === 'mfFar');
  ok('R10 city only: nearby town also excluded', misfit(casaMoh, d({ helpers: 'no', area: 'city', shared: false })) === 'mfFar');
  ok('R10 city only: inside the city fits', misfit(inCasa, d({ helpers: 'no', area: 'city', shared: false })) === '');
  ok('R10 nearby: 25 km fits', misfit(casaMoh, d({ helpers: 'no', area: 'nearby', shared: false })) === '');
  ok('R10 nearby: 90 km excluded', misfit(casaRabat, d({ helpers: 'no', area: 'nearby', shared: false })) === 'mfFar');
  ok('R10 routes: Casa–Rabat fits', misfit(casaRabat, d({ helpers: 'no', area: 'routes', cities: ['casablanca', 'rabat'], shared: false })) === '');
  const casaAgadir = base({ km: 460, fromPlaceId: 'casablanca', toPlaceId: 'agadir' });
  ok('R10 routes: Casa–Agadir excluded', misfit(casaAgadir, d({ helpers: 'no', area: 'routes', cities: ['casablanca', 'rabat'], shared: false })) === 'mfRoute');
  ok('R10 everywhere: Casa–Agadir fits', misfit(casaAgadir, d({ helpers: 'no', area: 'everywhere', shared: false })) === '');
  const h3 = base({ helpers: 3, km: 6, fromPlaceId: 'casablanca-anfa', toPlaceId: 'casablanca-marif-extension' });
  ok('R10 no helpers: excluded', misfit(h3, d({ helpers: 'no', area: 'everywhere', shared: false })) === 'mfHelpers');
  ok('R10 brings 2, needs 3: excluded', misfit(h3, d({ helpers: 'yes', helperCount: 2, area: 'everywhere', shared: false })) === 'mfHelpers');
  ok('R10 brings 3, needs 3: fits', misfit(h3, d({ helpers: 'yes', helperCount: 3, area: 'everywhere', shared: false })) === '');
  ok('R10 brings 4+: fits 5', misfit({ ...h3, helpers: 5 }, d({ helpers: 'yes', helperCount: 4, area: 'everywhere', shared: false })) === '');
  ok('R10 depends: shown (he confirms on the offer)', misfit(h3, d({ helpers: 'depends', area: 'everywhere', shared: false })) === '');
  const cover = { ...inCasa, noteTags: ['cover'] };
  ok('R10 covering asked, he does not cover: excluded', misfit(cover, d({ helpers: 'no', area: 'everywhere', shared: false })) === 'mfCover');
  ok('R10 covering asked, he covers: fits', misfit(cover, d({ helpers: 'no', area: 'everywhere', skills: ['wrap'], shared: false })) === '');
  ok('R10 too heavy for a motorcycle', misfit({ ...inCasa, weightKg: 80 }, d({ helpers: 'no', area: 'everywhere', shared: false }, 'motorcycle')) === 'mfHeavy');
  ok('R9 routes needs 2 cities', !workDone({ helpers: 'no', area: 'routes', cities: ['casablanca'], shared: true }) && workDone({ helpers: 'no', area: 'routes', cities: ['casablanca', 'rabat'], shared: true }));
  ok('R9 covering: included or extra must be answered', !workDone({ helpers: 'no', area: 'city', shared: true, skills: ['wrap'] }) && workDone({ helpers: 'no', area: 'city', shared: true, skills: ['wrap'], coverExtra: false }));
}

// ---------- Rule 9: sign-up order, papers last ----------
{
  const p = { name: 'Ali', vehicle: 'smallVan' as const };
  ok('R9 name alone is not enough (driver or company?)', !nameDone(p));
  ok('R9 driver: name + type', nameDone({ ...p, accountType: 'driver' }));
  ok('R9 company needs its name', !nameDone({ ...p, accountType: 'company' }, '') && nameDone({ ...p, accountType: 'company' }, 'Atlas Moving'));
  ok('R9 driver needs a photo', !youDone({ ...p, accountType: 'driver', phone: '0612345678', plate: '1-A-2', signedUpAt: 1 }) && youDone({ ...p, accountType: 'driver', phone: '0612345678', plate: '1-A-2', photoUri: 'x', signedUpAt: 1 }));
  ok('R9 the step ends only with Continue', !youDone({ ...p, accountType: 'driver', phone: '0612345678', plate: '1-A-2', photoUri: 'x' }));
  ok('R9 company photo optional', youDone({ ...p, accountType: 'company', phone: '0612345678', plate: '1-A-2', signedUpAt: 1 }));
  ok('R9 no offers before papers', !canOffer({ ...p, accountType: 'driver', signedUpAt: 1 }));
  ok('R9 offers once papers are sent', canOffer({ ...p, accountType: 'driver', papersSentAt: 1 }));
  const all = { license: 'a', registration: 'b', insurance: 'c', idCard: 'd' };
  ok('R9 driver papers complete', papersDone({ ...p, accountType: 'driver', papers: all }) && !papersDone({ ...p, accountType: 'driver', papers: { license: 'a' } }));
  ok('R12 company papers need the logo', !papersDone({ ...p, accountType: 'company', papers: all }, { papers: { ice: '1', rc: '2', managerId: '3' } }) && papersDone({ ...p, accountType: 'company', papers: all }, { papers: { ice: '1', rc: '2', managerId: '3' }, logoUri: 'l' }));
}

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log('FAIL', f);
process.exit(fails.length ? 1 : 0);
