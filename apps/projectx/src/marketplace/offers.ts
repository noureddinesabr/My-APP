import type { Booking, VehicleType } from '../models/booking';
import { priceRange, suggestVehicle, VEHICLES } from '../models/catalog';
import type { Driver, Offer, Vehicle } from '../models/marketplace';
import { driveMinutes, placeName, roadKm } from '../models/places';

/**
 * SAMPLE marketplace: deterministic, clearly-labelled sample drivers and offers. The server and the
 * browser both use this until real drivers are connected (see server/marketplace).
 */

type Seed = { id: string; name: string; hue: number; rating: number; trips: number; years: number; city: string; lat: number; lng: number; vehicle: VehicleType; model: string; langs: string[] };
const SEEDS: Seed[] = [
  { id: 'd1', name: 'Youssef El Amrani', hue: 262, rating: 4.9, trips: 412, years: 6, city: 'Casablanca', lat: 33.585, lng: -7.61, vehicle: 'smallVan', model: 'Renault Kangoo', langs: ['Darija', 'Français'] },
  { id: 'd2', name: 'Hamza Benali', hue: 190, rating: 4.8, trips: 268, years: 4, city: 'Casablanca', lat: 33.6, lng: -7.54, vehicle: 'largeVan', model: 'Mercedes Sprinter', langs: ['Darija', 'English'] },
  { id: 'd3', name: 'Karim Ouazzani', hue: 230, rating: 4.7, trips: 157, years: 3, city: 'Mohammedia', lat: 33.69, lng: -7.39, vehicle: 'cityTruck', model: 'Isuzu NPR', langs: ['Darija', 'Français'] },
  { id: 'd4', name: 'Rachid Tazi', hue: 280, rating: 4.9, trips: 731, years: 11, city: 'Rabat', lat: 34.01, lng: -6.83, vehicle: 'truck35', model: 'Mitsubishi Canter', langs: ['Darija', 'Français', 'English'] },
  { id: 'd5', name: 'Said Lahlou', hue: 200, rating: 4.6, trips: 94, years: 2, city: 'Settat', lat: 33.0, lng: -7.62, vehicle: 'pickup', model: 'Toyota Hilux', langs: ['Darija'] },
  { id: 'd6', name: 'Nabil Chraibi', hue: 250, rating: 4.8, trips: 320, years: 7, city: 'Marrakech', lat: 31.63, lng: -8.0, vehicle: 'truck7', model: 'Iveco Eurocargo', langs: ['Darija', 'Français'] },
  { id: 'd7', name: 'Mehdi Alaoui', hue: 175, rating: 4.9, trips: 205, years: 5, city: 'Casablanca', lat: 33.55, lng: -7.64, vehicle: 'refrigerated', model: 'Renault Master Frigo', langs: ['Darija', 'Français'] },
  { id: 'd8', name: 'Omar Fassi', hue: 300, rating: 4.5, trips: 61, years: 1, city: 'Casablanca', lat: 33.61, lng: -7.5, vehicle: 'triporteur', model: 'Docker 150', langs: ['Darija'] },
];

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDriver = (s: Seed): Driver => ({
  id: s.id,
  name: s.name,
  initials: s.name.split(' ').map((p) => p[0]).slice(0, 2).join(''),
  hue: s.hue,
  rating: s.rating,
  trips: s.trips,
  yearsActive: s.years,
  languages: s.langs,
  homeCity: s.city,
  phoneMasked: '+212 6•• •• •• ' + (10 + Number(s.id.slice(1)) * 7),
  verification: { identity: 'approved', license: 'approved', insurance: 'approved' },
  availability: 'online',
  gps: { lat: s.lat, lng: s.lng, live: false, updatedAt: null },
});
const toVehicle = (s: Seed, type: VehicleType): Vehicle => ({
  id: `v-${s.id}`,
  driverId: s.id,
  type,
  model: s.model,
  plateMasked: `${12000 + Number(s.id.slice(1)) * 3171}-•-${(Number(s.id.slice(1)) % 9) + 1}`,
  capacityKg: VEHICLES[type].maxKg,
  volumeM3: Math.round(VEHICLES[type].maxKg / 180),
  photos: [type],
  refrigerated: type === 'refrigerated',
  insuranceExpires: '2027-06-30',
});

