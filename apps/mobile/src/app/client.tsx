import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { FreightRequest } from '@/backend/types';
import { BentoGrid, BentoRow, BentoTile } from '@/components/bento';
import { Callout, Dock } from '@/components/dock';
import { HomeHeader } from '@/components/home-header';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Button, ForwardChevron, Screen } from '@/components/ui';
import { VEHICLE_TYPES, vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { estimatePrice, IN_CITY_KM } from '@/lib/pricing';
import { useAccount } from '@/state/account';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

/** Progress of a saved draft: account type + furthest wizard step reached, out of 5. */
const draftPercent = (step: number) => Math.round(((step + 1) / 5) * 100);

/** Typical in-city move in a small van, shown before any sign-up (an estimate, labelled as such). */
const IN_CITY_FROM = estimatePrice('smallVan', IN_CITY_KM, 0).suggested;

export default function ClientHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { client } = useAccount();
  const requests = useQuery('requests', client ? [['clientId', client.id]] : null);
  const mine = [...(requests ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const inProgress = mine.filter((request) => request.status === 'open' || request.status === 'assigned');
  const assigned = mine.find((request) => request.status === 'assigned');
  const { rtl } = useLanguage();
  const { draft, hasDraft } = useRequestDraft();
  const [requestsOpen, setRequestsOpen] = useState(false);
  // Vehicles should drive in the reading direction.
  const flip = rtl ? { transform: [{ scaleX: -1 }] } : undefined;

  const newRequest = () => router.push('/request');
  const openRequest = (request: FreightRequest) => router.push({ pathname: '/track/[id]', params: { id: request.id } });

  // The most likely next step floats above the dock.
  const callout = assigned ? (
    <Callout
      icon="navigate"
      tone="success"
      title={t('home.trackTitle')}
      body={names.cityRoute(assigned.from, assigned.to)}
      onPress={() => openRequest(assigned)}
    />
  ) : hasDraft ? (
    <Callout
      icon="time"
      title={t('request.resumeTitle')}
      body={`${names.cityRoute(draft.from, draft.to)} · ${t('request.percentDone', { percent: draftPercent(draft.step) })}`}
      progress={draftPercent(draft.step) / 100}
      onPress={newRequest}
    />
  ) : undefined;

  return (
    <Screen
      glow
      header={<HomeHeader title={t('client.greeting')} subtitle={t('client.whereTo')} />}
      overlay={
        <Dock
          callout={callout}
          items={[
            { key: 'home', icon: 'home', label: t('home.tabHome'), active: true, onPress: () => {} },
            {
              key: 'requests',
              icon: 'list',
              label: t('home.tabRequests'),
              badge: inProgress.length,
              onPress: () => setRequestsOpen(true),
            },
            { key: 'new', icon: 'add', label: t('home.tabNew'), main: true, onPress: newRequest },
            { key: 'profile', icon: 'person', label: t('home.tabProfile'), onPress: () => router.push('/profile') },
            { key: 'settings', icon: 'settings', label: t('home.tabSettings'), onPress: () => router.push('/settings') },
          ]}
        />
      }>
      <BentoGrid>
        {/* 2x2 focus module: post a request */}
        <BentoTile size="2x2" tone="hero">
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('home.heroKicker')}
          </Text>
          <Text variant="hero" color={colors.onHero}>
            {t('request.newRequest')}
          </Text>
          <View style={styles.heroRoute}>
            <Ionicons name="location" size={16} color={colors.onHero} />
            <Text variant="caption" color={colors.onHero} numberOfLines={1}>
              {names.label(draft.from)}
            </Text>
          </View>
          <Image source={vehicleImage('truck35')} style={[styles.heroTruck, flip]} contentFit="contain" />
          <Button
            title={hasDraft ? t('request.resumeTitle') : t('client.postRequest')}
            variant="accent"
            icon="flash"
            onPress={newRequest}
          />
          <Text variant="caption" color={colors.onHeroMuted} center>
            {t('request.noAccountNeeded')}
          </Text>
        </BentoTile>

        {/* 1x1 metrics */}
        <BentoRow>
          <BentoTile size="1x1" onPress={() => setRequestsOpen(true)} label={t('client.myRequests')}>
            <Ionicons name="list" size={22} color={colors.primary} />
            <Text variant="display">{inProgress.length}</Text>
            <Text variant="caption" muted>
              {t('home.inProgress')}
            </Text>
          </BentoTile>
          <BentoTile size="1x1" tone="soft" onPress={newRequest} label={t('home.estimateTitle')}>
            <Ionicons name="pricetag" size={22} color={colors.primary} />
            <Text variant="title" color={colors.primary}>
              {t('home.from', { price: formatMoney(t, IN_CITY_FROM) })}
            </Text>
            <Text variant="caption" color={colors.primary}>
              {t('home.estimateBody')}
            </Text>
          </BentoTile>
        </BentoRow>

        {/* 2x1 banner: latest request, live */}
        {mine[0] && (
          <BentoTile size="2x1" onPress={() => openRequest(mine[0])} label={t('client.myRequests')}>
            <Text variant="caption" muted>
              {t('home.latest')}
            </Text>
            <RequestSummary request={mine[0]} />
          </BentoTile>
        )}

        {/* 2xauto: vehicles */}
        <BentoTile size="2xauto">
          <Text variant="subtitle">{t('client.vehicles')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicles}>
            {VEHICLE_TYPES.map((vehicle) => (
              <View key={vehicle.id} style={[styles.vehicle, { backgroundColor: colors.surfaceMuted }]}>
                <Image source={vehicleImage(vehicle.id)} style={[styles.vehicleImage, flip]} contentFit="contain" />
                <Text variant="caption" center numberOfLines={2}>
                  {t(`vehicle.${vehicle.id}`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </BentoTile>

        {/* 2xauto: how it works */}
        <BentoTile size="2xauto">
          <Text variant="subtitle">{t('client.howItWorks')}</Text>
          {(['client.step1', 'client.step2', 'client.step3'] as const).map((key, index) => (
            <View key={key} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primaryFill }]}>
                <Text variant="label" color={colors.onPrimary}>
                  {index + 1}
                </Text>
              </View>
              <Text style={{ flex: 1 }}>{t(key)}</Text>
            </View>
          ))}
        </BentoTile>
      </BentoGrid>

      <Sheet visible={requestsOpen} onClose={() => setRequestsOpen(false)} title={t('client.myRequests')}>
        {mine.length === 0 ? (
          <Text muted center>
            {t('home.noRequests')}
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: Spacing.sm }}>
            {mine.slice(0, 12).map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                onPress={() => {
                  setRequestsOpen(false);
                  openRequest(request);
                }}
              />
            ))}
          </ScrollView>
        )}
        <Button
          title={t('client.postRequest')}
          variant="accent"
          icon="add"
          onPress={() => {
            setRequestsOpen(false);
            newRequest();
          }}
        />
      </Sheet>
    </Screen>
  );
}

const STATUS_TONE = { open: 'primary', assigned: 'success', completed: 'muted', cancelled: 'accent' } as const;

function useStatusColor(request: FreightRequest) {
  const colors = useColors();
  const tone = STATUS_TONE[request.status];
  return tone === 'muted' ? colors.textMuted : colors[tone];
}

function RequestSummary({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const color = useStatusColor(request);
  return (
    <View style={styles.summary}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {names.cityRoute(request.from, request.to)}
        </Text>
        <Text variant="caption" color={color}>
          {t(`requestStatus.${request.status}`)}
        </Text>
      </View>
      <Text variant="subtitle">{formatMoney(t, request.price)}</Text>
      <ForwardChevron color={colors.textMuted} />
    </View>
  );
}

function RequestRow({ request, onPress }: { request: FreightRequest; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.requestRow, { backgroundColor: colors.surface }]}>
      <RequestSummary request={request} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  heroTruck: { flex: 1, minHeight: 90, width: '100%' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  requestRow: { padding: Spacing.md, borderRadius: Radius.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  vehicles: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  vehicle: { width: 120, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: Spacing.xs },
  vehicleImage: { width: 104, height: 65 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
