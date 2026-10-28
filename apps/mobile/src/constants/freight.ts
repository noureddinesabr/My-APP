import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * "What are you moving?" in everyday words, most common first. `typicalTons` pre-fills the
 * weight (and the vehicle) for people who answer "I don't know" to the weight.
 */
export const FREIGHT_TYPES: { id: FreightTypeId; icon: IconName; typicalTons: number }[] = [
  { id: 'home', icon: 'home-export-outline', typicalTons: 2 },
  { id: 'items', icon: 'sofa-outline', typicalTons: 0.5 },
  { id: 'goods', icon: 'package-variant-closed', typicalTons: 1 },
  { id: 'pallets', icon: 'forklift', typicalTons: 3 },
  { id: 'construction', icon: 'wall', typicalTons: 5 },
  { id: 'machinery', icon: 'robot-industrial', typicalTons: 3 },
  { id: 'farm', icon: 'sprout', typicalTons: 2 },
  { id: 'food', icon: 'snowflake-thermometer', typicalTons: 3 },
  { id: 'other', icon: 'help-circle-outline', typicalTons: 1 },
];

/** `furniture` and `appliances` are from earlier versions (old requests still show them). */
export type FreightTypeId =
  | 'home'
  | 'items'
  | 'goods'
  | 'pallets'
  | 'construction'
  | 'machinery'
  | 'farm'
  | 'food'
  | 'other'
  | 'furniture'
  | 'appliances';

/** Needs a refrigerated truck. */
export function needsCold(type: FreightTypeId) {
  return type === 'food';
}

/** "About how heavy?" answers, in tons. */
export const WEIGHT_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 7, 10, 15, 20, 30];
