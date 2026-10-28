import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useQuery } from '@/backend';
import { Callout, CalloutSlot } from '@/components/callout';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Rise } from '@/components/motion/quest';
import { Shimmer } from '@/components/motion/effects';
import { PlaceSearchSheet } from '@/components/place-search-sheet';
import { Text } from '@/components/text';
import { ForwardChevron } from '@/components/ui';
import { locationFromPoint, type Location } from '@/constants/places';
import { rememberPlace, useRecentPlaces } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { useMyLocation } from '@/lib/use-my-location';
import { useAccount } from '@/state/account';
import { requestProgress, useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, rim, softShadow, Spacing, useColors } from '@/theme';

/**
 * Client home, map first and nothing else to read: you on the map, then two questions one
 * after the other — "From where?" (here, or another place) and "Where to?" — with recent
 * places one tap away. The rest is in the ☰ menu.
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
  // The place being looked up, shown on the map while typing (the map follows the search).
  const [preview, setPreview] = useState<Location | null>(null);
  // First where the load is, then where it goes.
  const [step, setStep] = useState<'from' | 'to'>('from');

  // Pickup: the saved draft's, else where the phone is (smart default), else the city centre.
  const pickup: Location = hasDraft || !me.point ? draft.from : locationFromPoint(me.point, 'gps');

  const startTo = (destination: Location) => {
    setPreview(null);
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
      {/* The map, with you as a little person standing at the pickup (GPS or picked by hand). */}
      <View style={{ flex: 1 }}>
        <FreightMap
          bare
          fill
          style={styles.map}
          inset={{ top: 100, bottom: 96 }}
          markers={preview ? [{ id: 'preview', kind: searchOpen ? 'dropoff' : 'pick', lat: preview.lat, lng: preview.lng, label: searchOpen ? t('map.dropoff') : t('map.pickup') }] : []}
          person={pickup}
          focus={[preview ?? pickup]}
          focusKey={preview ? `p${preview.lat},${preview.lng}` : `${me.status}|${pickup.lat}|${pickup.lng}`}
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
      </View>

      {/* The panel under the map: one question at a time. */}
      <View style={[styles.panel, { backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        {step === 'from' ? (
          <Animated.View key="from" entering={FadeInDown.springify().damping(15)} style={{ gap: Spacing.sm }}>
            <View style={styles.question}>
              <PinIcon fill={colors.primaryFill} icon="package-variant-closed" />
              <Text variant="title" style={{ flex: 1 }}>
                {t('home.whereFrom')}
              </Text>
            </View>
            {/* Smart default: where the phone is (or the place chosen before), confirmed in one tap. */}
            <PressableScale
              accessibilityRole="button"
              feedback={null}
              scaleTo={0.97}
              onPress={() => {
                play('pop');
                update({ from: pickup });
                setStep('to');
              }}
              style={[styles.search, { backgroundColor: colors.cta }]}>
              <Shimmer color={`${colors.primary}55`} />
              <MaterialCommunityIcons name={pickup.source === 'gps' ? 'crosshairs-gps' : 'map-marker-check'} size={26} color={colors.onCta} />
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.onCta}>
                  {names.label(pickup)}
                </Text>
                <Text variant="caption" color={colors.onCta} style={{ opacity: 0.8 }}>
                  {t('home.fromHere')}
                </Text>
              </View>
              <ForwardChevron color={colors.onCta} />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.97}
              onPress={() => setPickupOpen(true)}
              style={[styles.other, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
              <Ionicons name="search" size={20} color={colors.primary} />
              <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
                {t('home.fromOther')}
              </Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <Animated.View key="to" entering={FadeInDown.springify().damping(15)} style={{ gap: Spacing.sm }}>
            {/* Where the load is, with a way back to change it. */}
            <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => setStep('from')} style={styles.fromRow}>
              <PinIcon fill={colors.primaryFill} icon="package-variant-closed" small />
              <Text variant="caption" color={colors.primary} style={styles.fromLabel}>
                {t('map.pickup')}
              </Text>
              <Text variant="label" style={{ flex: 1 }}>
                {names.short(pickup)}
              </Text>
              <View style={[styles.change, { borderColor: colors.primary }]}>
                <MaterialCommunityIcons name="pencil" size={13} color={colors.primary} />
                <Text variant="caption" color={colors.primary}>
                  {t('quest.change')}
                </Text>
              </View>
            </PressableScale>
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
              <PinIcon fill={colors.accentFill} icon="flag-checkered" />
              <Text variant="title" color={colors.onCta} style={{ flex: 1 }}>
                {t('home.whereTo')}
              </Text>
              <Ionicons name="search" size={22} color={colors.onCta} />
            </PressableScale>
            {names
              .unique(recent)
              .filter((location) => names.label(location) !== names.label(pickup))
              .slice(0, 3)
              .map((location, index) => (
                <Rise key={`${location.lat},${location.lng},${index}`} index={index + 1}>
                  <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => startTo(location)} style={styles.recent}>
                    <View style={[styles.recentIcon, { backgroundColor: colors.surfaceMuted }]}>
                      <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                    </View>
                    <Text variant="subtitle" style={{ flex: 1 }}>
                      {names.label(location)}
                    </Text>
                    <ForwardChevron color={colors.textMuted} />
                  </PressableScale>
                </Rise>
              ))}
          </Animated.View>
        )}
      </View>

      <CalloutSlot>{callout}</CalloutSlot>

      <PlaceSearchSheet
        visible={searchOpen}
        title={t('home.whereTo')}
        current={pickup}
        near={pickup}
        onClose={() => setSearchOpen(false)}
        onChoose={startTo}
        onPreview={setPreview}
      />
      <PlaceSearchSheet
        visible={pickupOpen}
        title={t('request.from')}
        current={pickup}
        near={pickup}
        allowGps
        onClose={() => setPickupOpen(false)}
        onPreview={setPreview}
        onChoose={(location) => {
          setPickupOpen(false);
          setPreview(null);
          // The person walks to the new pickup on the map, and the next question comes up.
          update({ from: location });
          setStep('to');
        }}
      />
    </View>
  );
}

/** A little map pin (round head on a point), the same as the pickup / drop-off pins on the map. */
function PinIcon({ fill, icon, small }: { fill: string; icon: 'package-variant-closed' | 'flag-checkered'; small?: boolean }) {
  const colors = useColors();
  const size = small ? 26 : 34;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={small ? 14 : 18} color={colors.onPrimary} />
      </View>
      <View style={[styles.pinTip, { borderTopColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  question: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  other: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5 },
  fromRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  fromLabel: { fontFamily: Fonts.bold },
  change: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1.5 },
  pinTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  map: { ...StyleSheet.absoluteFill, borderRadius: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  roundGlass: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: Radius.pill },
  panel: {
    marginTop: -Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomWidth: 0,
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 64, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  recentIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
