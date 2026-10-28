import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { MediaField } from '@/components/media/media-field';
import { VoiceNoteField } from '@/components/media/voice-note-field';
import { currencyUnit, formatMoney, percentOf } from '@/components/money';
import { Pop, Shimmer } from '@/components/motion/effects';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ChoiceCard, FittedRows, Rise, useFit } from '@/components/motion/quest';
import { PlaceSearchSheet } from '@/components/place-search-sheet';
import { useMapPreview } from '@/components/map/preview';
import { WhenPicker } from '@/components/request/when-picker';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/ui';
import { FREIGHT_TYPES, needsCold } from '@/constants/freight';
import { formatWeight } from '@/components/request/format';
import { VEHICLE_TYPES, vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { estimateDurationMinutes, estimatePrice, HELPER_FEE, maxTons, suggestVehicle, suitableVehicles, type VehicleId } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * "About how heavy?" answers, each with an everyday example (people rarely know kilos):
 * from a few boxes to a full semi-trailer, or "I don't know".
 */
export const WEIGHTS: { id: string; tons: number | null; icon: IconName }[] = [
  { id: 'w250', tons: 0.25, icon: 'package-variant-closed' },
  { id: 'w500', tons: 0.5, icon: 'sofa-outline' },
  { id: 'w1000', tons: 1, icon: 'bed-outline' },
  { id: 'w1500', tons: 1.5, icon: 'car-pickup' },
  { id: 'w2000', tons: 2, icon: 'home-outline' },
  { id: 'w2500', tons: 2.5, icon: 'home-city-outline' },
  { id: 'w3000', tons: 3, icon: 'home-group' },
  { id: 'w7000', tons: 7, icon: 'warehouse' },
  { id: 'w10000', tons: 10, icon: 'forklift' },
  { id: 'w15000', tons: 15, icon: 'truck-cargo-container' },
  { id: 'w20000', tons: 20, icon: 'truck-trailer' },
  { id: 'w30000', tons: 30, icon: 'truck-trailer' },
  { id: 'unknown', tons: null, icon: 'help-circle-outline' },
];

export function useTripTime(km: number) {
  const { t } = useTranslation();
  const minutes = estimateDurationMinutes(km);
  return minutes >= 60 ? t('request.hours', { h: Math.floor(minutes / 60), m: minutes % 60 }) : t('request.minutes', { m: minutes });
}

/** The trip on a map, with the two ends as rows you can tap to change. */
export function RouteQuestion() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { draft, update } = useRequestDraft();
  const { km } = tripEstimate(draft);
  const time = useTripTime(km);
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const preview = useMapPreview();

  return (
    <>
      <Rise index={1}>
        <View style={[styles.ends, { backgroundColor: colors.surface }, rim(colors)]}>
          {/* Each end in the colour and icon of its pin on the map: violet box = pickup, red flag = drop-off. */}
          <EndRow
            icon="package-variant-closed"
            fill={colors.primaryFill}
            tint={colors.primary}
            label={t('map.pickup')}
            value={names.short(draft.from)}
            onPress={() => setEditing('from')}
          />
          <View style={[styles.endLink, { borderColor: colors.border }]} />
          <EndRow icon="flag-checkered" fill={colors.accentFill} tint={colors.accent} label={t('map.dropoff')} value={names.short(draft.to)} onPress={() => setEditing('to')} />
        </View>
      </Rise>
      <Rise index={2}>
        <View style={[styles.tripLine, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <MaterialCommunityIcons name="map-marker-distance" size={18} color={colors.primary} />
          <Text variant="label" color={colors.primary}>
            {t('quest.tripLine', { km, time })}
          </Text>
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
          // The pin on the map slides to the new place.
          update(editing === 'from' ? { from: location } : { to: location });
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
      <View style={styles.endPin}>
        <View style={[styles.endIcon, { backgroundColor: fill }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.onPrimary} />
        </View>
        <View style={[styles.endTip, { borderTopColor: fill }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={tint} style={styles.endLabel}>
          {label}
        </Text>
        <Text variant="subtitle" numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={[styles.change, { borderColor: tint, backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name="pencil" size={15} color={tint} />
        <Text variant="caption" color={tint} style={styles.changeText}>
          {t('quest.change')}
        </Text>
      </View>
    </PressableScale>
  );
}

export function WhatQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  // Two tiles per row.
  const pairs = FREIGHT_TYPES.reduce<(typeof FREIGHT_TYPES)[]>((rows, type, i) => (i % 2 ? (rows[rows.length - 1].push(type), rows) : [...rows, [type]]), []);
  return (
    <FittedRows
      more={t('quest.more')}
      back={t('quest.backOptions')}
      rows={pairs.map((pair, row) =>
        function typeRow(rowsOnPage: number) {
          return (
        <View key={pair[0].id} style={styles.grid}>
          {pair.map((type, i) => (
            <ChoiceCard
              key={type.id}
              index={row * 2 + i}
              rows={rowsOnPage}
              layout="tile"
              icon={type.icon}
              title={t(`freight.${type.id}`)}
              selected={draft.freightType === type.id}
              onPress={() => {
                // A new kind brings its typical weight until the weight question is answered.
                update(draft.freightType === type.id ? {} : { freightType: type.id, tons: type.typicalTons, weightKnown: true, vehicleChosen: false });
                onDone();
              }}
            />
          ))}
        </View>
          );
        },
      )}
    />
  );
}

export function SizeQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const typical = FREIGHT_TYPES.find((type) => type.id === draft.freightType)?.typicalTons ?? 1;
  // Two tiles per row, like "What are you moving?".
  const pairs = WEIGHTS.reduce<(typeof WEIGHTS)[]>((rows, weight, i) => (i % 2 ? (rows[rows.length - 1].push(weight), rows) : [...rows, [weight]]), []);
  return (
    <FittedRows
      more={t('quest.more')}
      back={t('quest.backOptions')}
      rows={pairs.map((pair, row) =>
        function weightRow(rowsOnPage: number) {
          return (
            <View key={pair[0].id} style={styles.grid}>
              {pair.map((weight, i) => (
                <ChoiceCard
                  key={weight.id}
                  index={row * 2 + i}
                  rows={rowsOnPage}
                  layout="tile"
                  icon={weight.icon}
                  title={weight.tons === null ? t('quest.weightUnknown') : `≈ ${formatWeight(t, weight.tons)}`}
                  hint={t(`quest.${weight.id}_hint`)}
                  selected={weight.tons === null ? !draft.weightKnown : draft.weightKnown && draft.tons === weight.tons}
                  onPress={() => {
                    update(weight.tons === null ? { tons: typical, weightKnown: false, vehicleChosen: false } : { tons: weight.tons, weightKnown: true, vehicleChosen: false });
                    onDone();
                  }}
                />
              ))}
            </View>
          );
        },
      )}
    />
  );
}

/** The best-fit vehicle first, then the next sizes up; the rest behind "See all vehicles". */
export function VehicleQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  const [all, setAll] = useState(false);
  const cold = needsCold(draft.freightType);
  const best = suggestVehicle(draft.tons, cold);
  const fits = suitableVehicles(draft.tons).filter((id) => cold || (id !== 'refrigerated' && id !== 'flatbed'));
  const shown = [...new Set([draft.vehicle, best, ...fits])].slice(0, 3).sort((a, b) => maxTons(a) - maxTons(b));

  const choose = (vehicle: VehicleId) => {
    update({ vehicle, vehicleChosen: true });
    setAll(false);
    onDone();
  };
  const row = (vehicle: VehicleId, index: number, rows?: number) => (
    <ChoiceCard
      key={vehicle}
      index={index}
      rows={rows}
      image={vehicleImage(vehicle)}
      title={t(`vehicle.${vehicle}`)}
      hint={t('request.upTo', { tons: maxTons(vehicle) })}
      badge={vehicle === best ? t('quest.bestFit') : undefined}
      selected={draft.vehicle === vehicle}
      onPress={() => choose(vehicle)}
    />
  );

  return (
    <>
      {shown.map((vehicle, index) => row(vehicle, index, 4))}
      <Rise index={4}>
        <PressableScale accessibilityRole="button" scaleTo={0.96} onPress={() => setAll(true)} style={styles.link}>
          <Ionicons name="grid-outline" size={18} color={colors.primary} />
          <Text variant="label" color={colors.primary}>
            {t('quest.allVehicles')}
          </Text>
        </PressableScale>
      </Rise>
      <Sheet visible={all} onClose={() => setAll(false)} title={t('quest.allVehicles')} drag="handle" overMap>
        <ScrollView contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl, paddingTop: Spacing.sm }}>
          {VEHICLE_TYPES.map((vehicle, index) => row(vehicle.id, index))}
        </ScrollView>
      </Sheet>
    </>
  );
}

export function WhenQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [scheduling, setScheduling] = useState(false);
  return (
    <>
      <ChoiceCard
        index={0}
        icon="lightning-bolt"
        rows={3}
        title={t('quest.whenNow')}
        hint={t('request.whenAsapWindow')}
        selected={draft.when === 'now' && draft.pickupWindow === 'asap'}
        onPress={() => {
          update({ when: 'now', pickupWindow: 'asap' });
          onDone();
        }}
      />
      <ChoiceCard
        index={1}
        icon="clock-outline"
        rows={3}
        title={t('request.whenHour')}
        hint={t('request.whenHourHint')}
        selected={draft.when === 'now' && draft.pickupWindow === '1h'}
        onPress={() => {
          update({ when: 'now', pickupWindow: '1h' });
          onDone();
        }}
      />
      <ChoiceCard
        index={2}
        icon="calendar-month-outline"
        rows={3}
        title={t('quest.whenLater')}
        hint={draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t('request.whenScheduleHint')}
        selected={draft.when === 'scheduled'}
        onPress={() => setScheduling(true)}
      />
      <Sheet visible={scheduling} onClose={() => setScheduling(false)} title={t('quest.whenLater')} drag="handle" overMap>
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
  const { km } = tripEstimate(draft);
  const trip = estimatePrice(draft.vehicle, km, 0).suggested;
  return (
    <>
      {[0, 1, 2, 3].map((count, index) => {
        const fee = count * HELPER_FEE;
        return (
          <ChoiceCard
            key={count}
            index={index}
            rows={4}
            icon={count === 0 ? 'account-check-outline' : count === 1 ? 'account-hard-hat' : 'account-group-outline'}
            title={t(`quest.helpers${count}`)}
            // The fee next to the trip it adds to (anchoring), never on its own.
            hint={count === 0 ? t('quest.helpers0_hint') : t('quest.helperCost', { percent: percentOf(fee, trip) })}
            aside={count === 0 ? undefined : `+${formatMoney(t, fee)}`}
            selected={draft.helpers === count}
            onPress={() => {
              update({ helpers: count });
              onDone();
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Optional: a voice note and photos or videos. Kept on its own page so the thumbnails of
 * what was added still fit under the map.
 */
export function MediaQuestion() {
  const { draft, update } = useRequestDraft();
  return (
    <View style={{ gap: Spacing.sm }}>
      <Rise index={0}>
        <MediaField compact value={draft.media} onChange={(media) => update({ media })} />
      </Rise>
      <Rise index={1}>
        <VoiceNoteField value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
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
    <View style={{ gap: Spacing.sm }}>
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
          <MaterialCommunityIcons name="seat-passenger" size={26} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {t('request.rideAlong')}
          </Text>
          <MaterialCommunityIcons
            name={draft.rideAlong ? 'toggle-switch' : 'toggle-switch-off-outline'}
            size={40}
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
  const toneSoft = { low: colors.accentSoft, in: colors.successSoft, high: colors.primarySoft }[position];
  const toneIcon = ({ low: 'alert-circle', in: 'check-circle', high: 'rocket-launch' } as const)[position];
  const when = draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t(draft.pickupWindow === '1h' ? 'request.whenHour' : 'quest.whenNow');
  // The vehicle drives in from the start of the line.
  const driveIn = (rtl ? FadeInRight : FadeInLeft).delay(120).springify().damping(13).stiffness(110);

  const { compact } = useFit(6);
  return (
    <View style={{ gap: Spacing.sm }}>
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
      {/* The price guide, impossible to miss: the usual range big and coloured, what the
          chosen price means, and one tap to use the suggested price. An estimate, said so. */}
      <Rise index={2}>
        <View style={[styles.guide, { backgroundColor: toneSoft, borderColor: tone }]}>
          <Shimmer every={2600} color="rgba(255,255,255,0.18)" />
          <View style={styles.guideTop}>
            <View style={[styles.guideIcon, { backgroundColor: tone }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={18} color={colors.onPrimary} />
            </View>
            <Text variant="caption" color={tone} style={styles.guideLabel}>
              {t('quest.suggestedLabel')}
            </Text>
          </View>
          <Text variant="title" color={tone} style={styles.guideRange}>
            {t('quest.suggestedRange', { low: price.low.toLocaleString('fr-FR'), high: price.high.toLocaleString('fr-FR') })}
          </Text>
          <Pop trigger={position}>
            <View style={styles.guideVerdict}>
              <MaterialCommunityIcons name={toneIcon} size={18} color={tone} />
              <Text variant="label" color={tone} style={{ flexShrink: 1 }}>
                {t(position === 'low' ? 'quest.priceLow' : position === 'high' ? 'quest.priceHigh' : 'quest.priceGood')}
              </Text>
            </View>
          </Pop>
          {draft.price !== price.suggested && (
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.95}
              onPress={() => {
                play('pop');
                update({ price: price.suggested, priceChosen: true });
              }}
              style={[styles.useSuggested, { backgroundColor: tone }]}>
              <MaterialCommunityIcons name="hand-pointing-up" size={16} color={colors.onPrimary} />
              <Text variant="label" color={colors.onPrimary}>
                {t('quest.useSuggested', { price: formatMoney(t, price.suggested) })}
              </Text>
            </PressableScale>
          )}
        </View>
      </Rise>
      <Rise index={3}>
        <View style={styles.facts}>
          <Fact icon="cash" label={t('request.payCash')} />
          <Fact icon="calendar-clock" label={when} />
        </View>
      </Rise>
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
  ends: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md },
  end: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  // A little pin like the ones on the map: round head, triangle pointing down.
  endPin: { alignItems: 'center' },
  endIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  endTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  endLabel: { fontFamily: Fonts.bold },
  // The dotted line between the two ends, like the trip on the map.
  endLink: { height: 10, marginStart: 17, borderStartWidth: 2, borderStyle: 'dashed' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1.5 },
  changeText: { fontSize: 14, lineHeight: 19, fontFamily: Fonts.bold },
  tripLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 48 },
  note: { minHeight: 96, maxHeight: 120, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, minHeight: 64, borderRadius: Radius.lg },
  vehicle: { width: 130, height: 70 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  verdictDot: { width: 12, height: 12, borderRadius: 6 },
  guide: { borderRadius: Radius.lg, borderWidth: 2, padding: Spacing.md, gap: 4, overflow: 'hidden' },
  guideTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  guideIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  guideLabel: { fontFamily: Fonts.bold, fontSize: 14 },
  guideRange: { fontSize: 24, lineHeight: 34 },
  guideVerdict: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  useSuggested: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, marginTop: 4 },
  // One line always: long dates shorten with … instead of wrapping out of view.
  facts: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, flexShrink: 1 },
});
