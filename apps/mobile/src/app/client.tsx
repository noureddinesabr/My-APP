import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuery } from '@/backend';
import type { FreightRequest } from '@/backend/types';
import { BentoGrid, BentoRow, BentoTile } from '@/components/bento';
import { Callout, CalloutSlot } from '@/components/callout';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MapPicker } from '@/components/map-picker';
import { MenuButton } from '@/components/menu-drawer';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PlaceResults } from '@/components/place-search';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { ForwardChevron } from '@/components/ui';
import { VEHICLE_TYPES, vehicleImage } from '@/constants/vehicles';
import { locationFromPoint, type Location } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';
import { estimatePrice, IN_CITY_KM } from '@/lib/pricing';
import { rememberPlace, useRecentPlaces } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { useMyLocation } from '@/lib/use-my-location';
import { useAccount } from '@/state/account';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, rim, softShadow, Spacing, useColors } from '@/theme';

/** Progress of a saved draft: account type + furthest wizard step reached, out of 5. */
const draftPercent = (step: number) => Math.round(((step + 1) / 5) * 100);

/** Typical in-city move in a small van, shown before any sign-up (an estimate, labelled as such). */
const IN_CITY_FROM = estimatePrice('smallVan', IN_CITY_KM, 0).suggested;

/**
 * Client home, map first: where you are, where the load is picked up, and one question —
 * "Where to?". Everything else (requests, profile, settings) is in the ☰ menu.
 */
