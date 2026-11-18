import type { ImageSourcePropType } from 'react-native';

import { getCity, type CityId } from './lib/cities';
import { haversineKm } from './lib/geo';
import { getPlace } from './lib/places';

export type VehicleId =
  | 'motorcycle'
  | 'triporteur'
  | 'smallVan'
  | 'pickup'
  | 'cityTruck'
  | 'largeVan'
  | 'lightTruck'
  | 'truck35'
  | 'truck7'
  | 'truck12'
  | 'refrigerated'
  | 'flatbed'
  | 'semi';

export type Vehicle = { id: VehicleId; name: string; carries: string; image: ImageSourcePropType; maxKg: number };

/** The vehicle types, smallest first (the motorcycle, then the triporteur), each drawn in 3D for Xapp in Blender (owner's report #7; scripts/render-vehicles.py). */
export const VEHICLES: Vehicle[] = [
  // Owner's edit (18 Nov 2026): a motorcycle for small things (a parcel, a box), about 30 kg.
  { id: 'motorcycle', name: 'Motorcycle', carries: 'Small things, up to ≈ 30 kg', maxKg: 30, image: require('../assets/vehicles/motorcycle.webp') },
  { id: 'triporteur', name: 'Triporteur', carries: 'Carries up to ≈ 500 kg', maxKg: 500, image: require('../assets/vehicles/triporteur.webp') },
  { id: 'smallVan', name: 'Small van', carries: 'Carries ≈ 600 to 750 kg', maxKg: 750, image: require('../assets/vehicles/smallVan.webp') },
  { id: 'cityTruck', name: 'City mini truck (Kia K2700 / H100 type)', carries: 'Carries ≈ 1 to 1.3 tonnes, low open bed', maxKg: 1300, image: require('../assets/vehicles/cityTruck.webp') },
  { id: 'pickup', name: 'Pickup (2 doors)', carries: 'Carries ≈ 1 to 1.2 tonnes, long open bed', maxKg: 1100, image: require('../assets/vehicles/pickup.webp') },
  { id: 'largeVan', name: 'Large van (Transit type)', carries: 'Carries ≈ 1.2 to 1.4 tonnes, closed, ≈ 11 to 15 m³', maxKg: 1400, image: require('../assets/vehicles/largeVan.webp') },
  { id: 'truck35', name: 'Truck 3.5 t', carries: 'Carries ≈ 1.3 to 1.5 tonnes', maxKg: 1500, image: require('../assets/vehicles/truck35.webp') },
  { id: 'lightTruck', name: 'Light truck (Dongfeng Captain type)', carries: 'Carries ≈ 1.5 to 2.5 tonnes, open drop-side bed', maxKg: 2500, image: require('../assets/vehicles/lightTruck.webp') },
  { id: 'truck7', name: 'Truck 7 t', carries: 'Carries ≈ 3 to 4.5 tonnes', maxKg: 4500, image: require('../assets/vehicles/truck7.webp') },
  { id: 'truck12', name: 'Truck 12 t+', carries: 'Carries ≈ 6 to 10 tonnes', maxKg: 10000, image: require('../assets/vehicles/truck12.webp') },
  { id: 'refrigerated', name: 'Refrigerated', carries: 'Cold goods · ≈ 3 to 6 tonnes', maxKg: 6000, image: require('../assets/vehicles/refrigerated.webp') },
  { id: 'flatbed', name: 'Flatbed', carries: 'Carries ≈ 10 to 20 tonnes', maxKg: 20000, image: require('../assets/vehicles/flatbed.webp') },
  { id: 'semi', name: 'Semi-trailer', carries: 'Carries ≈ 25 tonnes', maxKg: 25000, image: require('../assets/vehicles/semi.webp') },
];

export const vehicleById = (id: string | undefined): Vehicle => VEHICLES.find((v) => v.id === id) ?? VEHICLES.find((v) => v.id === 'smallVan')!;

/** The two small vehicles that stay local (owner's edit #7): the motorcycle and the triporteur. */
export const LOCAL_VEHICLES: VehicleId[] = ['motorcycle', 'triporteur'];
/** The farthest a local vehicle goes by road (a big city and the towns around it), in km. */
export const LOCAL_MAX_KM = 60;

/**
 * The big cities (owner's edit #7): a motorcycle or a triporteur never goes from one of them to
 * another (Casablanca ↔ Rabat), but it may go between a big city and the small towns around it, or
 * between small towns (Dar Bouazza ↔ Casablanca ↔ Berrechid). Rabat and Salé are one city here.
 * `km`: how far from the centre a place still counts as inside the city.
 */
const BIG_CITIES: Partial<Record<CityId, { group: string; km: number }>> = {
  casablanca: { group: 'casablanca', km: 14 },
  rabat: { group: 'rabat', km: 9 },
  sale: { group: 'rabat', km: 8 },
  marrakech: { group: 'marrakech', km: 10 },
  fes: { group: 'fes', km: 9 },
  tanger: { group: 'tanger', km: 9 },
  meknes: { group: 'meknes', km: 7 },
  agadir: { group: 'agadir', km: 12 },
  oujda: { group: 'oujda', km: 7 },
  kenitra: { group: 'kenitra', km: 7 },
  tetouan: { group: 'tetouan', km: 7 },
};

/** The big city a place is in ('' for a small town, the countryside or an unknown place). */
export function bigCityOf(placeId: string | undefined): string {
  const p = getPlace(placeId);
  if (!p || p.kind === 'town') return '';
  const big = BIG_CITIES[p.cityId];
  if (!big) return '';
  return haversineKm(p, getCity(p.cityId)) <= big.km ? big.group : '';
}

/** Where a trip starts and ends (place ids), when known. */
export type RouteEnds = { from?: string; to?: string };

export type Misfit = 'tooSmall' | 'bigCities' | 'tooFar' | '';

/**
 * Why a vehicle doesn't suit this load (vehicle engine): too small for the weight, or a local
 * vehicle (motorcycle, triporteur) on a trip between two big cities or too far by road.
 * '' when it suits. Unknown weight, distance or places never rule anything out.
 */
export function vehicleMisfit(id: VehicleId, kg: number, km: number, ends?: RouteEnds): Misfit {
  const v = vehicleById(id);
  if (kg > 0 && kg > v.maxKg) return 'tooSmall';
  if (LOCAL_VEHICLES.includes(id)) {
    const a = bigCityOf(ends?.from);
    const b = bigCityOf(ends?.to);
    if (a && b && a !== b) return 'bigCities';
    if (km > LOCAL_MAX_KM) return 'tooFar';
  }
  return '';
}

/** The smallest ordinary vehicle that carries the weight and suits the trip (cold and flatbed are only chosen on purpose). */
export function bestFit(kg: number, km = 0, ends?: RouteEnds): VehicleId {
  const ordinary = VEHICLES.filter((v) => v.id !== 'refrigerated' && v.id !== 'flatbed');
  return (ordinary.find((v) => !vehicleMisfit(v.id, kg, km, ends)) ?? ordinary[ordinary.length - 1]).id;
}
