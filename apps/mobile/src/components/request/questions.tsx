import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { MediaField } from '@/components/media/media-field';
import { VoiceNoteField } from '@/components/media/voice-note-field';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Rise, TileGrid, useFit } from '@/components/motion/quest';
import { TurningVehicle } from '@/components/motion/turning-vehicle';
import { PlaceSearchSheet } from '@/components/place-search-sheet';
import { useMapPreview } from '@/components/map/preview';
import { WhenPicker } from '@/components/request/when-picker';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/ui';
import { FREIGHT_TYPES, needsCold, WEIGHT_OPTIONS } from '@/constants/freight';
import { VEHICLE_TYPES, vehicleImage } from '@/constants/vehicles';
import { formatWeight } from '@/components/request/format';
import { useLanguage } from '@/i18n/language-provider';
import { estimateDurationMinutes, HELPER_FEE, maxTons, suggestVehicle } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function useTripTime(km: number) {
  const { t } = useTranslation();
  const minutes = estimateDurationMinutes(km);
  return minutes >= 60 ? t('request.hours', { h: Math.floor(minutes / 60), m: minutes % 60 }) : t('request.minutes', { m: minutes });
}

/**
 * The two ends of the trip, each in its own colour and icon (the same as its pin on the map:
 * violet box = pickup, red flag = drop-off), with a clear "Change" button. While one is being
 * changed, the map above shows the best match as it is typed.
 */
export function RouteQuestion() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const preview = useMapPreview();
  const { draft, update } = useRequestDraft();
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);

  return (
    <>
      <Rise index={1}>
        <View style={[styles.ends, { backgroundColor: colors.surface }, rim(colors)]}>
          <EndRow
            icon="package-variant-closed"
            fill={colors.primaryFill}
            tint={colors.primary}
            label={t('request.from')}
            value={names.short(draft.from)}
            onPress={() => setEditing('from')}
          />
          <View style={[styles.endLink, { borderColor: colors.border }]} />
          <EndRow icon="flag-checkered" fill={colors.accentFill} tint={colors.accent} label={t('request.to')} value={names.short(draft.to)} onPress={() => setEditing('to')} />
        </View>
      </Rise>
      <PlaceSearchSheet
        visible={editing !== null}
        title={editing === 'from' ? t('request.from') : t('request.to')}
        current={editing === 'to' ? draft.to : draft.from}
        near={editing === 'to' ? draft.from : draft.to}
        allowGps={editing === 'from'}
        onPreview={preview.set}
        onClose={() => setEditing(null)}
        onChoose={(location) => {
          update(editing === 'from' ? { from: location } : { to: location });
          preview.set(null);
          setEditing(null);
        }}
      />
    </>
  );
}

