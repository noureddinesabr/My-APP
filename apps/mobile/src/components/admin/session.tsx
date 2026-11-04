import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { AdminRole } from '@/backend/prototype';
import { FormField, OptionCards, PrototypeNote, StateView } from '@/components/ds';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Radius, rim, Spacing, useColors } from '@/theme';

export type AdminSession = { name: string; role: AdminRole };

/** What each administrator role may do (Doc 4 §3.A; separated by responsibility, Doc 4 §8). */
export type Permission = 'finance' | 'operations' | 'verify' | 'settings' | 'staff';

const GRANTS: Record<AdminRole, Permission[]> = {
  superAdmin: ['finance', 'operations', 'verify', 'settings', 'staff'],
  financeAdmin: ['finance'],
  operationsAdmin: ['operations', 'verify'],
};

export function can(role: AdminRole, permission: Permission) {
  return GRANTS[role].includes(permission);
}

const STORAGE_KEY = 'xapp.admin.session';
const Context = createContext<{ session: AdminSession | null; signIn: (s: AdminSession) => void; signOut: () => void } | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSession(raw ? (JSON.parse(raw) as AdminSession) : null))
      .catch(() => setSession(null));
  }, []);
  if (session === undefined) return <StateView state="loading" />;
  return (
    <Context.Provider
      value={{
        session,
        signIn: (next) => {
          setSession(next);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        },
        signOut: () => {
          setSession(null);
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        },
      }}>
      {children}
    </Context.Provider>
  );
}

export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error('useAdmin outside AdminSessionProvider');
  return value;
}

/** The signed-in administrator; screens inside the gate can rely on it. */
export function useAdminSession() {
  const { session } = useAdmin();
  return session as AdminSession;
}

/**
 * Admin sign-in (Doc 5 A01) — PROTOTYPE: name, password (6+ characters, not checked against
 * anything) and a role to try the permission split. Real accounts, passwords and 2-step
 * verification come with the hosted backend.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { session, signIn } = useAdmin();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole | null>('superAdmin');
  const [tried, setTried] = useState(false);
  if (session) return <>{children}</>;
  const errors = { name: name.trim().length < 2 ? t('admin2.errName') : null, password: password.length < 6 ? t('admin2.errPassword') : null };
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }, rim(colors)]}>
        <View style={[styles.logo, { backgroundColor: colors.hero }]}>
          <Text variant="title" color={colors.onHero}>
            X
          </Text>
        </View>
        <Text variant="title">{t('admin2.signInTitle')}</Text>
        <Text muted>{t('admin2.signInBody')}</Text>
        <FormField label={t('admin2.name')} value={name} onChangeText={setName} required error={tried ? errors.name : null} />
        <FormField label={t('admin2.password')} value={password} onChangeText={setPassword} required error={tried ? errors.password : null} hint={t('admin2.passwordHint')} />
        <Text variant="caption">{t('admin2.role')}</Text>
        <OptionCards
          value={role}
          onChange={setRole}
          options={(['superAdmin', 'financeAdmin', 'operationsAdmin'] as const).map((value) => ({ value, title: t(`admin2.role_${value}`), body: t(`admin2.roleBody_${value}`) }))}
        />
        <Button
          variant="accent"
          icon="log-in-outline"
          title={t('admin2.signIn')}
          onPress={() => {
            setTried(true);
            if (errors.name || errors.password || !role) return;
            signIn({ name: name.trim(), role });
          }}
        />
        <PrototypeNote text={t('admin2.signInPrototype')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: { width: '100%', maxWidth: 460, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  logo: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
