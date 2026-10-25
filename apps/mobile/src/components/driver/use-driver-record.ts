import { useEffect } from 'react';

import { ensureDriver } from '@/backend/actions';
import { useDoc, useStore } from '@/backend';
import { useAccount } from '@/state/account';
import { useDriver } from '@/state/driver';

/**
 * The signed-in driver's shared record (profile, rating, wallet), kept in sync
 * with the vehicle saved on this device once the account is approved.
 */
export function useDriverRecord() {
  const store = useStore();
  const { driver: account } = useAccount();
  const { profile } = useDriver();
  const record = useDoc('drivers', account?.id ?? null);
  const vehicle = profile.vehicle;
  const approved = profile.status === 'approved';

  useEffect(() => {
    if (!account || !vehicle || !approved) return;
    ensureDriver(store, account, { type: vehicle.type, plate: vehicle.plate, homeCity: vehicle.homeCity }).catch(() => {});
  }, [store, account, vehicle, approved]);

  return { account, record, approved };
}
