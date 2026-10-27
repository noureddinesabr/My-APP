import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Media } from '@/backend/types';
import { DEFAULT_CITY, type CityId } from '@/constants/cities';
import { FREIGHT_TYPES, type FreightTypeId } from '@/constants/freight';
import { locationFromCity, type Location } from '@/constants/places';
import { roadKm } from '@/lib/geo';
import { estimatePrice, IN_CITY_KM, suggestVehicle, type VehicleId } from '@/lib/pricing';
import { ensureBookable } from '@/lib/schedule';

export type When = 'now' | 'scheduled';
/** For `when: 'now'`: as soon as possible (about 10–20 min) or within the hour. */
export type PickupWindow = 'asap' | '1h';
export type Access = 'elevator' | 'stairs';
export type ItemOption = 'fragile' | 'heavy' | 'disassembly' | 'packing' | 'narrowStreet' | 'longCarry';

/** Floor 0 is the ground floor; 5 means 5th floor or higher. */
export type Place = { floor: number; access: Access };

/** A client's request before it is sent. Kept on the phone so nothing is lost before sign-up. */
export type RequestDraft = {
  from: Location;
  /** Street, building… typed by the client. */
  fromDetails: string;
  to: Location;
  toDetails: string;
  freightType: FreightTypeId;
  tons: number;
  helpers: number;
  pickup: Place;
  dropoff: Place;
  itemOptions: ItemOption[];
  notes: string;
  /** Spoken explanation for drivers, as well as or instead of written notes. */
  voiceNote: Media | null;
  /** Photos and videos of the load (stored as soon as they are taken, so they survive until sign-up). */
  media: Media[];
  vehicle: VehicleId;
  /** False until the user picks a vehicle themselves; while false it follows the weight. */
  vehicleChosen: boolean;
  when: When;
  pickupWindow: PickupWindow;
  /** The client travels with the goods (one seat in the cab). */
  rideAlong: boolean;
  /** Local "YYYY-MM-DDTHH:mm", used when `when` is 'scheduled'. */
  scheduledAt: string;
  price: number;
  /** False until the user edits the price; while false it follows the estimate. */
  priceChosen: boolean;
  /** Index of the furthest wizard step reached. */
  step: number;
};

/** The request flow: one question per screen, in this order. */
export const QUESTIONS = ['route', 'what', 'size', 'vehicle', 'when', 'helpers', 'extras', 'price'] as const;
/** Already done before the first question: the account type and the destination. */
const DONE_BEFORE = 2;

/** Share of the request already done, counting only real answers (for progress bars). */
export function requestProgress(step: number) {
  return (DONE_BEFORE + step) / (DONE_BEFORE + QUESTIONS.length);
}

const STORAGE_KEY = 'xapp.requestDraft';
const furniture = FREIGHT_TYPES[0];

function defaultDraft(): RequestDraft {
  const vehicle = suggestVehicle(furniture.typicalTons);
  const draft: RequestDraft = {
    from: locationFromCity(DEFAULT_CITY),
    fromDetails: '',
    to: locationFromCity(DEFAULT_CITY),
    toDetails: '',
    freightType: furniture.id,
    tons: furniture.typicalTons,
    helpers: 0,
    pickup: { floor: 0, access: 'elevator' },
    dropoff: { floor: 0, access: 'elevator' },
    itemOptions: [],
    notes: '',
    voiceNote: null,
    media: [],
    vehicle,
    vehicleChosen: false,
    when: 'now',
    pickupWindow: 'asap',
    rideAlong: false,
    scheduledAt: ensureBookable(undefined, new Date()),
    price: 0,
    priceChosen: false,
    step: 0,
  };
  return { ...draft, price: tripEstimate(draft).price.suggested };
}

/** Road km for a trip; a move "inside a city" (both ends the city itself) uses the typical in-city distance. */
export function tripKm(from: Location, to: Location) {
  return from.placeId && from.placeId === to.placeId && from.placeId === from.cityId ? IN_CITY_KM : roadKm(from, to);
}

export function tripEstimate(draft: Pick<RequestDraft, 'from' | 'to' | 'vehicle' | 'helpers'>) {
  const km = tripKm(draft.from, draft.to);
  return { km, price: estimatePrice(draft.vehicle, km, draft.helpers) };
}

/** Keeps the vehicle and price following smart defaults until the user overrides them. */
function withDerived(draft: RequestDraft): RequestDraft {
  const vehicle = draft.vehicleChosen ? draft.vehicle : suggestVehicle(draft.tons, draft.freightType === 'food');
  const next = { ...draft, vehicle };
  return next.priceChosen ? next : { ...next, price: tripEstimate(next).price.suggested };
}

type DraftContextValue = {
  draft: RequestDraft;
  /** True once the user has started a draft (opened the wizard). */
  hasDraft: boolean;
  update: (changes: Partial<RequestDraft>) => void;
  discard: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function RequestDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RequestDraft>(defaultDraft);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!saved) return;
        try {
          const raw = JSON.parse(saved) as Partial<RequestDraft> & { fromCity?: CityId; toCity?: CityId };
          // Drafts from before map locations stored city ids.
          if (!raw.from && raw.fromCity) raw.from = locationFromCity(raw.fromCity);
          if (!raw.to && raw.toCity) raw.to = locationFromCity(raw.toCity);
          const parsed = { ...defaultDraft(), ...raw } as RequestDraft;
          // Older drafts used today/tomorrow/thisWeek; a stale time moves to the next free slot.
          parsed.when = parsed.when === 'now' ? 'now' : 'scheduled';
          parsed.scheduledAt = ensureBookable(parsed.scheduledAt, new Date());
          setDraft(withDerived(parsed));
          setHasDraft(true);
        } catch {
          // Corrupt draft: start fresh.
        }
      });
  }, []);

  const update = useCallback((changes: Partial<RequestDraft>) => {
    setDraft((current) => {
      const next = withDerived({ ...current, ...changes });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setHasDraft(true);
  }, []);

  const discard = useCallback(() => {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setDraft(defaultDraft());
    setHasDraft(false);
  }, []);

  const value = useMemo(() => ({ draft, hasDraft, update, discard }), [draft, hasDraft, update, discard]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useRequestDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useRequestDraft must be used inside RequestDraftProvider');
  return value;
}
