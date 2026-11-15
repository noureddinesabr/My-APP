import { newId, type Store } from '@/backend/store';
import type {
  ChatEvent,
  ClientRecord,
  DriverRecord,
  FreightRequest,
  Job,
  JobStatus,
  Media,
  Message,
  Offer,
  Rating,
} from '@/backend/types';
import type { LatLng } from '@/lib/geo';
import { commissionSplit, type VehicleId } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { FREE_REASONS, hidePhones } from '@/lib/rules';
import { deliveryCode, isLateCancel, lateMinutes, reliability } from '@/lib/trip';
import type { Eta } from '@/state/driver';
import { tripEstimate, type RequestDraft } from '@/state/request-draft';

export type Account = { id: string; name: string; phone: string };

/** New drivers get test credit so they can try sending offers right away. */
export const TEST_CREDIT = 500;

const EMPTY_STATS = { accepted: 0, cancelled: 0, lateCancels: 0, late: 0, onTime: 0 };

/** Fills fields added after a record was first saved. */
export function normalizeDriver(record: DriverRecord): DriverRecord {
  return {
    ...record,
    photo: record.photo ?? null,
    email: record.email ?? '',
    stats: { ...EMPTY_STATS, ...record.stats },
    compliments: record.compliments ?? {},
    joinedAt: record.joinedAt ?? Date.now(),
  };
}

export function normalizeClient(record: ClientRecord): ClientRecord {
  return {
    ...record,
    photo: record.photo ?? null,
    email: record.email ?? '',
    company: record.company ?? '',
    trips: record.trips ?? 0,
    savedPlaces: record.savedPlaces ?? [],
    joinedAt: record.joinedAt ?? Date.now(),
  };
}

export function normalizeJob(job: Job): Job {
  return {
    ...job,
    scheduledAt: job.scheduledAt ?? null,
    deliveryCode: job.deliveryCode ?? '0000',
    clientPhoto: job.clientPhoto ?? null,
    driverPhoto: job.driverPhoto ?? null,
    remindersSent: job.remindersSent ?? [],
    clientReadAt: job.clientReadAt ?? 0,
    driverReadAt: job.driverReadAt ?? 0,
    helpers: job.helpers ?? 0,
    takenAt: job.takenAt ?? null,
    priceAsk: job.priceAsk ?? null,
    helpersCame: job.helpersCame ?? null,
    cancelReason: job.cancelReason ?? null,
    problem: job.problem ?? null,
  };
}

export async function ensureClient(store: Store, account: Account) {
  const existing = await store.get('clients', account.id);
  if (!existing) {
    await store.set(
      'clients',
      account.id,
      normalizeClient({ ...account, rating: 5, ratingCount: 0 } as ClientRecord),
    );
  } else if (existing.name !== account.name || existing.phone !== account.phone) {
    await store.update('clients', account.id, { name: account.name, phone: account.phone });
  }
}

export async function ensureDriver(
  store: Store,
  account: Account,
  vehicle: { type: VehicleId; plate: string; homeCity: string },
) {
  const existing = await store.get('drivers', account.id);
  const profile = { name: account.name, phone: account.phone, vehicle: vehicle.type, plate: vehicle.plate, homeCity: vehicle.homeCity };
  if (!existing) {
    const record = normalizeDriver({
      id: account.id,
      ...profile,
      rating: 5,
      ratingCount: 0,
      trips: 0,
      wallet: TEST_CREDIT,
      walletHistory: [{ at: Date.now(), amount: TEST_CREDIT, reason: 'testCredit' }],
    } as DriverRecord);
    await store.set('drivers', account.id, record);
  } else if (
    existing.name !== profile.name ||
    existing.phone !== profile.phone ||
    existing.vehicle !== profile.vehicle ||
    existing.plate !== profile.plate ||
    existing.homeCity !== profile.homeCity
  ) {
    await store.update('drivers', account.id, profile);
  }
}

export async function updateClientProfile(store: Store, id: string, patch: Partial<ClientRecord>) {
  await store.update('clients', id, patch);
}

export async function updateDriverProfile(store: Store, id: string, patch: Partial<DriverRecord>) {
  await store.update('drivers', id, patch);
}

