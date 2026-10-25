import { newId, type Store } from '@/backend/store';
import type { DriverRecord, FreightRequest, Job, JobStatus, Offer, Rating } from '@/backend/types';
import type { LatLng } from '@/lib/geo';
import { commissionSplit, type VehicleId } from '@/lib/pricing';
import type { Eta } from '@/state/driver';
import { tripEstimate, type RequestDraft } from '@/state/request-draft';

export type Account = { id: string; name: string; phone: string };

/** New drivers get test credit so they can try sending offers right away. */
export const TEST_CREDIT = 500;

export async function ensureClient(store: Store, account: Account) {
  const existing = await store.get('clients', account.id);
  if (!existing) await store.set('clients', account.id, { ...account, rating: 5, ratingCount: 0 });
  else if (existing.name !== account.name || existing.phone !== account.phone)
    await store.update('clients', account.id, { name: account.name, phone: account.phone });
}

export async function ensureDriver(
  store: Store,
  account: Account,
  vehicle: { type: VehicleId; plate: string; homeCity: string },
) {
  const existing = await store.get('drivers', account.id);
  const profile = { name: account.name, phone: account.phone, vehicle: vehicle.type, plate: vehicle.plate, homeCity: vehicle.homeCity };
  if (!existing) {
    const record: DriverRecord = {
      id: account.id,
      ...profile,
      rating: 5,
      ratingCount: 0,
      trips: 0,
      wallet: TEST_CREDIT,
      walletHistory: [{ at: Date.now(), amount: TEST_CREDIT, reason: 'testCredit' }],
    };
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
    freightType: draft.freightType,
    tons: draft.tons,
    helpers: draft.helpers,
    pickup: draft.pickup,
    dropoff: draft.dropoff,
    itemOptions: draft.itemOptions,
    notes: draft.notes,
    vehicle: draft.vehicle,
    when: draft.when,
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

export async function sendOffer(store: Store, driver: DriverRecord, request: FreightRequest, price: number, eta: Eta) {
  const id = `${request.id}_${driver.id}`;
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
  };
  await store.set('offers', id, offer);
  return id;
}

export async function setOfferStatus(store: Store, offerId: string, status: Offer['status']) {
  await store.update('offers', offerId, { status });
}

/** The client picks an offer: creates the job, closes the other offers, takes the commission. */
export async function acceptOffer(store: Store, request: FreightRequest, offer: Offer, allOffers: Offer[]) {
  const jobId = newId('j');
  const { commission } = commissionSplit(offer.price);
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
    status: 'toPickup',
    timeline: { toPickup: Date.now() },
    driverPos: null,
    driverPosAt: null,
    simulated: false,
    clientRating: null,
    driverRating: null,
    cancelledBy: null,
  };
  await store.set('jobs', jobId, job);
  await store.update('offers', offer.id, { status: 'accepted' });
  for (const other of allOffers) {
    if (other.id !== offer.id && other.status === 'pending') await store.update('offers', other.id, { status: 'declined' });
  }
  await store.update('requests', request.id, { status: 'assigned', jobId });
  const driver = await store.get('drivers', offer.driverId);
  if (driver) {
    await store.update('drivers', driver.id, {
      wallet: driver.wallet - commission,
      walletHistory: [...driver.walletHistory, { at: Date.now(), amount: -commission, reason: 'commission', jobId }],
    });
  }
  return jobId;
}

export async function advanceJob(store: Store, job: Job, status: JobStatus) {
  await store.update('jobs', job.id, { status, timeline: { ...job.timeline, [status]: Date.now() } });
  if (status === 'completed') {
    await store.update('requests', job.requestId, { status: 'completed' });
    const driver = await store.get('drivers', job.driverId);
    if (driver) await store.update('drivers', driver.id, { trips: driver.trips + 1 });
  }
}

export async function moveDriver(store: Store, jobId: string, position: LatLng, simulated: boolean) {
  await store.update('jobs', jobId, { driverPos: position, driverPosAt: Date.now(), simulated });
}

/**
 * Cancelling before loading. A client cancel closes the request and refunds the
 * driver's commission; a driver cancel reopens the request for other drivers.
 */
export async function cancelJob(store: Store, job: Job, by: 'client' | 'driver') {
  await store.update('jobs', job.id, { status: 'cancelled', cancelledBy: by, timeline: { ...job.timeline, cancelled: Date.now() } });
  await store.update('offers', job.offerId, { status: 'withdrawn' });
  await store.update('requests', job.requestId, by === 'client' ? { status: 'cancelled' } : { status: 'open', jobId: null });
  const driver = await store.get('drivers', job.driverId);
  if (driver) {
    await store.update('drivers', driver.id, {
      wallet: driver.wallet + job.commission,
      walletHistory: [...driver.walletHistory, { at: Date.now(), amount: job.commission, reason: 'refund', jobId: job.id }],
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
      await store.update('drivers', driver.id, {
        rating: Math.round(((driver.rating * driver.ratingCount + rating.stars) / count) * 10) / 10,
        ratingCount: count,
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

export async function sendMessage(store: Store, jobId: string, from: 'client' | 'driver', text: string) {
  const id = newId('m');
  await store.set('messages', id, { id, jobId, at: Date.now(), from, text });
}

export async function addTestCredit(store: Store, driver: DriverRecord, amount: number) {
  await store.update('drivers', driver.id, {
    wallet: driver.wallet + amount,
    walletHistory: [...driver.walletHistory, { at: Date.now(), amount, reason: 'testCredit' }],
  });
}
