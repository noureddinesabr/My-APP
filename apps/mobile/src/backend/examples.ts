import type { Store } from '@/backend/store';
import type { FreightRequest, Offer } from '@/backend/types';
import type { VehicleId } from '@/lib/pricing';

/**
 * Test version: example drivers, clearly labelled, so the customer side can be tried alone.
 * Their offers arrive a few seconds after a request is sent (same times after a reload), they
 * answer a counter-price after a few seconds, and once accepted the trip moves on by itself
 * (see `useExampleTrip`). Real drivers in another tab or phone work as before.
 */
export const EXAMPLE_PREFIX = 'example_';

const DRIVERS: { name: string; rating: number; trips: number; vehicle: VehicleId | null; factor: number; eta: 30 | 60; delay: number; agrees: boolean; km: [number, number] }[] = [
  { name: 'Youssef', rating: 4.9, trips: 214, vehicle: null, factor: 1, eta: 30, delay: 5_000, agrees: true, km: [2.2, 1.4] },
  { name: 'Hamid', rating: 4.7, trips: 86, vehicle: 'truck35', factor: 1.15, eta: 60, delay: 11_000, agrees: false, km: [-3.1, 2.6] },
  { name: 'Rachid', rating: 4.8, trips: 132, vehicle: 'pickup', factor: 0.95, eta: 30, delay: 18_000, agrees: true, km: [1.2, -3.4] },
];

const round10 = (value: number) => Math.max(10, Math.round(value / 10) * 10);

export const isExample = (driverId: string) => driverId.startsWith(EXAMPLE_PREFIX);

/** Creates the example offers that are due by now; returns the time of the next one (or null). */
export async function addDueExampleOffers(store: Store, request: FreightRequest, have: Offer[], now: number) {
  if (request.status !== 'open') return null;
  let next: number | null = null;
  for (const [index, driver] of DRIVERS.entries()) {
    const driverId = `${EXAMPLE_PREFIX}${index + 1}`;
    if (request.cancelledDrivers?.includes(driverId)) continue;
    const id = `${request.id}_${driverId}`;
    const due = request.createdAt + driver.delay;
    if (have.some((offer) => offer.id === id)) continue;
    if (due > now) {
      next = next === null ? due : Math.min(next, due);
      continue;
    }
    const offer: Offer = {
      id,
      requestId: request.id,
      clientId: request.clientId,
      createdAt: now,
      driverId,
      driverName: driver.name,
      driverPhone: '',
      vehicle: driver.vehicle ?? request.vehicle,
      plate: `${10000 + index * 2311}-A-${index + 1}`,
      rating: driver.rating,
      trips: driver.trips,
      price: round10(request.price * driver.factor),
      eta: request.scheduledAt ? 'scheduled' : driver.eta,
      status: 'pending',
      driverPhoto: null,
      reliability: 100,
      committed: !!request.scheduledAt,
      example: true,
      // A little away from the pickup (km east, km north), so the offers show on the map.
      pos: { lat: request.from.lat + driver.km[1] / 111, lng: request.from.lng + driver.km[0] / (111 * Math.cos((request.from.lat * Math.PI) / 180)) },
    };
    await store.set('offers', id, offer);
  }
  return next;
}

/** An example driver answers a counter-price: some agree, some keep their price. */
export function exampleAgrees(offer: Offer) {
  const index = Number(offer.driverId.slice(EXAMPLE_PREFIX.length)) - 1;
  return DRIVERS[index]?.agrees ?? true;
}
