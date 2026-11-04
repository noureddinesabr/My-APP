import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { MediaField } from '@/components/media/media-field';
import { VoiceNoteField } from '@/components/media/voice-note-field';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ChoiceCard, FittedRows, Rise } from '@/components/motion/quest';
import { TypewriterHint } from '@/components/motion/typewriter';
import { PlaceSearchSheet } from '@/components/place-search-sheet';
import { useMapPreview } from '@/components/map/preview';
import { earliestTime, nearestBookable, timeLeftToday, TimeWheels } from '@/components/request/time-wheels';
import { dayKey, fromLocalString, toLocalString } from '@/lib/schedule';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { Button } from '@/components/ui';
import { FREIGHT_TYPES, needsCold, typicalTonsFor, WEIGHT_OPTIONS, type FreightTypeId } from '@/constants/freight';
import { formatWeight } from '@/components/request/format';
import { VEHICLE_TYPES, vehicleIcon, vehicleImage } from '@/constants/vehicles';
import { estimateDurationMinutes, maxTons, suggestVehicle } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * "About how heavy?": just weights, from 250 kg to 40 t, or "I don't know". The box icon
 * grows with the weight, so the size reads at a glance.
 */
export const WEIGHTS: { id: string; tons: number | null; icon: IconName; scale: number }[] = [
  ...WEIGHT_OPTIONS.map((tons, i) => ({
    id: `w${tons * 1000}`,
    tons,
    icon: (tons < 1 ? 'package-variant-closed' : tons < 7 ? 'package-variant' : 'dolly') as IconName,
    scale: 0.8 + (0.45 * i) / (WEIGHT_OPTIONS.length - 1),
  })),
  { id: 'unknown', tons: null, icon: 'help-circle-outline', scale: 1 },
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
        <Text variant="subtitle">
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

/**
 * The kinds of load from everyday life. Several can be ticked (a home move plus some building
 * materials…); "Next" moves on once at least one is chosen.
 */
export function WhatQuestion() {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  // Two tiles per row.
  const pairs = FREIGHT_TYPES.reduce<(typeof FREIGHT_TYPES)[]>((rows, type, i) => (i % 2 ? (rows[rows.length - 1].push(type), rows) : [...rows, [type]]), []);
  const toggle = (id: FreightTypeId) => {
    const chosen = draft.freightTypes.includes(id) ? draft.freightTypes.filter((type) => type !== id) : [...draft.freightTypes, id];
    // The usual weight follows the kinds until the weight question is answered.
    update({ freightTypes: chosen, ...(chosen.length ? { tons: typicalTonsFor(chosen), weightKnown: true, vehicleChosen: false } : {}) });
  };
  return (
    <FittedRows
      id="what"
      more={t('quest.more')}
      back={t('quest.backOptions')}
      picked={pairs.map((pair) => pair.filter((type) => draft.freightTypes.includes(type.id)).length)}
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
                  multi
                  icon={type.icon}
                  title={t(`freight.${type.id}`)}
                  selected={draft.freightTypes.includes(type.id)}
                  onPress={() => toggle(type.id)}
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
  const typical = typicalTonsFor(draft.freightTypes);
  // Two tiles per row, like "What are you moving?".
  const pairs = WEIGHTS.reduce<(typeof WEIGHTS)[]>((rows, weight, i) => (i % 2 ? (rows[rows.length - 1].push(weight), rows) : [...rows, [weight]]), []);
  return (
    <FittedRows
      id="size"
      remember={false}
      more={t('quest.more')}
      back={t('quest.backOptions')}
      picked={pairs.map((pair) => pair.filter((weight) => (weight.tons === null ? !draft.weightKnown : draft.weightKnown && draft.tons === weight.tons)).length)}
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
                  iconScale={weight.scale}
                  title={weight.tons === null ? t('quest.weightUnknown') : `≈ ${formatWeight(t, weight.tons)}`}
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

/**
 * Every vehicle, one per row with its picture, name and how much it carries (split over pages
 * when they don't all fit); the best fit for the weight is marked. The choice is a preference: drivers with other
 * vehicles (e.g. a big truck going back empty on this road) can still offer.
 */
export function VehicleQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const best = suggestVehicle(draft.tons, needsCold(draft.freightTypes));
  // One vehicle per row (picture, name, what it carries) so every name reads in full;
  // the rest are a page away.
  return (
    <FittedRows
      id="vehicle"
      remember={false}
      more={t('quest.more')}
      back={t('quest.backOptions')}
      picked={VEHICLE_TYPES.map((vehicle) => (draft.vehicle === vehicle.id ? 1 : 0))}
      rows={VEHICLE_TYPES.map((vehicle, row) =>
        function vehicleRow(rowsOnPage: number) {
          return (
            <ChoiceCard
              key={vehicle.id}
              index={row}
              rows={rowsOnPage}
              image={vehicleImage(vehicle.id)}
              title={t(`vehicle.${vehicle.id}`)}
              aside={t('request.upTo', { tons: maxTons(vehicle.id) })}
              badge={vehicle.id === best ? t('quest.bestFit') : undefined}
              selected={draft.vehicle === vehicle.id}
              onPress={() => {
                update({ vehicle: vehicle.id, vehicleChosen: true });
                onDone();
              }}
            />
          );
        },
      )}
    />
  );
}

/**
 * When: right now (a driver in 10–30 min), today at a time picked on clock wheels, or another
 * day (up to two weeks ahead) picked on calendar + clock wheels. Every wheel step clicks.
 */
export function WhenQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [wheel, setWheel] = useState<'today' | 'date' | null>(null);
  const [pending, setPending] = useState(draft.scheduledAt);
  const now = new Date();
  const scheduledDay = draft.when === 'scheduled' ? dayKey(fromLocalString(draft.scheduledAt)) : null;
  const isToday = scheduledDay === dayKey(now);
  const todayOpen = timeLeftToday(now);

  const open = (mode: 'today' | 'date') => {
    const start =
      mode === 'today'
        ? isToday
          ? draft.scheduledAt
          : toLocalString(nearestBookable(earliestTime(now), now))
        : draft.when === 'scheduled' && !isToday
          ? draft.scheduledAt
          : toLocalString(nearestBookable(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0), now));
    setPending(start);
    setWheel(mode);
  };

  return (
    <>
      <ChoiceCard
        index={0}
        icon="lightning-bolt"
        rows={3}
        title={t('quest.whenNow')}
        hint={t('quest.whenNowHint')}
        selected={draft.when === 'now'}
        onPress={() => {
          update({ when: 'now', pickupWindow: 'asap' });
          onDone();
        }}
      />
      <ChoiceCard
        index={1}
        icon="clock-time-four-outline"
        rows={3}
        title={t('request.today')}
        hint={isToday ? dates.pickupAt(draft.scheduledAt) : todayOpen ? t('quest.whenTodayHint') : t('quest.whenTodayClosed')}
        selected={isToday}
        onPress={() => (todayOpen ? open('today') : open('date'))}
      />
      <ChoiceCard
        index={2}
        icon="calendar-month-outline"
        rows={3}
        title={t('quest.whenLater')}
        hint={draft.when === 'scheduled' && !isToday ? dates.pickupAt(draft.scheduledAt) : t('request.whenScheduleHint')}
        selected={draft.when === 'scheduled' && !isToday}
        onPress={() => open('date')}
      />
      <Sheet visible={wheel !== null} onClose={() => setWheel(null)} title={wheel === 'today' ? t('quest.whenTodayTitle') : t('quest.whenLater')} drag="handle" overMap>
        {wheel && <TimeWheels mode={wheel} value={pending} onChange={setPending} />}
        <Button
          variant="accent"
          icon="checkmark"
          title={t('quest.pickupAt', { date: dates.pickupShort(pending) })}
          sound="pop"
          onPress={() => {
            update({ when: 'scheduled', scheduledAt: pending });
            setWheel(null);
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
    <>
      {[0, 1, 2, 3].map((count, index) => (
        <ChoiceCard
          key={count}
          index={index}
          rows={4}
          icon={count === 0 ? 'account-check-outline' : count === 1 ? 'account-hard-hat' : 'account-group-outline'}
          // Just the choice: what helpers cost is part of the price on the last page.
          title={t(`quest.helpers${count}`)}
          selected={draft.helpers === count}
          onPress={() => {
            update({ helpers: count });
            onDone();
          }}
        />
      ))}
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
  const { rtl } = useLanguage();
  const { draft, update } = useRequestDraft();
  return (
    <View style={{ gap: Spacing.sm }}>
      <Rise index={0}>
        {/* Empty, no example words: a hint types itself in it until the client writes. No length limit. */}
        <View>
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => update({ notes })}
            accessibilityLabel={t('quest.noteTypeHere')}
            multiline
            style={styles.note}
          />
          {!draft.notes && (
            // The hint starts where typing starts: on the right in Arabic, on the left in French and English.
            <View style={[styles.noteHint, { [physical(rtl ? 'right' : 'left')]: Spacing.lg }]} pointerEvents="none">
              <TypewriterHint text={t('quest.noteTypeHere')} />
            </View>
          )}
        </View>
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
/**
 * The client's own price: one big, bright amount between large − and + buttons, starting at
 * our suggestion (said so, quietly: it's an estimate), and under it the whole request at a
 * glance as small boxes, so nothing is a surprise before sending.
 */
export function PriceQuestion() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const names = useLocationLabel();
  const { draft, update } = useRequestDraft();
  const kinds = draft.freightTypes.map((id) => FREIGHT_TYPES.find((type) => type.id === id)).filter((type) => !!type);
  const when = draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t('quest.whenNow');
  // Bigger steps for bigger amounts, so a 3 800 DH trip doesn't need 40 taps.
  const step = draft.price < 1000 ? 10 : draft.price < 5000 ? 50 : 100;

  return (
    <View style={{ gap: Spacing.sm }}>
      <Rise index={1}>
        <Stepper
          bright
          value={draft.price}
          step={step}
          min={PRICE_STEP}
          max={200_000}
          onChange={(value) => update({ price: value, priceChosen: true })}
          format={(value) => formatMoney(t, value)}
          editable
          unit={currencyUnit(t)}
        />
      </Rise>
      <Rise index={2}>
        <Text variant="caption" muted center style={styles.priceNote}>
          {draft.priceChosen ? t('quest.priceYours') : t('quest.priceSuggested')}
        </Text>
      </Rise>
      <Rise index={3}>
        <View style={styles.facts}>
          {kinds.map((kind) => (
            <Fact key={kind.id} icon={kind.icon} label={t(`freight.${kind.id}`)} />
          ))}
          <Fact icon="weight-kilogram" label={draft.weightKnown ? `≈ ${formatWeight(t, draft.tons)}` : t('quest.weightUnknown')} />
          <Fact icon={vehicleIcon(draft.vehicle)} label={t(`vehicle.${draft.vehicle}`)} />
          <Fact icon="calendar-clock" label={when} />
          <Fact icon={draft.helpers ? 'account-hard-hat' : 'account-check-outline'} label={t(`quest.helpers${draft.helpers}`)} />
          <Fact icon="flag-checkered" label={names.short(draft.to)} />
          <Fact icon="cash" label={t('request.payCash')} />
        </View>
      </Rise>
    </View>
  );
}

function Fact({ icon, label }: { icon: IconName; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: colors.surfaceMuted }]}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.primary} />
      <Text variant="caption" style={styles.factText}>
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
  note: { minHeight: 96, maxHeight: 150, textAlignVertical: 'top' },
  noteHint: { position: 'absolute', top: Spacing.md + 2 },
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
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  priceNote: { fontSize: 13, lineHeight: 18 },
  factText: { flexShrink: 1, fontSize: 14, lineHeight: 19 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, flexShrink: 1 },
});
