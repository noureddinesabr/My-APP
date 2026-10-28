import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Freight types, most common first. `typicalTons` pre-fills the weight. */
export const FREIGHT_TYPES: { id: FreightTypeId; icon: IconName; typicalTons: number }[] = [
  { id: 'furniture', icon: 'sofa-outline', typicalTons: 1 },
  { id: 'construction', icon: 'wall', typicalTons: 5 },
  { id: 'goods', icon: 'package-variant-closed', typicalTons: 2 },
  { id: 'appliances', icon: 'fridge-outline', typicalTons: 0.5 },
  { id: 'food', icon: 'food-apple-outline', typicalTons: 3 },
  { id: 'machinery', icon: 'cog-outline', typicalTons: 8 },
  { id: 'other', icon: 'dots-horizontal-circle-outline', typicalTons: 1 },
];

export type FreightTypeId =
  | 'furniture'
  | 'construction'
  | 'goods'
  | 'appliances'
  | 'food'
  | 'machinery'
  | 'other';

export const WEIGHT_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3.5, 5, 7, 10, 15, 20, 25, 30, 40];
