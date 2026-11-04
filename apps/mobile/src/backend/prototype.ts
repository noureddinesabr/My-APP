/**
 * Phase 2 PROTOTYPE actions: driver routes, route bookings (dedicated / shared), return
 * journeys, disputes, notifications and admin interventions. They write to the same store
 * as the rest of the preview so the customer, driver and admin screens see each other live,
 * but they are prototype state: no money moves and nothing is a real transaction. The real
 * versions run as server transactions in Phase 3 (capacity locks, idempotency, ledger).
 */
import { newId, type Store } from '@/backend/store';
import type { AppNotification, AuditEntry, Capacity, CompanySettings, Dispute, DriverRecord, DriverRoute, Invoice, RouteBooking } from '@/backend/types';
import { withDefaults } from '@/constants/company';
import { locationFromCity, type Location } from '@/constants/places';
import type { CityId } from '@/constants/cities';
import { maxTons, type VehicleId } from '@/lib/pricing';
import { toLocalString } from '@/lib/schedule';
import { add, bookingRef, EMPTY_CAPACITY, overflow, sharedSettlement, type SharingPolicy } from '@/lib/sharing';

export type Person = { id: string; name: string; phone: string };
export type AdminRole = 'superAdmin' | 'financeAdmin' | 'operationsAdmin';

/** Typical cargo volume (m³) by vehicle, for the capacity form's starting values. */
export const VEHICLE_VOLUME: Record<VehicleId, number> = {
  triporteur: 1.5,
  smallVan: 3.3,
  pickup: 2.5,
  truck35: 12,
  truck7: 30,
  truck12: 45,
  semi: 85,
  refrigerated: 30,
  flatbed: 40,
};

export function defaultCapacity(vehicle: VehicleId): Capacity {
  return { tons: maxTons(vehicle), volumeM3: VEHICLE_VOLUME[vehicle], seats: vehicle === 'semi' || vehicle === 'triporteur' ? 0 : 1 };
}

export function sharingPolicy(settings: CompanySettings): SharingPolicy {
  return { rate: settings.sharingRate ?? 0.25, capOfOriginal: settings.sharingCap ?? 0.2, version: settings.sharingVersion ?? 'proto-1' };
}

async function notify(store: Store, userId: string, key: string, params: AppNotification['params'], link: string | null) {
  const id = newId('n');
  await store.set('notifications', id, { id, at: Date.now(), userId, key, params, link, read: false, prototype: true });
}

export async function audit(store: Store, entry: Omit<AuditEntry, 'id' | 'at' | 'prototype'>) {
  const id = newId('a');
  await store.set('audit', id, { ...entry, id, at: Date.now(), prototype: true });
}

/* --------------------------------------------------------------------- routes */

export type RouteInput = {
  from: Location;
  to: Location;
  stops: Location[];
  departAt: string;
  arriveAt: string;
  vehicle: VehicleId;
  plate: string;
  capacity: Capacity;
  price: number;
  sharePrice: number;
  sharing: DriverRoute['sharing'];
  /** Space already taken before publishing (goods already on board). */
  occupied?: Capacity;
};

export async function publishRoute(store: Store, driver: Person & Partial<DriverRecord>, input: RouteInput, kind: DriverRoute['kind'] = 'outbound', outboundId: string | null = null) {
  const id = newId('rt');
  const route: DriverRoute = {
    id,
    createdAt: Date.now(),
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone,
    driverRating: driver.rating ?? 5,
    driverTrips: driver.trips ?? 0,
    verified: driver.verification !== 'pending' && driver.verification !== 'suspended',
    from: input.from,
    to: input.to,
    stops: input.stops,
    departAt: input.departAt,
    arriveAt: input.arriveAt,
    vehicle: input.vehicle,
    plate: input.plate,
    capacity: input.capacity,
    price: input.price,
    sharePrice: input.sharePrice,
    sharing: input.sharing,
    reserved: input.occupied ?? EMPTY_CAPACITY,
    kind,
    outboundId,
    status: 'published',
    prototype: true,
  };
  await store.set('routes', id, route);
  return id;
}

export async function setRouteStatus(store: Store, route: DriverRoute, status: DriverRoute['status']) {
  await store.update('routes', route.id, { status });
}

/* ------------------------------------------------------------------- bookings */

export type BookingInput = {
  from: Location;
  to: Location;
  cargo: RouteBooking['cargo'];
  mode: RouteBooking['mode'];
  allowSharing: boolean;
  accompaniment: RouteBooking['accompaniment'];
  extraStops: boolean;
  price: number;
};

