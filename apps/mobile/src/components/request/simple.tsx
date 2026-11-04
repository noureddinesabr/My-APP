import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

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
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

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
 * Everything extra on one page, all optional: helpers (none by default), riding along, and a
 * message for the driver as text, a voice note, photos or a video.
 */
export function DetailsPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  return (
    <View style={{ gap: Spacing.sm }}>
      <Rise index={1}>
        <View style={styles.helpers}>
          <MaterialCommunityIcons name="account-hard-hat" size={22} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {t('simple.helpersQ')}
          </Text>
        </View>
        <View style={styles.counts}>
          {[0, 1, 2, 3].map((count) => {
            const on = draft.helpers === count;
            return (
              <PressableScale
                key={count}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                feedback={null}
                scaleTo={0.92}
                onPress={() => {
                  play('pop');
                  update({ helpers: count });
                }}
                style={[styles.count, { backgroundColor: on ? colors.primaryFill : colors.surface, borderColor: on ? colors.primaryFill : colors.border }]}>
                <Text variant="label" color={on ? colors.onPrimary : colors.text}>
                  {count === 0 ? t('simple.none') : count}
                </Text>
              </PressableScale>
            );
          })}
        </View>
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
          style={[styles.toggle, { backgroundColor: draft.rideAlong ? colors.primarySoft : colors.surface, borderColor: draft.rideAlong ? colors.primary : colors.border }]}>
          <MaterialCommunityIcons name="seat-passenger" size={22} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {t('simple.rideAlong')}
          </Text>
          <MaterialCommunityIcons name={draft.rideAlong ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={draft.rideAlong ? colors.primary : colors.textMuted} />
        </PressableScale>
      </Rise>
      <Rise index={3}>
        <TextInput value={draft.notes} onChangeText={(notes) => update({ notes })} placeholder={t('simple.notePlaceholder')} multiline style={styles.note} />
      </Rise>
      <Rise index={4}>
        <VoiceNoteField value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
      </Rise>
      <Rise index={5}>
        <MediaField compact value={draft.media} onChange={(media) => update({ media })} />
      </Rise>
    </View>
  );
}

/** The price (already filled in, like inDrive), paid in cash, and when — Now unless changed. */
export function PricePage() {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [whenOpen, setWhenOpen] = useState(false);
  // Bigger steps for bigger amounts, so a 3 800 DH trip doesn't need 40 taps.
  const step = draft.price < 1000 ? 10 : draft.price < 5000 ? 50 : 100;
  const scheduled = draft.when === 'scheduled';

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
      <Rise index={3}>
        <PressableScale
          accessibilityRole="button"
          scaleTo={0.97}
          onPress={() => setWhenOpen(true)}
          style={[styles.when, { backgroundColor: scheduled ? colors.primarySoft : colors.surface, borderColor: scheduled ? colors.primary : colors.border }, !scheduled && rim(colors)]}>
          <View style={[styles.whenIcon, { backgroundColor: colors.primaryFill }]}>
            <MaterialCommunityIcons name={scheduled ? 'calendar-clock' : 'lightning-bolt'} size={20} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{scheduled ? dates.pickupAt(draft.scheduledAt) : t('simple.now')}</Text>
            {!scheduled && (
              <Text variant="caption" muted>
                {t('quest.whenNowHint')}
              </Text>
            )}
          </View>
          <Text variant="caption" color={colors.primary} style={styles.change}>
            {t('quest.change')}
          </Text>
        </PressableScale>
      </Rise>
      <WhenSheet visible={whenOpen} onClose={() => setWhenOpen(false)} />
    </View>
  );
}

/** Now (default), later today, or another day: the time wheels only when needed. */
function WhenSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [wheel, setWheel] = useState<'today' | 'date' | null>(null);
  const [pending, setPending] = useState(draft.scheduledAt);
  const [now] = useState(() => new Date());
  const isToday = draft.when === 'scheduled' && dayKey(fromLocalString(draft.scheduledAt)) === dayKey(now);
  const todayOpen = timeLeftToday(now);
  const close = () => {
    setWheel(null);
    onClose();
  };
  const open = (mode: 'today' | 'date') => {
    setPending(
      mode === 'today'
        ? isToday
          ? draft.scheduledAt
          : toLocalString(nearestBookable(earliestTime(now), now))
        : draft.when === 'scheduled' && !isToday
          ? draft.scheduledAt
          : toLocalString(nearestBookable(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0), now)),
    );
    setWheel(mode);
  };

  return (
    <Sheet visible={visible} onClose={close} title={wheel === 'today' ? t('quest.whenTodayTitle') : wheel ? t('quest.whenLater') : t('simple.whenTitle')} drag="handle" overMap>
      {wheel ? (
        <>
          <TimeWheels mode={wheel} value={pending} onChange={setPending} />
          <Button
            variant="accent"
            icon="checkmark"
            title={t('quest.pickupAt', { date: dates.pickupShort(pending) })}
            sound="pop"
            onPress={() => {
              update({ when: 'scheduled', scheduledAt: pending });
              close();
            }}
          />
        </>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          <ChoiceCard
            index={0}
            icon="lightning-bolt"
            title={t('quest.whenNow')}
            hint={t('quest.whenNowHint')}
            selected={draft.when === 'now'}
            onPress={() => {
              update({ when: 'now', pickupWindow: 'asap' });
              close();
            }}
          />
          <ChoiceCard
            index={1}
            icon="clock-time-four-outline"
            title={t('request.today')}
            hint={isToday ? dates.pickupAt(draft.scheduledAt) : todayOpen ? t('quest.whenTodayHint') : t('quest.whenTodayClosed')}
            selected={isToday}
            onPress={() => open(todayOpen ? 'today' : 'date')}
          />
          <ChoiceCard
            index={2}
            icon="calendar-month-outline"
            title={t('quest.whenLater')}
            hint={draft.when === 'scheduled' && !isToday ? dates.pickupAt(draft.scheduledAt) : t('request.whenScheduleHint')}
            selected={draft.when === 'scheduled' && !isToday}
            onPress={() => open('date')}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cashLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cashText: { flexShrink: 1, fontFamily: Fonts.semibold },
  helpers: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  counts: { flexDirection: 'row', gap: Spacing.sm },
  count: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: Radius.pill, borderWidth: 1.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 52, borderRadius: Radius.lg, borderWidth: 1.5 },
  note: { minHeight: 52, maxHeight: 96, textAlignVertical: 'top' },
  when: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  whenIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  change: { fontFamily: Fonts.bold },
});