export async function publishRequest(store: Store, account: Account, draft: RequestDraft) {
  const id = newId('r');
  const request: FreightRequest = {
    id,
    createdAt: Date.now(),
    clientId: account.id,
    clientName: account.name,
    clientPhone: account.phone,
    from: draft.from,
    fromDetails: draft.fromDetails,
    to: draft.to,
    toDetails: draft.toDetails,
    freightType: draft.freightTypes[0] ?? draft.freightType,
    freightTypes: draft.freightTypes,
    tons: draft.tons,
    weightKnown: draft.weightKnown,
    helpers: draft.helpers,
    pickup: draft.pickup,
    dropoff: draft.dropoff,
    itemOptions: draft.itemOptions,
    notes: draft.notes,
    voiceNote: draft.voiceNote,
    media: draft.media,
    vehicle: draft.vehicle,
    when: draft.when,
    pickupWindow: draft.when === 'now' ? draft.pickupWindow : undefined,
    rideAlong: draft.rideAlong,
    scheduledAt: draft.when === 'scheduled' ? draft.scheduledAt : null,
    price: draft.price,
    km: tripEstimate(draft).km,
    status: 'open',
    jobId: null,
  };
  await store.set('requests', id, request);
  return id;
}

export async function cancelRequest(store: Store, request: FreightRequest) {
  await store.update('requests', request.id, { status: 'cancelled' });
}

export async function sendOffer(
  store: Store,
  driver: DriverRecord,
  request: FreightRequest,
  price: number,
  eta: Eta,
  committed: boolean,
) {
  const id = `${request.id}_${driver.id}`;
  const record = normalizeDriver(driver);
  const offer: Offer = {
    id,
    requestId: request.id,
    clientId: request.clientId,
    createdAt: Date.now(),
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    vehicle: driver.vehicle,
    plate: driver.plate,
    rating: driver.rating,
    trips: driver.trips,
    price,
    eta,
    status: 'pending',
    driverPhoto: record.photo,
    reliability: reliability(record.stats),
    committed,
  };
  await store.set('offers', id, offer);
  return id;
}

export async function setOfferStatus(store: Store, offerId: string, status: Offer['status']) {
  await store.update('offers', offerId, { status });
}

/** Writes a trip event into the chat, so both sides see the same story. */
export async function postEvent(store: Store, jobId: string, event: ChatEvent, params?: Message['params']) {
  const id = newId('m');
  await store.set('messages', id, { id, jobId, at: Date.now(), from: 'system', kind: 'event', text: '', event, ...(params ? { params } : {}) });
}

/** The client picks an offer: creates the job, closes the other offers, takes the commission. */
export async function acceptOffer(store: Store, request: FreightRequest, offer: Offer, allOffers: Offer[]) {
  const jobId = newId('j');
  const { commission } = commissionSplit(offer.price);
  const client = await store.get('clients', request.clientId);
  const scheduled = request.scheduledAt;
  const job: Job = {
    id: jobId,
    requestId: request.id,
    offerId: offer.id,
    createdAt: Date.now(),
    clientId: request.clientId,
    clientName: request.clientName,
    clientPhone: request.clientPhone,
    driverId: offer.driverId,
    driverName: offer.driverName,
    driverPhone: offer.driverPhone,
    vehicle: offer.vehicle,
    plate: offer.plate,
    price: offer.price,
    commission,
    from: request.from,
    to: request.to,
    km: request.km,
    status: scheduled ? 'scheduled' : 'toPickup',
    timeline: { [scheduled ? 'scheduled' : 'toPickup']: Date.now() },
    driverPos: null,
    driverPosAt: null,
    simulated: false,
    clientRating: null,
    driverRating: null,
    cancelledBy: null,
    scheduledAt: scheduled,
    deliveryCode: deliveryCode(),
    clientPhoto: client?.photo ?? null,
    driverPhoto: offer.driverPhoto ?? null,
    remindersSent: [],
    clientReadAt: 0,
    driverReadAt: 0,
    helpers: request.helpers,
    takenAt: null,
    priceAsk: null,
    helpersCame: null,
    cancelReason: null,
    problem: null,
  };
  await store.set('jobs', jobId, job);
  await store.update('offers', offer.id, { status: 'accepted' });
  for (const other of allOffers) {
    if (other.id !== offer.id && other.status === 'pending') await store.update('offers', other.id, { status: 'declined' });
  }
  await store.update('requests', request.id, { status: 'assigned', jobId });
  const driver = await store.get('drivers', offer.driverId);
  if (driver) {
    const stats = normalizeDriver(driver).stats;
    await store.update('drivers', driver.id, {
      wallet: driver.wallet - commission,
      walletHistory: [...driver.walletHistory, { at: Date.now(), amount: -commission, reason: 'commission', jobId }],
      stats: { ...stats, accepted: stats.accepted + 1 },
    });
  }
  await postEvent(store, jobId, scheduled ? 'bookedScheduled' : 'booked', {
    driver: offer.driverName,
    price: offer.price,
    ...(scheduled ? { at: scheduled } : {}),
  });
  await postAuto(store, jobId, scheduled ? 'autoBookedLater' : 'autoBookedNow', scheduled ? { at: scheduled } : undefined);
  return jobId;
}

