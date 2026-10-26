import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Account } from '@/backend/actions';
import { newId } from '@/backend/store';

type AccountRole = 'client' | 'driver';
const KEYS: Record<AccountRole, string> = { client: 'xapp.account.client', driver: 'xapp.account.driver' };

type AccountContextValue = {
  client: Account | null;
  driver: Account | null;
  loaded: boolean;
  /** Test sign-in: any phone number, code shown on screen. Keeps the same id for the same phone. */
  signIn: (role: AccountRole, name: string, phone: string) => Account;
  signOut: (role: AccountRole) => void;
  /** Profile edits: keeps the same account id. */
  updateAccount: (role: AccountRole, changes: Partial<Omit<Account, 'id'>>) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Account | null>(null);
  const [driver, setDriver] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEYS.client), AsyncStorage.getItem(KEYS.driver)])
      .then(([c, d]) => {
        if (c) setClient(JSON.parse(c));
        if (d) setDriver(JSON.parse(d));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const signIn = useCallback(
    (role: AccountRole, name: string, phone: string) => {
      const current = role === 'client' ? client : driver;
      const account: Account = {
        id: current && current.phone === phone ? current.id : newId(role === 'client' ? 'c' : 'd'),
        name: name.trim(),
        phone: phone.trim(),
      };
      AsyncStorage.setItem(KEYS[role], JSON.stringify(account)).catch(() => {});
      (role === 'client' ? setClient : setDriver)(account);
      return account;
    },
    [client, driver],
  );

  const signOut = useCallback((role: AccountRole) => {
    AsyncStorage.removeItem(KEYS[role]).catch(() => {});
    (role === 'client' ? setClient : setDriver)(null);
  }, []);

  const updateAccount = useCallback(
    (role: AccountRole, changes: Partial<Omit<Account, 'id'>>) => {
      const current = role === 'client' ? client : driver;
      if (!current) return;
      const next = { ...current, ...changes };
      AsyncStorage.setItem(KEYS[role], JSON.stringify(next)).catch(() => {});
      (role === 'client' ? setClient : setDriver)(next);
    },
    [client, driver],
  );

  const value = useMemo(
    () => ({ client, driver, loaded, signIn, signOut, updateAccount }),
    [client, driver, loaded, signIn, signOut, updateAccount],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}