function EndRow({ icon, fill, tint, label, value, onPress }: { icon: IconName; fill: string; tint: string; label: string; value: string; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scaleTo={0.98} onPress={onPress} style={styles.end}>
      <View style={[styles.endIcon, { backgroundColor: fill }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.onPrimary} />
      </View>
      <Text variant="caption" color={tint} style={styles.endLabel}>
        {label}
      </Text>
      <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
        {value}
      </Text>
      <View style={[styles.change, { borderColor: tint, backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name="pencil" size={14} color={tint} />
        <Text variant="caption" color={tint} style={styles.changeText}>
          {t('quest.change')}
        </Text>
      </View>
    </PressableScale>
  );
}

/** The nine kinds of load from everyday life, squeezed into one screen. */
export function WhatQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  return (
    <TileGrid
      columns={3}
      tiles={FREIGHT_TYPES.map((type) => ({
        key: type.id,
        icon: type.icon,
        title: t(`freight.${type.id}`),
        selected: draft.freightType === type.id,
        onPress: () => {
          // A new kind brings its typical weight until the weight is answered.
          update(draft.freightType === type.id ? {} : { freightType: type.id, tons: type.typicalTons, weightKnown: true, vehicleChosen: false });
          onDone();
        },
      }))}
    />
  );
}

/** "About how heavy?": rough weights from 250 kg to 30 t, or "I don't know". */
export function WeightQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const typical = FREIGHT_TYPES.find((type) => type.id === draft.freightType)?.typicalTons ?? 1;
  return (
    <TileGrid
      columns={5}
      tiles={[
        ...WEIGHT_OPTIONS.map((tons) => ({
          key: String(tons),
          title: formatWeight(t, tons),
          selected: draft.weightKnown && draft.tons === tons,
          onPress: () => {
            update({ tons, weightKnown: true, vehicleChosen: false });
            onDone();
          },
        })),
        {
          key: 'unknown',
          span: 3,
          icon: 'help-circle-outline' as const,
          title: t('quest.weightUnknown'),
          selected: !draft.weightKnown,
          onPress: () => {
            update({ tons: typical, weightKnown: false, vehicleChosen: false });
            onDone();
          },
        },
      ]}
    />
  );
}

/** Every vehicle at once, turning round, with what it can carry; the best fit is marked and picked. */
export function VehicleQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const cold = needsCold(draft.freightType);
  const best = suggestVehicle(draft.tons, cold);
  return (
    <TileGrid
      columns={5}
      layout="stack"
      maxHeight={84}
      tiles={VEHICLE_TYPES.map((vehicle, index) => ({
        key: vehicle.id,
        title: t(`vehicleShort.${vehicle.id}`),
        sub: t('request.upTo', { tons: maxTons(vehicle.id) }),
        media: (size) => <TurningVehicle vehicle={vehicle.id} width={size.width} height={size.height} offset={index / VEHICLE_TYPES.length} />,
        badge: vehicle.id === best ? t('quest.bestFit') : undefined,
        // Too small for a weight the client knows: still possible, but faded.
        dim: draft.weightKnown && maxTons(vehicle.id) < draft.tons,
        selected: draft.vehicle === vehicle.id,
        onPress: () => {
          update({ vehicle: vehicle.id, vehicleChosen: true });
          onDone();
        },
      }))}
    />
  );
}

export function WhenQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [scheduling, setScheduling] = useState(false);
  return (
    <>
      <TileGrid
        columns={3}
        layout="stack"
        maxHeight={96}
        tiles={[
          {
            key: 'asap',
            icon: 'lightning-bolt',
            title: t('quest.whenNow'),
            sub: t('quest.whenAsapShort'),
            selected: draft.when === 'now' && draft.pickupWindow === 'asap',
            onPress: () => {
              update({ when: 'now', pickupWindow: 'asap' });
              onDone();
            },
          },
          {
            key: '1h',
            icon: 'clock-outline',
            title: t('quest.whenHourShort'),
            sub: t('quest.whenHourSub'),
            selected: draft.when === 'now' && draft.pickupWindow === '1h',
            onPress: () => {
              update({ when: 'now', pickupWindow: '1h' });
              onDone();
            },
          },
          {
            key: 'later',
            icon: 'calendar-month-outline',
            title: t('quest.whenLaterShort'),
            sub: draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t('quest.pickDay'),
            selected: draft.when === 'scheduled',
            onPress: () => setScheduling(true),
          },
        ]}
      />
      <Sheet visible={scheduling} onClose={() => setScheduling(false)} title={t('quest.whenLater')} drag="handle" fullHeight>
        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
          <WhenPicker
            scheduleOnly
            when="scheduled"
            window={draft.pickupWindow}
            scheduledAt={draft.scheduledAt}
            onChange={(changes) => update({ ...changes, when: 'scheduled' })}
          />
        </ScrollView>
        <Button
          variant="accent"
          title={t('quest.pickupAt', { date: dates.pickupAt(draft.scheduledAt) })}
          sound="pop"
          onPress={() => {
            update({ when: 'scheduled' });
            setScheduling(false);
            onDone();
          }}
        />
      </Sheet>
    </>
  );
}

export function HelpersQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  return (
    <TileGrid
      columns={4}
      layout="stack"
      maxHeight={96}
      tiles={[0, 1, 2, 3].map((count) => ({
        key: String(count),
        icon: count === 0 ? 'account-check-outline' : count === 1 ? 'account-hard-hat' : 'account-group-outline',
        title: t(`quest.helpersShort${count}`),
        sub: count === 0 ? t('quest.helpersNone') : `+${formatMoney(t, count * HELPER_FEE)}`,
        selected: draft.helpers === count,
        onPress: () => {
          update({ helpers: count });
          onDone();
        },
      }))}
    />
  );
}

/**
 * Optional: a voice note and photos or videos. Kept on its own page so the thumbnails of
 * what was added still fit under the map.
 */
export function MediaQuestion() {
  const { draft, update } = useRequestDraft();
  return (
    <View style={{ gap: Spacing.xs + 2 }}>
      <Rise index={0}>
        <MediaField compact value={draft.media} onChange={(media) => update({ media })} />
      </Rise>
      <Rise index={1}>
        <VoiceNoteField compact value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
      </Rise>
    </View>
  );
}