export default function ClientHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const names = useLocationLabel();
  const { rtl } = useLanguage();
  const { client } = useAccount();
  const requests = useQuery('requests', client ? [['clientId', client.id]] : null);
  const mine = [...(requests ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const inProgress = mine.filter((request) => request.status === 'open' || request.status === 'assigned');
  const assigned = mine.find((request) => request.status === 'assigned');
  const { draft, hasDraft, update } = useRequestDraft();
  const me = useMyLocation();
  const recent = useRecentPlaces();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pickupOpen, setPickupOpen] = useState(false);
  const flip = rtl ? { transform: [{ scaleX: -1 }] } : undefined;
  const mapHeight = Math.round(screen * 0.44);

  // Pickup: the saved draft's, else where the phone is (smart default), else the city centre.
  const pickup: Location = hasDraft || !me.point ? draft.from : locationFromPoint(me.point, 'gps');

  const startTo = (destination: Location) => {
    play('tap');
    rememberPlace(destination);
    update({ from: pickup, to: destination });
    setSearchOpen(false);
    setQuery('');
    router.push('/request');
  };

  const openRequest = (request: FreightRequest) => router.push({ pathname: '/track/[id]', params: { id: request.id } });

  // The most likely next step, floating at the bottom.
  const callout = assigned ? (
    <Callout icon="navigate" tone="success" title={t('home.trackTitle')} body={names.cityRoute(assigned.from, assigned.to)} onPress={() => openRequest(assigned)} />
  ) : hasDraft ? (
    <Callout
      icon="time"
      title={t('request.resumeTitle')}
      body={`${names.cityRoute(draft.from, draft.to)} · ${t('request.percentDone', { percent: draftPercent(draft.step) })}`}
      progress={draftPercent(draft.step) / 100}
      onPress={() => router.push('/request')}
    />
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The map, with the blue "you are here" dot and the pickup pin. */}
      <FreightMap
        bare
        height={mapHeight + Radius.xl}
        style={styles.map}
        markers={[{ id: 'pickup', kind: 'pickup', lat: pickup.lat, lng: pickup.lng }]}
        userLocation={me.point}
        focus={[me.point ?? pickup]}
        focusKey={`${me.status}|${pickup.lat}|${pickup.lng}`}
      />

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <MenuButton badge={inProgress.length} />
          <View style={{ flex: 1 }} />
          <PressableScale accessibilityRole="button" accessibilityLabel={t('home.locateMe')} scaleTo={0.9} onPress={me.retry} style={[styles.roundGlass, softShadow(colors.shadow, 1)]}>
            <Glass style={styles.roundGlass} thickness="thick">
              {me.status === 'locating' ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="navigate" size={22} color={colors.location} />}
            </Glass>
          </PressableScale>
        </View>
        {me.status === 'unavailable' && (
          <Animated.View entering={FadeInDown}>
            <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={me.retry} style={[styles.banner, { backgroundColor: colors.surfaceFloating }, rim(colors)]}>
              <View style={[styles.bannerIcon, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name="crosshairs-question" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{t('home.notFoundTitle')}</Text>
                <Text variant="caption" muted>
                  {t('home.notFoundBody')}
                </Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* "Set pickup point" on the map, like a ride app, but for the load. */}
      <PressableScale
        accessibilityRole="button"
        scaleTo={0.95}
        onPress={() => setPickupOpen(true)}
        style={[styles.pickupChip, { top: mapHeight - 64, backgroundColor: colors.surfaceFloating }, rim(colors), softShadow(colors.shadow, 1)]}>
        <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} />
        <Text variant="label" numberOfLines={1} style={{ maxWidth: 220 }}>
          {t('home.pickupHere', { place: names.label(pickup) })}
        </Text>
        <ForwardChevron color={colors.textMuted} />
      </PressableScale>

      {/* The panel over the map. */}
      <View style={[styles.panel, { top: mapHeight, backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <ScrollView contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + (callout ? 120 : 32) }]} showsVerticalScrollIndicator={false}>
          <PressableScale
            accessibilityRole="search"
            accessibilityLabel={t('home.whereTo')}
            scaleTo={0.98}
            onPress={() => setSearchOpen(true)}
            style={[styles.search, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="search" size={24} color={colors.text} />
            <Text variant="subtitle" style={{ flex: 1 }}>
              {t('home.whereTo')}
            </Text>
            <View style={[styles.searchGo, { backgroundColor: colors.cta }]}>
              <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={18} color={colors.onCta} />
            </View>
          </PressableScale>

          {recent.slice(0, 3).map((location, index) => (
            <PressableScale key={`${location.lat},${location.lng},${index}`} accessibilityRole="button" scaleTo={0.98} onPress={() => startTo(location)} style={styles.recent}>
              <View style={[styles.recentIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              </View>
              <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                {names.label(location)}
              </Text>
            </PressableScale>
          ))}

          <BentoGrid>
            <BentoRow>
              <BentoTile size="1x1" tone="hero" onPress={() => router.push('/request')} label={t('client.postRequest')}>
                <Ionicons name="flash" size={22} color={colors.onHero} />
                <Text variant="subtitle" color={colors.onHero}>
                  {hasDraft ? t('request.resumeTitle') : t('client.postRequest')}
                </Text>
                <View style={{ flex: 1 }} />
                <Image source={vehicleImage('smallVan')} style={[styles.tileVan, flip]} contentFit="contain" />
              </BentoTile>
              <BentoTile size="1x1" tone="soft" onPress={() => setSearchOpen(true)} label={t('home.estimateTitle')}>
                <Ionicons name="pricetag" size={22} color={colors.primary} />
                <Text variant="title" color={colors.primary}>
                  {t('home.from', { price: formatMoney(t, IN_CITY_FROM) })}
                </Text>
                <Text variant="caption" color={colors.primary}>
                  {t('home.estimateBody')}
                </Text>
              </BentoTile>
            </BentoRow>

            {mine[0] && (
              <BentoTile size="2x1" onPress={() => openRequest(mine[0])} label={t('client.myRequests')}>
                <Text variant="caption" muted>
                  {t('home.latest')} · {t('home.inProgressCount', { count: inProgress.length })}
                </Text>
                <RequestSummary request={mine[0]} />
              </BentoTile>
            )}

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
        </ScrollView>
      </View>

      <CalloutSlot>{callout}</CalloutSlot>

      {/* Where to? — search with suggestions from the first letters. */}
      <Sheet visible={searchOpen} onClose={() => setSearchOpen(false)} title={t('home.whereTo')} drag="handle" fullHeight>
        <View style={[styles.fromRow, { backgroundColor: colors.surface }]}>
          <View style={[styles.dot, { borderColor: colors.primaryFill }]} />
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {t('home.from_pickup', { place: names.label(pickup) })}
          </Text>
        </View>
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} />
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
          <PlaceResults query={query} near={pickup} onChoose={startTo} />
          {!query && (
            <Text variant="caption" muted center style={{ marginTop: Spacing.md }}>
              {t('home.searchHint')}
            </Text>
          )}
        </ScrollView>
      </Sheet>

      <MapPicker
        visible={pickupOpen}
        title={t('request.atPickup')}
        initial={pickup}
        onClose={() => setPickupOpen(false)}
        onConfirm={(location) => {
          setPickupOpen(false);
          rememberPlace(location);
          update({ from: location });
        }}
      />
    </View>
  );
}

const STATUS_TONE = { open: 'primary', assigned: 'success', completed: 'muted', cancelled: 'accent' } as const;

function RequestSummary({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const tone = STATUS_TONE[request.status];
  const color = tone === 'muted' ? colors.textMuted : colors[tone];
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

const styles = StyleSheet.create({
  map: { position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 0 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.sm },
  roundGlass: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pickupChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: Spacing.sm },
  panelContent: { padding: Spacing.lg, gap: Spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 64, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg },
  searchGo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  recentIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileVan: { width: '100%', height: 60 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  vehicles: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  vehicle: { width: 120, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: Spacing.xs },
  vehicleImage: { width: 104, height: 65 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fromRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
});
