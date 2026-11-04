import { newId, type Store } from '@/backend/store';
import type {
  ChatEvent,
  ClientRecord,
  CompanySettings,
  Invoice,
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
import { companyIdentity, withDefaults } from '@/constants/company';
import { dueDate, invoiceNumber, shareOf, totals, weekKey, weeksToInvoice } from '@/lib/invoices';
import type { VehicleId } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { deliveryCode, isLateCancel, lateMinutes, reliability } from '@/lib/trip';
import type { Eta } from '@/state/driver';
import { tripEstimate, type RequestDraft } from '@/state/request-draft';

export type Account = { id: string; name: string; phone: string };

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

/**
 * The client picks an offer: creates the job and closes the other offers. Nothing is charged:
 * the client pays the driver in cash, and the app's share (at today's rate) goes on the
 * driver's weekly invoice once the trip is completed.
 */
export async function acceptOffer(store: Store, request: FreightRequest, offer: Offer, allOffers: Offer[]) {
  const jobId = newId('j');
  const company = withDefaults(await store.get('settings', 'company'));
  const commission = shareOf(offer.price, company.commissionRate);
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
    await store.update('drivers', driver.id, { stats: { ...stats, accepted: stats.accepted + 1 } });
  }
  await postEvent(store, jobId, scheduled ? 'bookedScheduled' : 'booked', {
    driver: offer.driverName,
    price: offer.price,
    ...(scheduled ? { at: scheduled } : {}),
  });
  return jobId;
}

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

/** Driver at the drop-off: the client's code completes the trip in one step. */
export async function deliverWithCode(store: Store, job: Job, code: string) {
  if (code !== job.deliveryCode) return false;
  const now = Date.now();
  const delivered = { ...job, status: 'delivered' as const, timeline: { ...job.timeline, delivered: now } };
  await store.update('jobs', job.id, { status: 'delivered', timeline: delivered.timeline });
  await postEvent(store, job.id, 'delivered');
  await advanceJob(store, delivered, 'completed');
  return true;
}

export async function moveDriver(store: Store, jobId: string, position: LatLng, simulated: boolean) {
  await store.update('jobs', jobId, { driverPos: position, driverPosAt: Date.now(), simulated });
}

/**
 * Cancelling before loading. Nothing is owed for a cancelled trip. A client cancel closes
 * the request; a driver cancel reopens the request and counts against
 * the driver's reliability (more so when it is a late cancel of a booking).
 */
export async function cancelJob(store: Store, job: Job, by: 'client' | 'driver') {
  await store.update('jobs', job.id, { status: 'cancelled', cancelledBy: by, timeline: { ...job.timeline, cancelled: Date.now() } });
  await store.update('offers', job.offerId, { status: 'withdrawn' });
  await store.update('requests', job.requestId, by === 'client' ? { status: 'cancelled' } : { status: 'open', jobId: null });
  await postEvent(store, job.id, by === 'client' ? 'cancelledByClient' : 'cancelledByDriver');
  const driver = await store.get('drivers', job.driverId);
  if (driver && by === 'driver') {
    const stats = normalizeDriver(driver).stats;
    const late = isLateCancel(job.scheduledAt ? fromLocalString(job.scheduledAt).getTime() : Date.now(), Date.now());
    await store.update('drivers', driver.id, {
      stats: late ? { ...stats, lateCancels: stats.lateCancels + 1 } : { ...stats, cancelled: stats.cancelled + 1 },
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
  await store.set('messages', id, { id, jobId, at: Date.now(), from, kind, text: content.text ?? '', ...content });
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

/** Completed trips the driver still owes the app's share on (not yet on an invoice). */
export function unbilledJobs(jobs: Job[]) {
  return jobs.filter((job) => job.status === 'completed' && !job.invoiceId && job.commission > 0);
}

const completedAt = (job: Job) => job.timeline.completed ?? job.timeline.delivered ?? job.createdAt;

/**
 * Issues the weekly invoices a driver is due: one per finished week (Monday to Sunday) with
 * completed trips not yet billed. `closeThisWeek` (test mode) also bills the current week
 * so far. Each trip is billed once: it's marked with its invoice.
 */
export async function issueInvoices(store: Store, driver: Pick<DriverRecord, 'id' | 'name' | 'phone'>, jobs: Job[], closeThisWeek = false) {
  const settings = withDefaults(await store.get('settings', 'company'));
  const pending = unbilledJobs(jobs);
  const byId = new Map(pending.map((job) => [job.id, job]));
  const weeks = weeksToInvoice(
    pending.map((job) => ({ id: job.id, price: job.price, share: job.commission, completedAt: completedAt(job) })),
    Date.now(),
    closeThisWeek,
  );
  const issued: Invoice[] = [];
  for (const { week, jobs: billable } of weeks) {
    // A week already billed early (test) gets a second invoice for the trips after it.
    let extra = 0;
    let id = `inv_${driver.id}_${week}`;
    while (await store.get('invoices', id)) {
      extra += 1;
      id = `inv_${driver.id}_${week}_${extra + 1}`;
    }
    const lines = billable.map((line) => {
      const job = byId.get(line.id)!;
      return { jobId: job.id, completedAt: line.completedAt, from: job.from, to: job.to, price: job.price, share: job.commission };
    });
    const sum = totals(lines);
    const invoice: Invoice = {
      id,
      number: invoiceNumber(week, driver.id, extra ? extra + 1 : 0),
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      week,
      issuedAt: Date.now(),
      dueAt: dueDate(week, settings),
      lines,
      totalPrice: sum.price,
      totalShare: sum.share,
      status: 'open',
      paymentSentAt: null,
      paymentMethod: null,
      paymentReference: '',
      paidAt: null,
      rejectedAt: null,
      company: companyIdentity(settings),
      test: closeThisWeek && week === weekKey(Date.now()),
    };
    await store.set('invoices', id, invoice);
    for (const line of lines) await store.update('jobs', line.jobId, { invoiceId: id });
    issued.push(invoice);
  }
  return issued;
}

/** The driver says they paid (bank transfer or cash), with the reference from their receipt. */
export async function reportInvoicePayment(store: Store, invoice: Invoice, method: 'transfer' | 'cash', reference: string) {
  await store.update('invoices', invoice.id, { status: 'paymentSent', paymentSentAt: Date.now(), paymentMethod: method, paymentReference: reference.trim() });
}

/** The company received the money. */
export async function confirmInvoicePaid(store: Store, invoice: Invoice) {
  await store.update('invoices', invoice.id, { status: 'paid', paidAt: Date.now() });
}

/** The company didn't receive a reported payment: the invoice is open again. */
export async function rejectInvoicePayment(store: Store, invoice: Invoice) {
  await store.update('invoices', invoice.id, { status: 'open', rejectedAt: Date.now() });
}

export async function saveCompanySettings(store: Store, settings: CompanySettings) {
  await store.set('settings', 'company', { ...settings, id: 'company', updatedAt: Date.now() });
}
