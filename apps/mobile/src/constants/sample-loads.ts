import type { FreightRequest } from '@/backend/types';
import type { CityId } from '@/constants/cities';
import { getPlace, locationFromCity, locationFromPlace } from '@/constants/places';
import { toLocalString } from '@/lib/schedule';
import { tripKm } from '@/state/request-draft';

/**
 * Practice loads so drivers can try the app when no real client request is open.
 * Always shown with an "Example" badge; offers on them stay on the device.
 */
export function isExample(id: string) {
  return id.startsWith('ex-');
}

function at(daysFromNow: number, hour: number, minute = 0) {
  const now = new Date();
  return toLocalString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow, hour, minute));
}

const where = (id: string) => {
  const place = getPlace(id);
  return place ? locationFromPlace(place) : locationFromCity(id as CityId);
};

type Seed = Pick<FreightRequest, 'freightType' | 'tons' | 'vehicle' | 'helpers' | 'pickup' | 'dropoff' | 'itemOptions' | 'scheduledAt' | 'price'> & {
  id: string;
  from: string;
  to: string;
};

const SEEDS = (): Seed[] => [
  {
    id: 'ex-1',
    from: 'casablanca-marif',
    to: 'casablanca-an-seba',
    freightType: 'home',
    tons: 1,
    vehicle: 'pickup',
    helpers: 2,
    pickup: { floor: 3, access: 'stairs' },
    dropoff: { floor: 1, access: 'elevator' },
    itemOptions: ['fragile', 'disassembly'],
    scheduledAt: null,
    price: 450,
  },
  {
    id: 'ex-2',
    from: 'casablanca-zone-industrielle-lissasfa',
    to: 'rabat-hay-riad',
    freightType: 'goods',
    tons: 3.5,
    vehicle: 'truck35',
    helpers: 0,
    pickup: { floor: 0, access: 'elevator' },
    dropoff: { floor: 0, access: 'elevator' },
    itemOptions: [],
    scheduledAt: at(1, 9),
    price: 900,
  },
  {
    id: 'ex-3',
    from: 'mohammedia',
    to: 'casablanca-bourgogne',
    freightType: 'items',
    tons: 0.5,
    vehicle: 'smallVan',
    helpers: 1,
    pickup: { floor: 2, access: 'elevator' },
    dropoff: { floor: 4, access: 'stairs' },
    itemOptions: ['fragile', 'heavy'],
    scheduledAt: at(1, 17, 30),
    price: 320,
  },
  {
    id: 'ex-4',
    from: 'casablanca-zone-industrielle-an-seba',
    to: 'marrakech-sidi-ghanem',
    freightType: 'construction',
    tons: 7,
    vehicle: 'truck7',
    helpers: 0,
    pickup: { floor: 0, access: 'elevator' },
    dropoff: { floor: 0, access: 'elevator' },
    itemOptions: ['narrowStreet'],
    scheduledAt: at(2, 7, 30),
    price: 2600,
  },
  {
    id: 'ex-5',
    from: 'berrechid-zone-industrielle-berrechid',
    to: 'tanger-port-tanger-med',
    freightType: 'food',
    tons: 12,
    vehicle: 'refrigerated',
    helpers: 0,
    pickup: { floor: 0, access: 'elevator' },
    dropoff: { floor: 0, access: 'elevator' },
    itemOptions: [],
    scheduledAt: at(3, 6),
    price: 4800,
  },
];

export function sampleLoads(): FreightRequest[] {
  return SEEDS().map((seed) => {
    const from = where(seed.from);
    const to = where(seed.to);
    return {
      ...seed,
      createdAt: 0,
      clientId: 'example',
      clientName: 'Example',
      clientPhone: '',
      from,
      fromDetails: '',
      to,
      toDetails: '',
      notes: '',
      when: seed.scheduledAt ? 'scheduled' : 'now',
      km: tripKm(from, to),
      status: 'open',
      jobId: null,
    };
  });
}