/**
 * A message the app writes for the driver at each step (marked "automatic"), so the customer
 * always hears from him even while he drives. Stored as a key, shown in the reader's language.
 */
export async function postAuto(store: Store, jobId: string, key: string, params?: Message['params']) {
  const id = newId('m');
  await store.set('messages', id, { id, jobId, at: Date.now() + 1, from: 'driver', kind: 'text', text: '', auto: key, ...(params ? { params } : {}) });
}

/** Test version: the support team answers from launch; this line says so after the first message. */
export async function postSupportAuto(store: Store, threadId: string) {
  const id = newId('m');
  await store.set('messages', id, { id, jobId: threadId, at: Date.now() + 5, from: 'system', kind: 'text', text: '', auto: 'supportAuto' });
}

const AUTO: Partial<Record<JobStatus, string>> = {
  toPickup: 'autoOnWay',
  atPickup: 'autoArrived',
  inTransit: 'autoLoaded',
  atDropoff: 'autoAtDest',
};

const EVENTS: Partial<Record<JobStatus, ChatEvent>> = {
  toPickup: 'started',
  atPickup: 'arrivedPickup',
  inTransit: 'leftPickup',
  atDropoff: 'arrivedDropoff',
  delivered: 'delivered',
  completed: 'completed',
};

/** Moves the trip to a new status, records it in the chat and keeps the driver's on-time stats. */
export async function advanceJob(store: Store, job: Job, status: JobStatus) {
  if (job.status === status) return;
  const now = Date.now();
  await store.update('jobs', job.id, { status, timeline: { ...job.timeline, [status]: now } });
  const event = EVENTS[status];
  const late = status === 'atPickup' ? lateMinutes(job.scheduledAt ? fromLocalString(job.scheduledAt).getTime() : null, now) : 0;
  if (event) await postEvent(store, job.id, event, late ? { minutes: late } : undefined);
  const auto = AUTO[status];
  if (auto) await postAuto(store, job.id, auto);
  // Once the load is on board, an open price question ends and the agreed price stays.
  if (status === 'inTransit' && job.priceAsk) {
    await store.update('jobs', job.id, { priceAsk: null });
    await postEvent(store, job.id, 'priceExpired', { price: job.priceAsk.agreed });
  }

  if (status === 'atPickup' && job.scheduledAt) {
    const driver = await store.get('drivers', job.driverId);
    if (driver) {
      const stats = normalizeDriver(driver).stats;
      await store.update('drivers', driver.id, { stats: late ? { ...stats, late: stats.late + 1 } : { ...stats, onTime: stats.onTime + 1 } });
    }
  }
  if (status === 'completed') {
    await store.update('requests', job.requestId, { status: 'completed' });
    const driver = await store.get('drivers', job.driverId);
    if (driver) await store.update('drivers', driver.id, { trips: driver.trips + 1 });
    const client = await store.get('clients', job.clientId);
    if (client) await store.update('clients', client.id, { trips: (client.trips ?? 0) + 1 });
  }
}

/** The driver taps "Handed over" at the destination: the client is asked to confirm. */
export async function handOver(store: Store, job: Job) {
  if (job.status === 'delivered' || job.status === 'completed') return;
  const now = Date.now();
  await store.update('jobs', job.id, { status: 'delivered', timeline: { ...job.timeline, delivered: now } });
  await postEvent(store, job.id, 'handedOver', { driver: job.driverName });
}

/** The client confirms they received the load (with an optional problem); the trip is done. */
export async function confirmReceived(store: Store, job: Job, problem?: string) {
  const text = problem?.trim();
  if (text) await store.update('jobs', job.id, { problem: text });
  await postEvent(store, job.id, text ? 'receivedProblem' : 'received', text ? { text } : undefined);
  const delivered = job.status === 'delivered' ? job : { ...job, status: 'delivered' as const, timeline: { ...job.timeline, delivered: Date.now() } };
  await advanceJob(store, delivered, 'completed');
}