/**
 * A customer asks for a place on a route: the whole vehicle (dedicated, the first booking) or a
 * shared slot (joining a trip whose first customer allowed sharing). The driver confirms; a
 * joiner that adds stops outside the original route also needs the original customer's yes.
 */
export async function requestBooking(store: Store, customer: Person, route: DriverRoute, input: BookingInput) {
  const id = newId('b');
  const now = Date.now();
  const original = input.mode === 'shared' ? await findOriginal(store, route) : null;
  const joiner = input.mode === 'shared' && !!original;
  const booking: RouteBooking = {
    id,
    ref: bookingRef(id, now),
    createdAt: now,
    routeId: route.id,
    driverId: route.driverId,
    driverName: route.driverName,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    from: input.from,
    to: input.to,
    cargo: input.cargo,
    mode: input.mode,
    allowSharing: joiner ? false : input.allowSharing,
    role: joiner ? 'joiner' : 'original',
    joinOf: joiner ? original!.id : null,
    accompaniment: input.accompaniment,
    seats: input.accompaniment === 'none' ? 0 : 1,
    extraStops: joiner && input.extraStops,
    approvals: { driver: null, original: joiner ? (input.extraStops ? null : true) : true },
    originalPrice: input.price,
    discount: 0,
    price: input.price,
    commissionRate: null,
    discountPolicy: null,
    status: 'requested',
    payment: 'notDue',
    timeline: { requested: now },
    prototype: true,
  };
  await store.set('bookings', id, booking);
  await notify(store, route.driverId, joiner ? 'notif.joinRequest' : 'notif.bookingRequest', { ref: booking.ref, name: customer.name }, `/route/${route.id}`);
  return id;
}

async function findOriginal(store: Store, route: DriverRoute) {
  return new Promise<RouteBooking | null>((resolve) => {
    const stop = store.watchQuery('bookings', [['routeId', route.id]], (docs) => {
      stop();
      resolve(docs.find((b) => b.role === 'original' && b.allowSharing && ['confirmed', 'inTransit'].includes(b.status)) ?? null);
    });
  });
}

/** What a booking takes from the vehicle. */
export function bookingNeeds(booking: Pick<RouteBooking, 'cargo' | 'seats'>): Capacity {
  return { tons: booking.cargo.tons, volumeM3: booking.cargo.volumeM3, seats: booking.seats };
}

/**
 * The driver accepts a booking request. Capacity is checked first (weight, volume, seats). A
 * joiner adding stops waits for the original customer; otherwise it is confirmed at once and
 * the original customer's discount is applied (only now, on a confirmed join).
 */
export async function driverDecide(store: Store, booking: RouteBooking, accept: boolean): Promise<'confirmed' | 'awaitingOriginal' | 'declined' | 'noCapacity'> {
  if (!accept) {
    await store.update('bookings', booking.id, { status: 'declined', approvals: { ...booking.approvals, driver: false }, timeline: { ...booking.timeline, declined: Date.now() } });
    await notify(store, booking.customerId, 'notif.declined', { ref: booking.ref }, `/booking/${booking.id}`);
    return 'declined';
  }
  const route = await store.get('routes', booking.routeId);
  if (!route) return 'declined';
  if (overflow(route.capacity, route.reserved, bookingNeeds(booking)).length) return 'noCapacity';
  if (booking.role === 'joiner' && booking.approvals.original === null) {
    await store.update('bookings', booking.id, { status: 'awaitingOriginal', approvals: { ...booking.approvals, driver: true }, timeline: { ...booking.timeline, awaitingOriginal: Date.now() } });
    const original = booking.joinOf ? await store.get('bookings', booking.joinOf) : null;
    if (original) await notify(store, original.customerId, 'notif.joinNeedsYou', { ref: original.ref }, `/booking/${original.id}`);
    return 'awaitingOriginal';
  }
  await confirm(store, { ...booking, approvals: { ...booking.approvals, driver: true } }, route);
  return 'confirmed';
}

