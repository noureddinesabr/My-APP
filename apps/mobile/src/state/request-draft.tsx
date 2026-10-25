import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_CITY, getCity, type CityId } from '@/constants/cities';
import { FREIGHT_TYPES, type FreightTypeId } from '@/constants/freight';
import { estimateDistanceKm, estimatePrice, suggestVehicle, type VehicleId } from '@/lib/pricing';

export type When = 'now' | 'today' | 'tomorrow' | 'thisWeek';

/** A client's request before it is sent. Kept on the phone so nothing is lost before sign-up. */
export type RequestDraft = {
  fromCity: CityId;
  fromDetails: string;
  toCity: CityId;
  toDetails: string;
  freightType: FreightTypeId;
  tons: number;
  helpers: number;
  notes: string;
  vehicle: VehicleId;
  /** False until the user picks a vehicle themselves; while false it follows the weight. */
  vehicleChosen: boolean;
  when: When;
  price: number;
  /** False until the user edits the price; while false it follows the estimate. */
  priceChosen: boolean;
  /** Index of the furthest wizard step reached. */
  step: number;
};

const STORAGE_KEY = 'xapp.requestDraft';
const furniture = FREIGHT_TYPES[0];

function defaultDraft(): RequestDraft {
  const vehicle = suggestVehicle(furniture.typicalTons);
  const draft: RequestDraft = {
    fromCity: DEFAULT_CITY,
    fromDetails: '',
    toCity: DEFAULT_CITY,
    toDetails: '',
    freightType: furniture.id,
    tons: furniture.typicalTons,
    helpers: 0,
    notes: '',
    vehicle,
    vehicleChosen: false,
    when: 'today',
    price: 0,
    priceChosen: false,
    step: 0,
  };
  return { ...draft, price: tripEstimate(draft).price.suggested };
}

export function tripEstimate(draft: RequestDraft) {
  const from = getCity(draft.fromCity);
  const to = getCity(draft.toCity);
  const km = estimateDistanceKm(from, to, from.id === to.id);
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
          setDraft(withDerived({ ...defaultDraft(), ...JSON.parse(saved) }));
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