/** A booking: the driver confirms "I take this trip" before he can set off. */
export async function takeTrip(store: Store, job: Job) {
  await store.update('jobs', job.id, { takenAt: Date.now() });
  await postEvent(store, job.id, 'taken', { driver: job.driverName });
}

/** The client says whether the helpers came. Fewer: the driver is told in the chat. */
export async function answerHelpers(store: Store, job: Job, came: 'yes' | 'fewer') {
  await store.update('jobs', job.id, { helpersCame: came });
  if (came === 'fewer') await postEvent(store, job.id, 'helpersFewer', { n: job.helpers ?? 0 });
}

/**
 * «Update the price»: the driver only, after taking the trip and before loading, with a reason
 * in his own words (it goes to the chat). The customer accepts, suggests another price, keeps
 * the agreed price or cancels for free; the driver answers a counter the same way. Unlimited rounds.
 */
export async function askPrice(store: Store, job: Job, price: number, reason: string) {
  if (reason.trim()) await sendMessage(store, job.id, 'driver', { text: reason.trim() });
  await store.update('jobs', job.id, { priceAsk: { by: 'driver', price, agreed: job.price, driverPrice: price, at: Date.now() } });
  await postEvent(store, job.id, 'priceAsked', { driver: job.driverName, price, old: job.price });
}

export async function counterPrice(store: Store, job: Job, price: number) {
  if (!job.priceAsk) return;
  await store.update('jobs', job.id, { priceAsk: { ...job.priceAsk, by: 'client', price, at: Date.now() } });
  await postEvent(store, job.id, 'priceCountered', { price });
}

/** The driver keeps his own price after the client's counter. */
export async function keepMyPrice(store: Store, job: Job) {
  if (!job.priceAsk) return;
  const ask = job.priceAsk;
  await store.update('jobs', job.id, { priceAsk: { ...ask, by: 'driver', price: ask.driverPrice, at: Date.now() } });
  await postEvent(store, job.id, 'priceAsked', { driver: job.driverName, price: ask.driverPrice, old: ask.agreed });
}

/** Either side accepts the price on the table: it becomes the trip's price (commission follows). */
export async function agreePrice(store: Store, job: Job) {
  if (!job.priceAsk) return;
  const price = job.priceAsk.price;
  const { commission } = commissionSplit(price);
  await store.update('jobs', job.id, { price, commission, priceAsk: null });
  const driver = await store.get('drivers', job.driverId);
  const diff = commission - job.commission;
  if (driver && diff) {
    await store.update('drivers', driver.id, {
      wallet: driver.wallet - diff,
      walletHistory: [...driver.walletHistory, { at: Date.now(), amount: -diff, reason: diff > 0 ? 'commission' : 'refund', jobId: job.id }],
    });
  }
  await postEvent(store, job.id, 'priceAgreed', { price });
}

/** Back to the price agreed before. */
export async function keepPrice(store: Store, job: Job) {
  if (!job.priceAsk) return;
  await store.update('jobs', job.id, { priceAsk: null });
  await postEvent(store, job.id, 'priceKept', { price: job.priceAsk.agreed });
}

/** The driver read "Our promises to each other" and agreed. */
export async function agreeRules(store: Store, driverId: string) {
  await store.update('drivers', driverId, { rulesAt: Date.now() });
}

export async function moveDriver(store: Store, jobId: string, position: LatLng, simulated: boolean) {
  await store.update('jobs', jobId, { driverPos: position, driverPosAt: Date.now(), simulated });
}

/**
 * Cancelling before loading. A client cancel closes the request and refunds the
 * driver's commission; a driver cancel reopens the request and counts against
 * the driver's reliability (more so when it is a late cancel of a booking).
 */
export async function cancelJob(store: Store, job: Job, by: 'client' | 'driver', reason = '') {
  const now = Date.now();
  await store.update('jobs', job.id, { status: 'cancelled', cancelledBy: by, cancelReason: reason || null, priceAsk: null, timeline: { ...job.timeline, cancelled: now } });
  await store.update('offers', job.offerId, { status: 'withdrawn' });
  if (by === 'client') await store.update('requests', job.requestId, { status: 'cancelled' });
  else {
    // Back to the other drivers; this one no longer sees it.
    const request = await store.get('requests', job.requestId);
    await store.update('requests', job.requestId, { status: 'open', jobId: null, cancelledDrivers: [...(request?.cancelledDrivers ?? []), job.driverId] });
  }
  await postEvent(store, job.id, by === 'client' ? 'cancelledByClient' : 'cancelledByDriver', reason ? { reason, driver: job.driverName } : { driver: job.driverName });
  const driver = await store.get('drivers', job.driverId);
  if (driver) {
    const stats = normalizeDriver(driver).stats;
    const late = isLateCancel(job.scheduledAt ? fromLocalString(job.scheduledAt).getTime() : now, now);
    // Price no-deals and helpers who didn't come never count against anyone.
    const counts = by === 'driver' && !FREE_REASONS.includes(reason);
    await store.update('drivers', driver.id, {
      wallet: driver.wallet + job.commission,
      walletHistory: [...driver.walletHistory, { at: now, amount: job.commission, reason: 'refund', jobId: job.id }],
      ...(counts
        ? {
            stats: late ? { ...stats, lateCancels: stats.lateCancels + 1 } : { ...stats, cancelled: stats.cancelled + 1 },
            cancels: [...(driver.cancels ?? []), now],
          }
        : {}),
    });
  }
}