/** Optional: a short note, and riding along with the goods. */
export function NoteQuestion() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  return (
    <View style={{ gap: Spacing.xs + 2 }}>
      <Rise index={0}>
        <TextInput
          value={draft.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder={t('request.notesPlaceholder')}
          multiline
          style={styles.note}
        />
      </Rise>
      <Rise index={1}>
        <PressableScale
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.rideAlong }}
          feedback={null}
          scaleTo={0.97}
          onPress={() => {
            play('pop');
            update({ rideAlong: !draft.rideAlong });
          }}
          style={[styles.toggle, { backgroundColor: draft.rideAlong ? colors.primarySoft : colors.surface }, rim(colors), draft.rideAlong && { borderColor: colors.primary }]}>
          <MaterialCommunityIcons name="seat-passenger" size={22} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {t('request.rideAlong')}
          </Text>
          <MaterialCommunityIcons
            name={draft.rideAlong ? 'toggle-switch' : 'toggle-switch-off-outline'}
            size={34}
            color={draft.rideAlong ? colors.primary : colors.textMuted}
          />
        </PressableScale>
      </Rise>
    </View>
  );
}

const PRICE_STEP = 10;

/** The client's own price, against the typical range (an estimate, labelled as such). */
export function PriceQuestion() {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl } = useLanguage();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const { price } = tripEstimate(draft);
  const position = draft.price < price.low ? 'low' : draft.price > price.high ? 'high' : 'in';
  const tone = { low: colors.accent, in: colors.success, high: colors.primary }[position];
  const when = draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t(draft.pickupWindow === '1h' ? 'request.whenHour' : 'quest.whenNow');
  // The vehicle drives in from the start of the line.
  const driveIn = (rtl ? FadeInRight : FadeInLeft).delay(120).springify().damping(13).stiffness(110);

  const { compact } = useFit(6);
  return (
    <View style={{ gap: compact ? Spacing.xs + 2 : Spacing.sm }}>
      {!compact && (
      <Animated.View entering={driveIn} style={{ alignItems: 'center' }}>
        <Image source={vehicleImage(draft.vehicle)} style={[styles.vehicle, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
      </Animated.View>
      )}
      <Rise index={1}>
        <Stepper
          value={draft.price}
          step={PRICE_STEP}
          min={PRICE_STEP}
          max={200_000}
          onChange={(value) => update({ price: value, priceChosen: true })}
          format={(value) => formatMoney(t, value)}
          editable
          unit={currencyUnit(t)}
        />
      </Rise>
      <Rise index={2}>
        <View style={[styles.verdict, { backgroundColor: colors.surface }, rim(colors)]}>
          <View style={[styles.verdictDot, { backgroundColor: tone }]} />
          <View style={{ flex: 1 }}>
            <Text variant="label" color={tone} numberOfLines={1} style={styles.verdictTitle}>
              {t(position === 'low' ? 'quest.priceLow' : position === 'high' ? 'quest.priceHigh' : 'quest.priceGood')}
            </Text>
            <Text variant="caption" muted numberOfLines={1} style={styles.verdictBody}>
              {t('quest.typical', { low: price.low.toLocaleString('fr-FR'), high: price.high.toLocaleString('fr-FR') })}
            </Text>
          </View>
        </View>
      </Rise>
      {/* Tight under the map: cash and the time go on the trip chip over the map instead. */}
      {!compact && (
        <Rise index={3}>
          <View style={styles.facts}>
            <Fact icon="cash" label={t('request.payCash')} />
            <Fact icon="calendar-clock" label={when} />
          </View>
        </Rise>
      )}
    </View>
  );
}

function Fact({ icon, label }: { icon: IconName; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: colors.surfaceMuted }]}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ends: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 2 },
  end: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  endIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  endLabel: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.bold },
  // The dotted line between the two ends, like the trip on the map.
  endLink: { height: 4, marginStart: 14, borderStartWidth: 2, borderStyle: 'dashed' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1.5 },
  changeText: { fontSize: 13, lineHeight: 17 },
  note: { minHeight: 58, maxHeight: 64, paddingVertical: 6, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: Radius.lg },
  vehicle: { width: 130, height: 70 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.lg },
  verdictDot: { width: 12, height: 12, borderRadius: 6 },
  verdictTitle: { fontSize: 15, lineHeight: 20 },
  verdictBody: { fontSize: 13, lineHeight: 17 },
  // One line always: long dates shorten with … instead of wrapping out of view.
  facts: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, flexShrink: 1 },
});
