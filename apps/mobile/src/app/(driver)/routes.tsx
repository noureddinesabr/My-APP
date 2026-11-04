import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { DriverRoute } from '@/backend/types';
import { FilterChips, PageHeader, PrototypeNote, SectionHeader, StateView } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { RouteCard } from '@/components/route-cards';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import { fromLocalString } from '@/lib/schedule';
import { useAccount } from '@/state/account';
import { useDriver } from '@/state/driver';
import { Spacing, useColors } from '@/theme';

type Tab = 'active' | 'upcoming' | 'completed' | 'withdrawn';

/**
 * Routes tab (Doc 5 D11): the driver's published routes and return journeys, a button to
 * publish a new one, and — for each outbound route without a return — the suggestion to
 * advertise the way back (D20: publish, not available, decide later). A suggestion is never
 * listed for customers until the driver publishes it.
 */
export default function DriverRoutes() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { driver } = useAccount();
  const { profile, update } = useDriver();
  const routes = useQuery('routes', driver ? [['driverId', driver.id]] : null);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [later, setLater] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const list = [...(routes ?? [])].sort((a, b) => a.departAt.localeCompare(b.departAt));
  const departs = (route: DriverRoute) => fromLocalString(route.departAt).getTime();
  const groups: Record<Tab, DriverRoute[]> = {
    active: list.filter((r) => r.status === 'inTransit' || (r.status !== 'withdrawn' && r.status !== 'completed' && departs(r) <= now)),
    upcoming: list.filter((r) => (r.status === 'published' || r.status === 'full') && departs(r) > now),
    completed: list.filter((r) => r.status === 'completed'),
    withdrawn: list.filter((r) => r.status === 'withdrawn' || r.status === 'draft'),
  };
  const dismissed = new Set([...(profile.returnDismissed ?? []), ...later]);
  const suggestions = list.filter((r) => r.kind === 'outbound' && r.status === 'published' && !dismissed.has(r.id) && !list.some((x) => x.outboundId === r.id));

  return (
    <Screen header={<PageHeader title={t('tabs.routes')} right={<Button compact variant="accent" icon="add" title={t('routes.new')} onPress={() => router.push('/route-new')} />} />}>
      {!driver ? (
        <StateView state="empty" title={t('driver.signInTitle')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
      ) : (
        <>
          {suggestions.map((route) => (
            <Card key={route.id}>
              <View style={styles.head}>
                <MaterialCommunityIcons name="backup-restore" size={22} color={colors.teal} />
                <Text variant="label" style={{ flex: 1 }}>
                  {t('routes.returnAsk', { route: names.shortRoute(route.from, route.to) })}
                </Text>
              </View>
              <Text variant="caption" muted>
                {t('routes.returnBody', { back: names.shortRoute(route.to, route.from) })}
              </Text>
              <Button compact variant="primary" icon="return-down-back-outline" title={t('route.publishReturn')} onPress={() => router.push({ pathname: '/route-new', params: { returnOf: route.id } })} />
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button compact variant="ghost" title={t('routes.notAvailable')} onPress={() => update({ returnDismissed: [...(profile.returnDismissed ?? []), route.id] })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button compact variant="outline" title={t('routes.later')} onPress={() => setLater([...later, route.id])} />
                </View>
              </View>
            </Card>
          ))}
          <FilterChips<Tab>
            value={tab}
            onChange={setTab}
            options={(['upcoming', 'active', 'completed', 'withdrawn'] as const).map((value) => ({ value, label: t(`routes.${value}`), count: groups[value].length }))}
          />
          {routes === undefined ? (
            <StateView state="loading" />
          ) : groups[tab].length === 0 ? (
            <StateView state="empty" title={t(`routes.empty_${tab}`)} action={tab === 'upcoming' ? t('routes.new') : undefined} onAction={() => router.push('/route-new')} />
          ) : (
            groups[tab].map((route) => <RouteCard key={route.id} route={route} />)
          )}
          <SectionHeader title={t('routes.tipTitle')} />
          <Text variant="caption" muted>
            {t('routes.tip')}
          </Text>
          <PrototypeNote text={t('routes.prototype')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
