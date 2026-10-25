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
