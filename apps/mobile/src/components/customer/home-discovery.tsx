import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { DriverRoute } from '@/backend/types';
import { PrototypeNote, SectionHeader, StateView } from '@/components/ds';
import { PressableScale } from '@/components/motion/pressable-scale';
import { BookingCard, RouteCard } from '@/components/route-cards';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { useAccount } from '@/state/account';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

/** Routes still open for booking, soonest first. */
export function useOpenRoutes() {
  const routes = useQuery('routes', [['status', 'published']]);
  return routes === undefined ? undefined : [...routes].sort((a, b) => a.departAt.localeCompare(b.departAt));
}

/** Shared trips: routes whose driver offers shared space. */
export const isShared = (route: DriverRoute) => route.sharing !== 'dedicated';

/**
 * Customer home panel (Doc 5 C05): "What do you need to move?", the main action (Find
 * transportation) above the secondary one (Publish a request), then what can be booked right
 * now — routes, shared trips, return journeys — and the customer's recent bookings.
 */
export function HomeDiscovery({ onPublish, maxHeight }: { onPublish: () => void; maxHeight: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { client } = useAccount();
  const routes = useOpenRoutes();
  const bookings = useQuery('bookings', client ? [['customerId', client.id]] : null);
  const recent = [...(bookings ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2);
  const outbound = (routes ?? []).filter((route) => route.kind === 'outbound').slice(0, 5);
  const shared = (routes ?? []).filter(isShared).slice(0, 5);
  const returns = (routes ?? []).filter((route) => route.kind === 'return').slice(0, 5);

  const row = (items: DriverRoute[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
      {items.map((route) => (
        <RouteCard key={route.id} route={route} compact />
      ))}
    </ScrollView>
  );

  return (
    <ScrollView style={{ maxHeight }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text variant="title" style={styles.title}>
        {t('home2.question')}
      </Text>
      <Button variant="accent" icon="search" title={t('home2.find')} onPress={() => router.push('/search')} />
      <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={onPublish} style={[styles.publish, { borderColor: colors.primary }]}>
        <MaterialCommunityIcons name="bullhorn-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="label" color={colors.primary}>
            {t('home2.publish')}
          </Text>
          <Text variant="caption" muted>
            {t('home2.publishHint')}
          </Text>
        </View>
      </PressableScale>

      <SectionHeader title={t('home2.routes')} action={t('home2.seeAll')} onAction={() => router.push('/search')} />
      {routes === undefined ? <StateView state="loading" compact /> : outbound.length ? row(outbound) : <StateView state="empty" compact title={t('home2.noRoutes')} />}
      <SectionHeader title={t('home2.shared')} action={t('home2.seeAll')} onAction={() => router.push({ pathname: '/search', params: { mode: 'shared' } })} />
      {shared.length ? row(shared) : <StateView state="empty" compact title={t('home2.noShared')} />}
      <SectionHeader title={t('home2.returns')} action={t('home2.seeAll')} onAction={() => router.push({ pathname: '/search', params: { kind: 'return' } })} />
      {returns.length ? row(returns) : <StateView state="empty" compact title={t('home2.noReturns')} />}
      {recent.length > 0 && (
        <>
          <SectionHeader title={t('home2.recent')} action={t('home2.seeAll')} onAction={() => router.replace('/bookings')} />
          {recent.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </>
      )}
      <PrototypeNote text={t('home2.prototype')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, paddingBottom: Spacing.lg },
  title: { fontSize: 22, lineHeight: 30, fontFamily: Fonts.bold },
  publish: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5 },
  carousel: { gap: Spacing.sm, paddingEnd: Spacing.lg },
});
