import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useDateFormat } from '@/components/date-format';
import { MediaField } from '@/components/media/media-field';
import { VoiceNoteField } from '@/components/media/voice-note-field';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ChoiceCard, Rise } from '@/components/motion/quest';
import { earliestTime, nearestBookable, timeLeftToday, TimeWheels } from '@/components/request/time-wheels';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/ui';
import { LOAD_SIZES, vehicleImage } from '@/constants/vehicles';
import { dayKey, fromLocalString, toLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

/**
 * How big is it? Five pictures, each with an everyday example and a rough weight (≈ 250 kg …
 * more than 3 t). The size picks the vehicle and the suggested price; one tap and it moves on.
 */
export function SizeQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  return (
    <>
      {LOAD_SIZES.map((size, index) => (
        <ChoiceCard
          key={size.id}
          index={index}
          rows={LOAD_SIZES.length}
          image={vehicleImage(size.vehicle)}
          title={t(`size.${size.id}`)}
          aside={t(`size.${size.id}Weight`)}
          hint={t(`size.${size.id}Hint`)}
          selected={draft.vehicleChosen && draft.vehicle === size.vehicle}
          onPress={() => {
            update({ vehicle: size.vehicle, vehicleChosen: true, tons: size.tons, weightKnown: true, freightType: 'other', freightTypes: ['other'] });
            onDone();
          }}
        />
      ))}
    </>
  );
}

/**
 * "Help and a message for the driver": all optional, in four coloured blocks — loading help
 * (add or remove helpers, each one pops in), riding along, photos / video of the load, then a
 * written message or a voice note.
 */
export function DetailsPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  const setHelpers = (count: number) => {
    const next = Math.max(0, Math.min(MAX_HELPERS, count));
    if (next === draft.helpers) return;
    play(next > draft.helpers ? 'pop' : 'tap');
    update({ helpers: next });
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <Rise index={1}>
        <Block tone={colors.location} icon="account-hard-hat" title={t('simple.helpersQ')}>
          <View style={styles.helpersRow}>
            <View style={styles.workers}>
              {draft.helpers === 0 ? (
                <Text variant="caption" muted style={{ flexShrink: 1 }}>
                  {t('simple.noHelpersHint')}
                </Text>
              ) : (
                Array.from({ length: draft.helpers }, (_, index) => (
                  <Animated.View key={index} entering={ZoomIn.springify().damping(10)} exiting={ZoomOut.duration(150)} style={[styles.worker, { backgroundColor: colors.location }]}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color={colors.background} />
                  </Animated.View>
                ))
              )}
            </View>
            {/* − on the left and + on the right in every language, like the price buttons. */}
            <View style={styles.stepper}>
              <RoundStep icon="minus" tone={colors.accent} disabled={draft.helpers === 0} onPress={() => setHelpers(draft.helpers - 1)} label={t('simple.lessHelpers')} />
              <Text variant="title" style={styles.helperCount}>
                {draft.helpers}
              </Text>
              <RoundStep icon="plus" tone={colors.success} disabled={draft.helpers === MAX_HELPERS} onPress={() => setHelpers(draft.helpers + 1)} label={t('simple.moreHelpers')} />
            </View>
          </View>
        </Block>
      </Rise>
      <Rise index={2}>
        <PressableScale
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.rideAlong }}
          feedback={null}
          scaleTo={0.97}
          onPress={() => {
            play('pop');
            update({ rideAlong: !draft.rideAlong });
          }}
          style={[styles.block, styles.toggle, { backgroundColor: `${colors.success}${draft.rideAlong ? '2E' : '14'}`, borderColor: `${colors.success}${draft.rideAlong ? 'CC' : '55'}` }]}>
          <View style={[styles.blockIcon, { backgroundColor: colors.success }]}>
            <MaterialCommunityIcons name="seat-passenger" size={18} color={colors.background} />
          </View>
          <Text variant="label" style={{ flex: 1 }}>
            {t('simple.rideAlong')}
          </Text>
          <MaterialCommunityIcons name={draft.rideAlong ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28} color={draft.rideAlong ? colors.success : colors.textMuted} />
        </PressableScale>
      </Rise>
      <Rise index={3}>
        <Block tone={colors.star} icon="camera" title={t('simple.photosTitle')}>
          <MediaField compact value={draft.media} onChange={(media) => update({ media })} />
        </Block>
      </Rise>
      <Rise index={4}>
        <Block tone={colors.primary} icon="message-text" title={t('simple.messageTitle')}>
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => update({ notes })}
            placeholder={t('simple.notePlaceholder')}
            accessibilityLabel={t('simple.messageTitle')}
            multiline
            style={styles.note}
          />
          <VoiceNoteField value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
        </Block>
      </Rise>
    </View>
  );
}

const MAX_HELPERS = 5;

/** A coloured block with its icon and title: one kind of extra per colour. */
function Block({ tone, icon, title, children }: { tone: string; icon: ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.block, { backgroundColor: `${tone}14`, borderColor: `${tone}55` }]}>
      <View style={styles.blockHead}>
        <View style={[styles.blockIcon, { backgroundColor: tone }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.background} />
        </View>
        <Text variant="label" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function RoundStep({ icon, tone, disabled, onPress, label }: { icon: 'plus' | 'minus'; tone: string; disabled: boolean; onPress: () => void; label: string }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      feedback={null}
      scaleTo={0.85}
      onPress={onPress}
      style={[styles.step, { backgroundColor: disabled ? colors.surfaceMuted : tone }]}>
      <MaterialCommunityIcons name={icon} size={22} color={disabled ? colors.textMuted : colors.onPrimary} />
    </PressableScale>
  );
}

/** The price, already filled in (like inDrive) and paid in cash. */
export function PricePage() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  // Bigger steps for bigger amounts, so a 3 800 DH trip doesn't need 40 taps.
  const step = draft.price < 1000 ? 10 : draft.price < 5000 ? 50 : 100;

  return (
    <View style={{ gap: Spacing.md }}>
      <Rise index={1}>
        <Stepper
          bright
          value={draft.price}
          step={step}
          min={10}
          max={200_000}
          onChange={(value) => update({ price: value, priceChosen: true })}
          format={(value) => formatMoney(t, value)}
          editable
          unit={currencyUnit(t)}
        />
      </Rise>
      <Rise index={2}>
        <View style={styles.cashLine}>
          <MaterialCommunityIcons name="cash" size={18} color={colors.success} />
          <Text variant="caption" color={colors.success} style={styles.cashText}>
            {draft.priceChosen ? t('simple.priceYours') : t('simple.priceSuggested')}
          </Text>
        </View>
      </Rise>
    </View>
  );
}

/**
 * When? Its own page, as before: Now, a time later today, or another day and time. The day
 * and time are picked on wheels in a sheet over the map; choosing moves on to the price.
 */
export function WhenQuestion({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [wheel, setWheel] = useState<'today' | 'date' | null>(null);
  const [pending, setPending] = useState(draft.scheduledAt);
  const [now] = useState(() => new Date());
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

const styles = StyleSheet.create({
  block: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.sm, gap: Spacing.sm },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  blockIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  helpersRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  workers: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, minHeight: 34 },
  worker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  helperCount: { minWidth: 28, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, direction: 'ltr' },
  step: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cashLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cashText: { flexShrink: 1, fontFamily: Fonts.semibold },
  note: { minHeight: 52, maxHeight: 96, textAlignVertical: 'top' },
});
