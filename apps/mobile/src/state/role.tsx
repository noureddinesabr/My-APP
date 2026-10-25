import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Role = 'client' | 'driver' | 'company';

const STORAGE_KEY = 'xapp.role';
const ROLES: Role[] = ['client', 'driver', 'company'];

type RoleContextValue = {
  role: Role | null;
  loaded: boolean;
  setRole: (role: Role | null) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (ROLES.includes(saved as Role)) setRoleState(saved as Role);
        setLoaded(true);
      });
  }, []);

  const setRole = useCallback((next: Role | null) => {
    setRoleState(next);
    (next ? AsyncStorage.setItem(STORAGE_KEY, next) : AsyncStorage.removeItem(STORAGE_KEY)).catch(() => {});
  }, []);

  return <RoleContext.Provider value={{ role, loaded, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useRole must be used inside RoleProvider');
  return value;
}
