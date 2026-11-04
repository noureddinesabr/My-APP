import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CityId } from '@/constants/cities';
import type { VehicleId } from '@/lib/pricing';

export type DocId = 'cinFront' | 'cinBack' | 'licence' | 'carteGrise' | 'insurance';
export const DOC_IDS: DocId[] = ['cinFront', 'cinBack', 'licence', 'carteGrise', 'insurance'];

export type Eta = 30 | 60 | 120 | 'scheduled';

export type DriverVehicle = { type: VehicleId; plate: string; homeCity: CityId; photo?: string };

export type DriverProfile = {
  vehicle: DriverVehicle | null;
  /** Photo URI per document. */
  documents: Partial<Record<DocId, string>>;
  status: 'draft' | 'pending' | 'approved';
  /** Offers sent, by load id. */
  offers: Record<string, { price: number; eta: Eta }>;
};

const STORAGE_KEY = 'xapp.driver';
const EMPTY: DriverProfile = { vehicle: null, documents: {}, status: 'draft', offers: {} };

/** Verification checklist: account type is already done when the driver lands here. */
export function verificationSteps(profile: DriverProfile) {
  const has = (...ids: DocId[]) => ids.every((id) => !!profile.documents[id]);
  return [
    { id: 'account', done: true },
    { id: 'vehicle', done: !!profile.vehicle },
    { id: 'identity', done: has('cinFront', 'cinBack') },
    { id: 'licence', done: has('licence') },
    { id: 'papers', done: has('carteGrise', 'insurance') },
  ] as const;
}

type DriverContextValue = {
  profile: DriverProfile;
  update: (changes: Partial<DriverProfile>) => void;
  setDocument: (id: DocId, uri: string) => void;
  setOffer: (loadId: string, offer: { price: number; eta: Eta } | null) => void;
  reset: () => void;
};

const DriverContext = createContext<DriverContextValue | null>(null);

export function DriverProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DriverProfile>(EMPTY);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!saved) return;
        try {
          setProfile({ ...EMPTY, ...JSON.parse(saved) });
        } catch {
          // Corrupt data: start fresh.
        }
      });
  }, []);

  const change = useCallback((fn: (current: DriverProfile) => DriverProfile) => {
    setProfile((current) => {
      const next = fn(current);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<DriverContextValue>(
    () => ({
      profile,
      update: (changes) => change((current) => ({ ...current, ...changes })),
      setDocument: (id, uri) =>
        change((current) => ({ ...current, documents: { ...current.documents, [id]: uri } })),
      setOffer: (loadId, offer) =>
        change((current) => {
          const offers = { ...current.offers };
          if (offer) offers[loadId] = offer;
          else delete offers[loadId];
          return { ...current, offers };
        }),
      reset: () => change(() => EMPTY),
    }),
    [profile, change],
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}

export function useDriver() {
  const value = useContext(DriverContext);
  if (!value) throw new Error('useDriver must be used inside DriverProvider');
  return value;
}
