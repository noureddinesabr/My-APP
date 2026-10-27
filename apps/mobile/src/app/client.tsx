import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useQuery } from '@/backend';
import { Callout, CalloutSlot } from '@/components/callout';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Rise } from '@/components/motion/quest';
import { Shimmer } from '@/components/motion/effects';
import { TruckScene } from '@/components/motion/scenes';
import { PlaceSearchSheet } from '@/components/place-search-sheet';
import { Text } from '@/components/text';
import { ForwardChevron } from '@/components/ui';
import { locationFromPoint, type Location } from '@/constants/places';
import { rememberPlace, useRecentPlaces } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { useMyLocation } from '@/lib/use-my-location';
import { useAccount } from '@/state/account';
import { requestProgress, useRequestDraft } from '@/state/request-draft';
import { Radius, rim, softShadow, Spacing, useColors } from '@/theme';

/**
 * Client home, map first and nothing else to read: where you are, the pickup pin, and one
 * big question — "Where to?" — with recent places one tap away. The rest is in the ☰ menu.
 */
export default function ClientHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { client } = useAccount();
  const requests = useQuery('requests', client ? [['clientId', client.id]] : null);
  const mine = [...(requests ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const inProgress = mine.filter((request) => request.status === 'open' || request.status === 'assigned');
  const live = mine.find((request) => request.status === 'assigned') ?? mine.find((request) => request.status === 'open');
  const { draft, hasDraft, update } = useRequestDraft();
  const me = useMyLocation();
  const recent = useRecentPlaces();
  const [searchOpen, setSearchOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);

  // Pickup: the saved draft's, else where the phone is (smart default), else the city centre.
  const pickup: Location = hasDraft || !me.point ? draft.from : locationFromPoint(me.point, 'gps');

  const startTo = (destination: Location) => {
    rememberPlace(destination);
    update({ from: pickup, to: destination, step: 0 });
    setSearchOpen(false);
    router.push('/request');
  };

  // The one thing to do next, floating at the bottom.
  const callout = live ? (
    <Callout
      icon={live.status === 'assigned' ? 'navigate' : 'radio'}
      tone={live.status === 'assigned' ? 'success' : undefined}
      title={t(live.status === 'assigned' ? 'home.trackTitle' : 'home.offersTitle')}
      body={names.shortRoute(live.from, live.to)}
      onPress={() => router.push({ pathname: '/track/[id]', params: { id: live.id } })}
    />
  ) : hasDraft ? (
    <Callout
      icon="time"
      title={t('request.resumeTitle')}
      body={names.shortRoute(draft.from, draft.to)}
      progress={requestProgress(draft.step)}
      onPress={() => router.push('/request')}
    />
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The map, with the blue "you are here" dot and the pickup pin. */}
      <View style={{ flex: 1 }}>
        <FreightMap
          bare
          fill
          style={styles.map}
          markers={[{ id: 'pickup', kind: 'pickup', lat: pickup.lat, lng: pickup.lng }]}
          userLocation={me.point}
          focus={[me.point ?? pickup]}
          focusKey={`${me.status}|${pickup.lat}|${pickup.lng}`}
        />
        <View style={styles.topRow} pointerEvents="box-none">
          <MenuButton badge={inProgress.length} />
          <View style={{ flex: 1 }} />
          {me.status === 'unavailable' && (
            <Animated.View entering={FadeInDown}>
              <PressableScale accessibilityRole="button" scaleTo={0.95} onPress={me.retry} style={[styles.pill, { backgroundColor: colors.surfaceFloating }, rim(colors)]}>
                <MaterialCommunityIcons name="crosshairs-off" size={18} color={colors.accent} />
                <Text variant="caption">{t('home.turnOnLocation')}</Text>
              </PressableScale>
            </Animated.View>
          )}
          <PressableScale accessibilityRole="button" accessibilityLabel={t('home.locateMe')} scaleTo={0.9} onPress={me.retry} style={[styles.roundGlass, softShadow(colors.shadow, 1)]}>
            <Glass style={styles.roundGlass} thickness="thick">
              {me.status === 'locating' ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="navigate" size={22} color={colors.location} />}
            </Glass>
          </PressableScale>
        </View>
        {/* "Set pickup point" on the map, like a ride app, but for the load. */}
        <PressableScale
          accessibilityRole="button"
          scaleTo={0.95}
          onPress={() => setPickupOpen(true)}
          style={[styles.pickupChip, { backgroundColor: colors.surfaceFloating }, rim(colors), softShadow(colors.shadow, 1)]}>
          <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} />
          <Text variant="label" numberOfLines={1} style={{ maxWidth: 220 }}>
            {t('home.pickupHere', { place: names.label(pickup) })}
          </Text>
          <ForwardChevron color={colors.textMuted} />
        </PressableScale>
      </View>

      {/* The panel under the map: one question. */}
      <View style={[styles.panel, { backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        {recent.length === 0 && (
          <Animated.View entering={FadeIn.duration(500)}>
            <TruckScene height={96} style={styles.scene} />
          </Animated.View>
        )}
        <Rise index={0}>
          <PressableScale
            accessibilityRole="search"
            accessibilityLabel={t('home.whereTo')}
            feedback={null}
            scaleTo={0.97}
            onPress={() => {
              play('pop');
              setSearchOpen(true);
            }}
            style={[styles.search, { backgroundColor: colors.cta }]}>
            <Shimmer color={`${colors.primary}55`} />
            <Ionicons name="search" size={24} color={colors.onCta} />
            <Text variant="title" color={colors.onCta} style={{ flex: 1 }}>
              {t('home.whereTo')}
            </Text>
          </PressableScale>
        </Rise>
        {recent.slice(0, 3).map((location, index) => (
          <Rise key={`${location.lat},${location.lng},${index}`} index={index + 1}>
            <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => startTo(location)} style={styles.recent}>
              <View style={[styles.recentIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              </View>
              <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>
                {names.label(location)}
              </Text>
              <ForwardChevron color={colors.textMuted} />
            </PressableScale>
          </Rise>
        ))}
        {callout && <View style={{ height: 76 }} />}
      </View>

      <CalloutSlot>{callout}</CalloutSlot>

      <PlaceSearchSheet
        visible={searchOpen}
        title={t('home.whereTo')}
        current={pickup}
        near={pickup}
        onClose={() => setSearchOpen(false)}
        onChoose={startTo}
      />
      <PlaceSearchSheet
        visible={pickupOpen}
        title={t('request.from')}
        current={pickup}
        near={pickup}
        allowGps
        onClose={() => setPickupOpen(false)}
        onChoose={(location) => {
          setPickupOpen(false);
          update({ from: location });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { ...StyleSheet.absoluteFill, borderRadius: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  roundGlass: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: Radius.pill },
  pickupChip: {
    position: 'absolute',
    bottom: Spacing.xl + Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  panel: {
    marginTop: -Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomWidth: 0,
  },
  scene: { borderRadius: Radius.lg, marginBottom: Spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 64, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  recentIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