/** The original customer approves or refuses a join that changes their stops. */
export async function originalDecide(store: Store, joiner: RouteBooking, accept: boolean) {
  if (!accept) {
    await store.update('bookings', joiner.id, { status: 'declined', approvals: { ...joiner.approvals, original: false }, timeline: { ...joiner.timeline, declined: Date.now() } });
    await notify(store, joiner.customerId, 'notif.declined', { ref: joiner.ref }, `/booking/${joiner.id}`);
    return;
  }
  const route = await store.get('routes', joiner.routeId);
  if (route) await confirm(store, { ...joiner, approvals: { ...joiner.approvals, original: true } }, route);
}

async function confirm(store: Store, booking: RouteBooking, route: DriverRoute) {
  const settings = withDefaults(await store.get('settings', 'company'));
  const now = Date.now();
  const reserved = add(route.reserved, bookingNeeds(booking));
  await store.update('routes', route.id, { reserved });
  await store.update('bookings', booking.id, {
    status: 'confirmed',
    approvals: booking.approvals,
    commissionRate: settings.commissionRate,
    timeline: { ...booking.timeline, confirmed: now },
  });
  await notify(store, booking.customerId, 'notif.confirmed', { ref: booking.ref }, `/booking/${booking.id}`);
  // A confirmed join reduces the original customer's price, under the recorded policy version.
  if (booking.role === 'joiner' && booking.joinOf) {
    const original = await store.get('bookings', booking.joinOf);
    if (original) {
      const policy = sharingPolicy(settings);
      const settle = sharedSettlement(original.originalPrice - original.discount, booking.price, settings.commissionRate, policy);
      await store.update('bookings', original.id, { discount: original.discount + settle.discount, price: settle.revisedOriginal, discountPolicy: policy.version });
      await notify(store, original.customerId, 'notif.discount', { ref: original.ref, amount: settle.discount }, `/booking/${original.id}`);
    }
  }
}

export async function advanceBooking(store: Store, booking: RouteBooking, status: 'inTransit' | 'delivered' | 'completed' | 'cancelled') {
  const patch: Partial<RouteBooking> = { status, timeline: { ...booking.timeline, [status]: Date.now() } };
  if (status === 'delivered') patch.payment = booking.payment === 'cashConfirmed' ? 'cashConfirmed' : 'cashPending';
  await store.update('bookings', booking.id, patch);
  if (status === 'cancelled') {
    const route = await store.get('routes', booking.routeId);
    if (route && ['confirmed', 'inTransit'].includes(booking.status)) {
      const need = bookingNeeds(booking);
      await store.update('routes', route.id, { reserved: { tons: route.reserved.tons - need.tons, volumeM3: route.reserved.volumeM3 - need.volumeM3, seats: route.reserved.seats - need.seats } });
    }
  }
}

/** Driver: "Cash received". Kept apart from the delivery status (Doc 3 §1.3). */
export async function confirmCash(store: Store, booking: RouteBooking) {
  await store.update('bookings', booking.id, { payment: 'cashConfirmed', timeline: { ...booking.timeline, ...(booking.status === 'delivered' ? { completed: Date.now() } : {}) }, ...(booking.status === 'delivered' ? { status: 'completed' as const } : {}) });
}

/* ---------------------------------------------------------- disputes, admin */

export async function raiseDispute(store: Store, input: Omit<Dispute, 'id' | 'createdAt' | 'status' | 'resolution' | 'prototype'>) {
  const id = newId('dp');
  await store.set('disputes', id, { ...input, id, createdAt: Date.now(), status: 'open', resolution: '', prototype: true });
  return id;
}

export async function resolveDispute(store: Store, dispute: Dispute, admin: Person, role: AdminRole, resolution: string) {
  await store.update('disputes', dispute.id, { status: 'resolved', resolution });
  await audit(store, { actor: admin.name, actorRole: role, action: 'dispute.resolve', entity: 'dispute', entityId: dispute.ref, before: dispute.status, after: 'resolved', reason: resolution });
}

export async function setDriverVerification(store: Store, driver: DriverRecord, state: NonNullable<DriverRecord['verification']>, admin: Person, role: AdminRole, reason: string) {
  await store.update('drivers', driver.id, { verification: state });
  await audit(store, { actor: admin.name, actorRole: role, action: `driver.${state}`, entity: 'driver', entityId: driver.name, before: driver.verification ?? 'pending', after: state, reason });
  await notify(store, driver.id, `notif.driver_${state}`, {}, '/driver');
}

