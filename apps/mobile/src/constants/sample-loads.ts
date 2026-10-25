import type { CityId } from '@/constants/cities';
import type { FreightTypeId } from '@/constants/freight';
import type { VehicleId } from '@/lib/pricing';
import { toLocalString } from '@/lib/schedule';
import type { ItemOption, Place } from '@/state/request-draft';

/**
 * Example loads so drivers can try the app before real client requests exist.
 * Always shown with an "Example" badge.
 */
export type SampleLoad = {
  id: string;
  fromCity: CityId;
  toCity: CityId;
  freightType: FreightTypeId;
  tons: number;
  vehicle: VehicleId;
  helpers: number;
  pickup: Place;
  dropoff: Place;
  itemOptions: ItemOption[];
  /** null means "as soon as possible". */
  scheduledAt: string | null;
  clientPrice: number;
  notes: string;
};

function at(daysFromNow: number, hour: number, minute = 0) {
  const now = new Date();
  return toLocalString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow, hour, minute));
}

export function sampleLoads(): SampleLoad[] {
  return [
    {
      id: 'ex-1',
      fromCity: 'casablanca',
      toCity: 'casablanca',
      freightType: 'furniture',
      tons: 1,
      vehicle: 'pickup',
      helpers: 2,
      pickup: { floor: 3, access: 'stairs' },
      dropoff: { floor: 1, access: 'elevator' },
      itemOptions: ['fragile', 'disassembly'],
      scheduledAt: null,
      clientPrice: 450,
      notes: 'Maarif → Ain Sebaa',
    },
    {
      id: 'ex-2',
      fromCity: 'casablanca',
      toCity: 'rabat',
      freightType: 'goods',
      tons: 3.5,
      vehicle: 'truck35',
      helpers: 0,
      pickup: { floor: 0, access: 'elevator' },
      dropoff: { floor: 0, access: 'elevator' },
      itemOptions: [],
      scheduledAt: at(1, 9),
      clientPrice: 900,
      notes: '',
    },
    {
      id: 'ex-3',
      fromCity: 'mohammedia',
      toCity: 'casablanca',
      freightType: 'appliances',
      tons: 0.5,
      vehicle: 'smallVan',
      helpers: 1,
      pickup: { floor: 2, access: 'elevator' },
      dropoff: { floor: 4, access: 'stairs' },
      itemOptions: ['fragile', 'heavy'],
      scheduledAt: at(1, 17, 30),
      clientPrice: 320,
      notes: '',
    },
    {
      id: 'ex-4',
      fromCity: 'casablanca',
      toCity: 'marrakech',
      freightType: 'construction',
      tons: 7,
      vehicle: 'truck7',
      helpers: 0,
      pickup: { floor: 0, access: 'elevator' },
      dropoff: { floor: 0, access: 'elevator' },
      itemOptions: ['narrowStreet'],
      scheduledAt: at(2, 7, 30),
      clientPrice: 2600,
      notes: '',
    },
    {
      id: 'ex-5',
      fromCity: 'berrechid',
      toCity: 'tanger',
      freightType: 'food',
      tons: 12,
      vehicle: 'refrigerated',
      helpers: 0,
      pickup: { floor: 0, access: 'elevator' },
      dropoff: { floor: 0, access: 'elevator' },
      itemOptions: [],
      scheduledAt: at(3, 6),
      clientPrice: 4800,
      notes: '2–4 °C',
    },
    {
      id: 'ex-6',
      fromCity: 'casablanca',
      toCity: 'eljadida',
      freightType: 'furniture',
      tons: 2,
      vehicle: 'truck35',
      helpers: 2,
      pickup: { floor: 5, access: 'elevator' },
      dropoff: { floor: 0, access: 'elevator' },
      itemOptions: ['packing', 'longCarry'],
      scheduledAt: at(1, 14),
      clientPrice: 1100,
      notes: '',
    },
  ];
}
