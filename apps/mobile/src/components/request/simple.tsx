import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
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
import { maxTons } from '@/lib/pricing';
import { dayKey, fromLocalString, toLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { useRequestDraft } from '@/state/request-draft';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The one real question: how big is it? Four pictures with everyday examples. The size picks
 * the truck (and the suggested price); no kinds of goods, no weights, no list of nine trucks.
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
          hint={t(`size.${size.id}Hint`)}
          selected={draft.vehicleChosen && draft.vehicle === size.vehicle}
          onPress={() => {
            // A size, not a weight: drivers judge the rest from the size and any photo.
            update({ vehicle: size.vehicle, vehicleChosen: true, tons: maxTons(size.vehicle), weightKnown: false, freightType: 'other', freightTypes: ['other'] });
            onDone();
          }}
        />
      ))}
    </>
  );
}

/**
 * Last page: the price (already filled in, like inDrive), and three optional switches with
 * smart defaults: Now, no helpers, nothing to add. Then "Find a driver".
 */
export function SendPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [sheet, setSheet] = useState<'when' | 'extras' | null>(null);
  // Bigger steps for bigger amounts, so a 3 800 DH trip doesn't need 40 taps.
  const step = draft.price < 1000 ? 10 : draft.price < 5000 ? 50 : 100;
  const extras = draft.media.length + (draft.voiceNote ? 1 : 0) + (draft.notes.trim() ? 1 : 0);

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
        <View style={styles.options}>
          <Option
            icon={draft.when === 'now' ? 'lightning-bolt' : 'calendar-clock'}
            label={draft.when === 'now' ? t('simple.now') : dates.pickupShort(draft.scheduledAt)}
            active={draft.when === 'scheduled'}
            onPress={() => setSheet('when')}
          />
          <Option
            icon={draft.helpers ? 'account-hard-hat' : 'account-hard-hat-outline'}
            label={draft.helpers ? t('simple.helpers', { count: draft.helpers }) : t('simple.noHelpers')}
            active={draft.helpers > 0}
            onPress={() => {
              play('pop');
              update({ helpers: (draft.helpers + 1) % 4 });
            }}
          />
          <Option
            icon={extras ? 'paperclip-check' : 'camera-plus-outline'}
            label={extras ? t('simple.extrasAdded', { count: extras }) : t('simple.extras')}
            active={extras > 0}
            onPress={() => setSheet('extras')}
          />
        </View>
      </Rise>
      <WhenSheet visible={sheet === 'when'} onClose={() => setSheet(null)} />
      <ExtrasSheet visible={sheet === 'extras'} onClose={() => setSheet(null)} />
    </View>
  );
}

/** A switch with a sensible default: tap to change it. Lit up once it's not the default. */
function Option({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.94}
      onPress={onPress}
      style={[styles.option, { backgroundColor: active ? colors.primarySoft : colors.surface, borderColor: active ? colors.primary : colors.border }, !active && rim(colors)]}>
      <View style={[styles.optionIcon, { backgroundColor: active ? colors.primaryFill : colors.surfaceMuted }]}>
        <MaterialCommunityIcons name={icon} size={22} color={active ? colors.onPrimary : colors.primary} />
      </View>
      <Text variant="caption" center style={styles.optionLabel}>
        {label}
      </Text>
    </PressableScale>
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

/** Everything optional in one place: a photo, a voice note, a few words for the driver. */
function ExtrasSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('simple.extrasTitle')} drag="handle" overMap>
      <View style={{ gap: Spacing.sm }}>
        <MediaField compact value={draft.media} onChange={(media) => update({ media })} />
        <VoiceNoteField value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
        <TextInput
          value={draft.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder={t('simple.notePlaceholder')}
          multiline
          style={styles.note}
        />
        <Button variant="accent" icon="checkmark" title={t('simple.done')} sound="pop" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cashLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cashText: { flexShrink: 1, fontFamily: Fonts.semibold },
  options: { flexDirection: 'row', gap: Spacing.sm },
  option: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: 4, borderRadius: Radius.lg, borderWidth: 1.5 },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, lineHeight: 19, fontFamily: Fonts.semibold },
  note: { minHeight: 52, maxHeight: 96, textAlignVertical: 'top' },
});