/** Simple deterministic pseudo-random (same request → same sample offers). */
function rng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const ORDER: VehicleType[] = ['triporteur', 'smallVan', 'pickup', 'largeVan', 'cityTruck', 'truck35', 'truck7'];

/** Sample offers for a booking. `page` 0 gives the first three, page 1 two more. */
export function sampleOffers(b: Booking, page: number, now = new Date()): Offer[] {
  const need = b.vehicle.required ?? suggestVehicle(b);
  const km = roadKm(b.pickup, b.destination);
  const rnd = rng(`${b.pickup?.id}-${b.destination?.id}-${b.cargo.description}-${page}`);
  const okTypes = need === 'refrigerated' ? (['refrigerated'] as VehicleType[]) : ORDER.slice(ORDER.indexOf(need), ORDER.indexOf(need) + 3);
  const near = [...SEEDS].sort((a, z) => roadKm(b.pickup, a) - roadKm(b.pickup, z));
  const chosen = near.filter((s) => okTypes.includes(s.vehicle) || s.vehicle === need);
  const pool = [...chosen, ...near.filter((s) => !chosen.includes(s) && s.vehicle !== 'refrigerated' && s.vehicle !== 'triporteur')];
  const slice = pool.slice(page * 3, page * 3 + (page === 0 ? 3 : 2));
  const sched = b.schedule.mode === 'scheduled' && b.schedule.date ? new Date(`${b.schedule.date}T${b.schedule.time ?? '09:00'}:00`) : null;
  const helpersWanted = b.assistance.helpers ?? (b.assistance.loading || b.assistance.unloading ? 1 : 0);

  return slice.map((s, i) => {
    const type: VehicleType = okTypes.includes(s.vehicle) ? s.vehicle : need;
    const base = priceRange({ ...b, vehicle: { required: type, suggested: type } }, km);
    let kind: Offer['kind'] = 'solo';
    if (b.return_trip_accepted && i === 1 && km > 40) kind = 'return_trip';
    else if (b.shared_transport_accepted && i === 2) kind = 'shared';
    const factor = kind === 'return_trip' ? 0.78 : kind === 'shared' ? 0.7 : 0.92 + rnd() * 0.22;
    const price = Math.round((base.mid * factor) / 10) * 10;
    const toPickup = Math.max(12, Math.round(driveMinutes(roadKm(s, b.pickup)) + rnd() * 15));
    const pickup = sched ?? new Date(now.getTime() + toPickup * 60000);
    const loadMin = 15 + helpersWanted * 5 + (b.pickup?.floor ?? 0) * 4;
    const delivery = new Date(pickup.getTime() + (loadMin + driveMinutes(km) + (kind === 'shared' ? 70 : 0)) * 60000);
    const canHelp = helpersWanted > 0 ? i !== 2 || rnd() > 0.4 : false;
    const returnTo = kind === 'return_trip' ? placeName(b.pickup!, 'en') : null;
    return {
      id: `o-${s.id}-${page}`,
      requestId: 'req-local',
      driver: toDriver(s),
      vehicle: toVehicle(s, type),
      kind,
      price,
      currency: 'MAD',
      pickupInMin: sched ? 0 : toPickup,
      pickupAt: sched ? `${b.schedule.date} ${hhmm(pickup)}` : hhmm(pickup),
      deliveryAt: hhmm(delivery) + (delivery.toDateString() !== pickup.toDateString() ? ' +1' : ''),
      loadingHelp: canHelp,
      helpers: canHelp ? helpersWanted : 0,
      sharedWith: kind === 'shared' ? 1 + Math.floor(rnd() * 2) : 0,
      returnTo,
      note: '',
      sample: true,
      createdAt: now.toISOString(),
    } satisfies Offer;
  });
}

/** Sample vehicles to show around the pickup while searching (positions are illustrative, not live). */
export function sampleVehiclesNear(b: Booking) {
  if (!b.pickup?.lat || !b.pickup.lng) return [];
  const r = rng(`${b.pickup.id}-near`);
  return Array.from({ length: 6 }, (_, i) => ({ id: `nv${i}`, lat: b.pickup!.lat! + (r() - 0.5) * 0.08, lng: b.pickup!.lng! + (r() - 0.5) * 0.1 }));
}
