import type { ImageSourcePropType } from 'react-native';

export type VehicleId =
  | 'triporteur'
  | 'smallVan'
  | 'pickup'
  | 'truck35'
  | 'truck7'
  | 'truck12'
  | 'refrigerated'
  | 'flatbed'
  | 'semi';

export type Vehicle = { id: VehicleId; name: string; carries: string; image: ImageSourcePropType; maxKg: number };

/** The nine vehicle types, smallest first, each with its 3D studio render. */
export const VEHICLES: Vehicle[] = [
  { id: 'triporteur', name: 'Triporteur', carries: 'Carries up to ≈ 500 kg', maxKg: 500, image: require('../assets/vehicles/triporteur.webp') },
  { id: 'smallVan', name: 'Small van', carries: 'Carries ≈ 600 to 750 kg', maxKg: 750, image: require('../assets/vehicles/smallVan.webp') },
  { id: 'pickup', name: 'Pickup', carries: 'Carries ≈ 1 tonne', maxKg: 1000, image: require('../assets/vehicles/pickup.webp') },
  { id: 'truck35', name: 'Truck 3.5 t', carries: 'Carries ≈ 1.3 to 1.5 tonnes', maxKg: 1500, image: require('../assets/vehicles/truck35.webp') },
  { id: 'truck7', name: 'Truck 7 t', carries: 'Carries ≈ 3 to 4.5 tonnes', maxKg: 4500, image: require('../assets/vehicles/truck7.webp') },
  { id: 'truck12', name: 'Truck 12 t+', carries: 'Carries ≈ 6 to 10 tonnes', maxKg: 10000, image: require('../assets/vehicles/truck12.webp') },
  { id: 'refrigerated', name: 'Refrigerated', carries: 'Cold goods · ≈ 3 to 6 tonnes', maxKg: 6000, image: require('../assets/vehicles/refrigerated.webp') },
  { id: 'flatbed', name: 'Flatbed', carries: 'Carries ≈ 10 to 20 tonnes', maxKg: 20000, image: require('../assets/vehicles/flatbed.webp') },
  { id: 'semi', name: 'Semi-trailer', carries: 'Carries ≈ 25 tonnes', maxKg: 25000, image: require('../assets/vehicles/semi.webp') },
];

export const vehicleById = (id: string | undefined): Vehicle => VEHICLES.find((v) => v.id === id) ?? VEHICLES[1];

/** The smallest ordinary vehicle that carries the weight (cold and flatbed are only chosen on purpose). */
export function bestFit(kg: number): VehicleId {
  const ordinary = VEHICLES.filter((v) => v.id !== 'refrigerated' && v.id !== 'flatbed');
  return (ordinary.find((v) => v.maxKg >= kg) ?? ordinary[ordinary.length - 1]).id;
}
