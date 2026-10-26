import { normalizeClient, normalizeDriver } from '@/backend/actions';
import { useDoc } from '@/backend';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';

/** The signed-in account and shared record for the current role (client or driver). */
export function useMyRecord() {
  const { role } = useRole();
  const { client, driver } = useAccount();
  const side = role === 'driver' ? 'driver' : 'client';
  const account = side === 'driver' ? driver : client;
  const driverDoc = useDoc('drivers', side === 'driver' ? account?.id : null);
  const clientDoc = useDoc('clients', side === 'client' ? account?.id : null);
  return {
    side,
    account,
    driverRecord: driverDoc ? normalizeDriver(driverDoc) : driverDoc,
    clientRecord: clientDoc ? normalizeClient(clientDoc) : clientDoc,
  } as const;
}