/** Changes the commission for FUTURE bookings only; history and audit keep the old rate. */
export async function changeCommission(store: Store, rate: number, admin: Person, role: AdminRole, reason: string) {
  const settings = withDefaults(await store.get('settings', 'company'));
  const history = [...(settings.commissionHistory ?? [{ rate: settings.commissionRate, from: settings.updatedAt || Date.now(), by: 'system', reason: 'default' }]), { rate, from: Date.now(), by: admin.name, reason }];
  await store.set('settings', 'company', { ...settings, commissionRate: rate, commissionHistory: history, updatedAt: Date.now() });
  await audit(store, { actor: admin.name, actorRole: role, action: 'commission.change', entity: 'settings', entityId: 'commission', before: `${Math.round(settings.commissionRate * 1000) / 10}%`, after: `${Math.round(rate * 1000) / 10}%`, reason });
}

export async function changeSettings(store: Store, patch: Partial<CompanySettings>, label: string, before: string, after: string, admin: Person, role: AdminRole, reason: string) {
  const settings = withDefaults(await store.get('settings', 'company'));
  await store.set('settings', 'company', { ...settings, ...patch, updatedAt: Date.now() });
  await audit(store, { actor: admin.name, actorRole: role, action: `settings.${label}`, entity: 'settings', entityId: label, before, after, reason });
}

/**
 * The finance team records money received against an invoice (Doc 3 §2.5): amount, method,
 * reference, who. Partly paid until the total is reached; a driver's claim alone never marks
 * it paid. Every record is audited.
 */
export async function recordPayment(store: Store, invoice: Invoice, payment: { amount: number; method: 'transfer' | 'cash' | 'agent'; reference: string }, admin: Person, role: AdminRole) {
  const payments = [...(invoice.payments ?? []), { ...payment, at: Date.now(), by: admin.name }];
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const full = paid >= invoice.totalShare;
  await store.update('invoices', invoice.id, { payments, status: full ? 'paid' : invoice.status, paidAt: full ? Date.now() : invoice.paidAt });
  await audit(store, { actor: admin.name, actorRole: role, action: 'payment.record', entity: 'invoice', entityId: invoice.number, before: `${paid - payment.amount}`, after: `${paid} / ${invoice.totalShare}`, reason: `${payment.method} · ${payment.reference}` });
  if (full) await notify(store, invoice.driverId, 'notif.invoicePaid', { number: invoice.number }, `/invoice/${invoice.id}`);
}

export async function markNotificationsRead(store: Store, items: AppNotification[]) {
  for (const item of items) if (!item.read) await store.update('notifications', item.id, { read: true });
}

/* ------------------------------------------------------------------- seed data */

const at = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return toLocalString(date);
};

const city = (id: CityId) => locationFromCity(id);

type SeedDriver = { id: string; name: string; phone: string; rating: number; trips: number; vehicle: VehicleId; plate: string; home: CityId; verification: 'verified' | 'pending' };

/** Mock drivers that publish the sample routes. Their records are marked in the admin desk. */
export const SEED_DRIVERS: SeedDriver[] = [
  { id: 'proto-d1', name: 'Karim El Idrissi', phone: '+212 661000101', rating: 4.8, trips: 132, vehicle: 'truck35', plate: '45123-A-1', home: 'casablanca', verification: 'verified' },
  { id: 'proto-d2', name: 'Fatima Zahra Bennis', phone: '+212 661000102', rating: 4.9, trips: 87, vehicle: 'pickup', plate: '78211-B-6', home: 'casablanca', verification: 'verified' },
  { id: 'proto-d3', name: 'Hassan Ouali', phone: '+212 661000103', rating: 4.6, trips: 214, vehicle: 'truck7', plate: '30987-D-40', home: 'marrakech', verification: 'verified' },
  { id: 'proto-d4', name: 'Omar Tazi', phone: '+212 661000104', rating: 5, trips: 0, vehicle: 'smallVan', plate: '11420-H-1', home: 'rabat', verification: 'pending' },
];