/** Each side rates the other once the trip is done. */
export async function rateJob(store: Store, job: Job, by: 'client' | 'driver', rating: Rating) {
  await store.update('jobs', job.id, by === 'client' ? { clientRating: rating } : { driverRating: rating });
  if (by === 'client') {
    const driver = await store.get('drivers', job.driverId);
    if (driver) {
      const count = driver.ratingCount + 1;
      const compliments = { ...(driver.compliments ?? {}) };
      for (const tag of rating.tags) compliments[tag] = (compliments[tag] ?? 0) + 1;
      await store.update('drivers', driver.id, {
        rating: Math.round(((driver.rating * driver.ratingCount + rating.stars) / count) * 10) / 10,
        ratingCount: count,
        compliments,
      });
    }
  } else {
    const client = await store.get('clients', job.clientId);
    if (client) {
      const count = client.ratingCount + 1;
      await store.update('clients', client.id, {
        rating: Math.round(((client.rating * client.ratingCount + rating.stars) / count) * 10) / 10,
        ratingCount: count,
      });
    }
  }
}

export async function sendMessage(
  store: Store,
  jobId: string,
  from: 'client' | 'driver',
  content: { text?: string; location?: LatLng; photo?: string; media?: Media },
) {
  const id = newId('m');
  const kind = content.location ? 'location' : content.photo ? 'photo' : (content.media?.kind ?? 'text');
  // Phone numbers stay out of the chat: calls go through the call button.
  const { text, hidden } = hidePhones(content.text ?? '');
  await store.set('messages', id, { id, jobId, at: Date.now(), from, kind, ...content, text, ...(hidden ? { phoneHidden: true } : {}) });
  return { hidden };
}

/** Records that this side has seen the chat up to now. */
export async function markRead(store: Store, job: Job, role: 'client' | 'driver') {
  await store.update('jobs', job.id, role === 'client' ? { clientReadAt: Date.now() } : { driverReadAt: Date.now() });
}

export async function markReminders(store: Store, job: Job, ids: string[]) {
  const sent = Array.from(new Set([...(job.remindersSent ?? []), ...ids]));
  await store.update('jobs', job.id, { remindersSent: sent });
}

/** Test mode: move a booking's pickup time to `minutes` from now, to try reminders and departure. */
export async function testReschedule(store: Store, job: Job, minutes: number) {
  const at = new Date(Date.now() + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const value = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
  await store.update('jobs', job.id, { scheduledAt: value, remindersSent: [] });
}

export async function addTestCredit(store: Store, driver: DriverRecord, amount: number) {
  await store.update('drivers', driver.id, {
    wallet: driver.wallet + amount,
    walletHistory: [...driver.walletHistory, { at: Date.now(), amount, reason: 'testCredit' }],
  });
}

/** The client changes the price of a request while waiting for offers. */
export async function updateRequestPrice(store: Store, request: FreightRequest, price: number) {
  await store.update('requests', request.id, { price });
}

/** The client suggests another price on a driver's offer; the driver accepts it or keeps his own. */
export async function counterOffer(store: Store, offer: Offer, price: number) {
  await store.update('offers', offer.id, { status: 'countered', counter: price, agreedCounter: false });
}

/** The driver answers the client's counter-price: agree (the offer takes it) or keep his price. */
export async function answerCounter(store: Store, offer: Offer, agree: boolean) {
  if (offer.status !== 'countered' || !offer.counter) return;
  await store.update(
    'offers',
    offer.id,
    agree ? { status: 'pending', price: offer.counter, counter: null, agreedCounter: true } : { status: 'pending', counter: null, agreedCounter: false },
  );
}
