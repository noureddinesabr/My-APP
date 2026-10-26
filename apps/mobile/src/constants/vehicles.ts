import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { VehicleId } from '@/lib/pricing';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Default vehicle types. These will move to the database so the admin can edit them. */
export const VEHICLE_TYPES: { id: VehicleId; icon: IconName }[] = [
  { id: 'triporteur', icon: 'rickshaw' },
  { id: 'smallVan', icon: 'van-utility' },
  { id: 'pickup', icon: 'car-pickup' },
  { id: 'truck35', icon: 'truck-outline' },
  { id: 'truck7', icon: 'truck' },
  { id: 'truck12', icon: 'truck-cargo-container' },
  { id: 'semi', icon: 'truck-trailer' },
  { id: 'refrigerated', icon: 'truck-snowflake' },
  { id: 'flatbed', icon: 'truck-flatbed' },
];

export function vehicleIcon(id: VehicleId): IconName {
  return VEHICLE_TYPES.find((vehicle) => vehicle.id === id)?.icon ?? 'truck';
}

/** Studio renders of each vehicle type (made with scripts/render-vehicles.py). */
const VEHICLE_IMAGES: Record<VehicleId, number> = {
  triporteur: require('@/assets/images/vehicles/triporteur.webp'),
  smallVan: require('@/assets/images/vehicles/smallVan.webp'),
  pickup: require('@/assets/images/vehicles/pickup.webp'),
  truck35: require('@/assets/images/vehicles/truck35.webp'),
  truck7: require('@/assets/images/vehicles/truck7.webp'),
  truck12: require('@/assets/images/vehicles/truck12.webp'),
  semi: require('@/assets/images/vehicles/semi.webp'),
  refrigerated: require('@/assets/images/vehicles/refrigerated.webp'),
  flatbed: require('@/assets/images/vehicles/flatbed.webp'),
};

export function vehicleImage(id: VehicleId) {
  return VEHICLE_IMAGES[id];
}

/** Size groups shown in "Choose a vehicle", so nine types read as four simple choices. */
export const VEHICLE_GROUPS: { id: 'small' | 'medium' | 'large' | 'special'; vehicles: VehicleId[] }[] = [
  { id: 'small', vehicles: ['triporteur', 'smallVan', 'pickup'] },
  { id: 'medium', vehicles: ['truck35', 'truck7'] },
  { id: 'large', vehicles: ['truck12', 'semi'] },
  { id: 'special', vehicles: ['refrigerated', 'flatbed'] },
];

/** Typical cargo space (length × width × height, metres; open beds: height of the sides). */
export const VEHICLE_SPACE: Record<VehicleId, [number, number, number]> = {
  triporteur: [1.8, 1.3, 0.5],
  smallVan: [1.8, 1.2, 1.2],
  pickup: [1.5, 1.5, 0.5],
  truck35: [4.2, 2.1, 2.1],
  truck7: [6.0, 2.3, 2.3],
  truck12: [7.5, 2.45, 2.5],
  semi: [13.6, 2.45, 2.7],
  refrigerated: [6.0, 2.2, 2.2],
  flatbed: [7.0, 2.45, 0.6],
};