/** Writes the sample routes, a shared trip with its first customer, a dispute and audit entries once. */
export async function seedPrototype(store: Store) {
  if (await store.get('routes', 'proto-r1')) return;
  for (const d of SEED_DRIVERS) {
    if (!(await store.get('drivers', d.id)))
      await store.set('drivers', d.id, {
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        plate: d.plate,
        homeCity: d.home,
        rating: d.rating,
        ratingCount: d.trips,
        trips: d.trips,
        photo: null,
        email: '',
        stats: { accepted: d.trips, cancelled: 1, lateCancels: 0, late: 2, onTime: d.trips - 2 },
        compliments: {},
        joinedAt: Date.now() - 200 * 864e5,
        verification: d.verification,
      });
  }
  const base = (d: SeedDriver) => ({
    createdAt: Date.now(),
    driverId: d.id,
    driverName: d.name,
    driverPhone: d.phone,
    driverRating: d.rating,
    driverTrips: d.trips,
    verified: d.verification === 'verified',
    vehicle: d.vehicle,
    plate: d.plate,
    stops: [] as Location[],
    reserved: EMPTY_CAPACITY,
    prototype: true as const,
  });
  const [karim, fatima, hassan] = SEED_DRIVERS;
  const routes: DriverRoute[] = [
    { ...base(karim), id: 'proto-r1', from: city('casablanca'), to: city('tanger'), departAt: at(1, 8), arriveAt: at(1, 14), capacity: { tons: 1.5, volumeM3: 12, seats: 1 }, price: 2400, sharePrice: 900, sharing: 'both', kind: 'outbound', outboundId: null, status: 'published' },
    { ...base(karim), id: 'proto-r3', from: city('tanger'), to: city('casablanca'), departAt: at(2, 9), arriveAt: at(2, 15), capacity: { tons: 1.5, volumeM3: 12, seats: 1 }, price: 1680, sharePrice: 650, sharing: 'both', kind: 'return', outboundId: 'proto-r1', status: 'published' },
    {
      ...base(fatima),
      id: 'proto-r2',
      from: city('casablanca'),
      to: city('berrechid'),
      departAt: at(0, 16),
      arriveAt: at(0, 17),
      capacity: { tons: 1, volumeM3: 2.5, seats: 1 },
      reserved: { tons: 0.1, volumeM3: 1, seats: 0 },
      price: 500,
      sharePrice: 200,
      sharing: 'shared',
      kind: 'outbound',
      outboundId: null,
      status: 'published',
    },
    { ...base(hassan), id: 'proto-r4', from: city('marrakech'), to: city('agadir'), departAt: at(3, 7), arriveAt: at(3, 11), capacity: { tons: 3.5, volumeM3: 30, seats: 1 }, price: 3500, sharePrice: 1100, sharing: 'dedicated', kind: 'outbound', outboundId: null, status: 'published' },
    { ...base(hassan), id: 'proto-r5', from: city('rabat'), to: city('fes'), departAt: at(2, 6), arriveAt: at(2, 9), capacity: { tons: 3.5, volumeM3: 30, seats: 1 }, price: 2200, sharePrice: 800, sharing: 'both', kind: 'outbound', outboundId: null, status: 'published' },
  ];
  for (const route of routes) await store.set('routes', route.id, route);
  // The shared trip of Doc 3 §4.3: a refrigerator from Casablanca to Berrechid, sharing allowed.
  const now = Date.now();
  await store.set('bookings', 'proto-b1', {
    id: 'proto-b1',
    ref: bookingRef('proto-b1', now),
    createdAt: now,
    routeId: 'proto-r2',
    driverId: fatima.id,
    driverName: fatima.name,
    customerId: 'proto-c1',
    customerName: 'Nadia Alami',
    customerPhone: '+212 662000201',
    from: city('casablanca'),
    to: city('berrechid'),
    cargo: { description: 'Refrigerator', tons: 0.1, volumeM3: 1, items: 1 },
    mode: 'dedicated',
    allowSharing: true,
    role: 'original',
    joinOf: null,
    accompaniment: 'none',
    seats: 0,
    extraStops: false,
    approvals: { driver: true, original: true },
    originalPrice: 500,
    discount: 0,
    price: 500,
    commissionRate: 0.1,
    discountPolicy: null,
    status: 'confirmed',
    payment: 'notDue',
    timeline: { requested: now, confirmed: now },
    prototype: true,
  });
  await store.set('disputes', 'proto-dp1', {
    id: 'proto-dp1',
    createdAt: now - 2 * 864e5,
    ref: 'XB-SAMPLE-0001',
    raisedBy: 'driver',
    raisedByName: hassan.name,
    kind: 'cash',
    text: 'Customer paid 1 800 DH instead of the agreed 2 000 DH.',
    status: 'open',
    resolution: '',
    prototype: true,
  });
  await audit(store, { actor: 'System', actorRole: 'system', action: 'prototype.seed', entity: 'platform', entityId: 'sample data', before: '', after: '5 routes, 1 shared trip, 1 dispute', reason: 'Phase 2 prototype data' });
}
