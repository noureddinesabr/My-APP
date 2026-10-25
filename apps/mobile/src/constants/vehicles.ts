import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Default vehicle types. These will move to the database so the admin can edit them. */
export const VEHICLE_TYPES: { id: string; icon: IconName; maxTons: number }[] = [
  { id: 'triporteur', icon: 'rickshaw', maxTons: 0.5 },
  { id: 'smallVan', icon: 'van-utility', maxTons: 0.8 },
  { id: 'pickup', icon: 'car-pickup', maxTons: 1.5 },
  { id: 'truck35', icon: 'truck-outline', maxTons: 3.5 },
  { id: 'truck7', icon: 'truck', maxTons: 7 },
  { id: 'truck12', icon: 'truck-cargo-container', maxTons: 20 },
  { id: 'semi', icon: 'truck-trailer', maxTons: 40 },
  { id: 'refrigerated', icon: 'truck-snowflake', maxTons: 20 },
  { id: 'flatbed', icon: 'truck-flatbed', maxTons: 25 },
];
