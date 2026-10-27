import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDateFormat } from '@/components/date-format';
import { Text } from '@/components/text';
import { Gradient } from '@/components/ui';
import { bookableDays, dayKey, fromLocalString, periodOf, slotsForDay, type DayPeriod } from '@/lib/schedule';
import type { PickupWindow, When } from '@/state/request-draft';
import { Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

const PERIODS: { id: DayPeriod; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'morning', icon: 'weather-sunny' },
  { id: 'afternoon', icon: 'weather-partly-cloudy' },
  { id: 'evening', icon: 'weather-night' },
];

/**
 * Quick windows ("as soon as possible" ≈ 10–20 min, "within 1 hour") or a scheduled slot
 * picked from a day strip and a time grid.
 */
export function WhenPicker({
  when,
  window,
  scheduledAt,
  onChange,
  scheduleOnly,
}: {
  when: When;
  window: PickupWindow;
  scheduledAt: string;
  onChange: (changes: { when?: When; pickupWindow?: PickupWindow; scheduledAt?: string }) => void;
  /** Only the day strip and time grid (the quick windows are asked elsewhere). */
  scheduleOnly?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => bookableDays(now), [now]);
  const selected = fromLocalString(scheduledAt);
  const slots = slotsForDay(selected, now);

  const pickDay = (day: Date) => {
    // Keep the same time on the new day when it's free, otherwise take the day's first free slot.
    const daySlots = slotsForDay(day, now);
    const sameTime = daySlots.find(
      (slot) => slot.available && slot.hour === selected.getHours() && slot.minute === selected.getMinutes(),
    );
    const first = daySlots.find((slot) => slot.available);
    if (sameTime || first) onChange({ scheduledAt: (sameTime ?? first)!.value });
  };

  return (
    <View style={{ gap: Spacing.md }}>
      {!scheduleOnly && (
        <View style={styles.modes}>
          <ModeCard
            active={when === 'now' && window === 'asap'}
            icon="flash"
            title={t('request.whenAsap')}
            hint={t('request.whenAsapWindow')}
            onPress={() => onChange({ when: 'now', pickupWindow: 'asap' })}
          />
          <ModeCard
            active={when === 'now' && window === '1h'}
            icon="time"
            title={t('request.whenHour')}
            hint={t('request.whenHourHint')}
            onPress={() => onChange({ when: 'now', pickupWindow: '1h' })}
          />
          <ModeCard
            active={when === 'scheduled'}
            icon="calendar"
            title={t('request.whenSchedule')}
            hint={t('request.whenScheduleHint')}
            onPress={() => onChange({ when: 'scheduled' })}
          />
        </View>
      )}

      {(scheduleOnly || when === 'scheduled') && (
        <>
          <Gradient colors={Gradients.primary} style={styles.summary}>
            <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.onPrimary} />
            <Text variant="subtitle" color={colors.onPrimary}>
              {dates.pickupAt(scheduledAt)}
            </Text>
          </Gradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((day) => {
              const isSelected = dayKey(day) === dayKey(selected);
              const hasSlots = slotsForDay(day, now).some((slot) => slot.available);
              const relative = dates.relativeDay(day, now);
              return (
                <Pressable
                  key={dayKey(day)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: !hasSlots }}
                  accessibilityLabel={`${dates.weekday(day)} ${day.getDate()} ${dates.month(day)}`}
                  disabled={!hasSlots}
                  onPress={() => pickDay(day)}
                  style={[
                    styles.day,
                    { backgroundColor: colors.surface, opacity: hasSlots ? 1 : 0.4 },
                    softShadow(colors.shadow, 0.4),
                  ]}>
                  {isSelected && <Gradient colors={Gradients.primary} style={StyleSheet.absoluteFill} />}
                  <Text variant="caption" center color={isSelected ? colors.onPrimary : colors.textMuted} numberOfLines={1}>
                    {relative ?? dates.weekday(day)}
                  </Text>
                  <Text variant="title" center color={isSelected ? colors.onPrimary : colors.text}>
                    {day.getDate()}
                  </Text>
                  <Text variant="caption" center color={isSelected ? colors.onPrimary : colors.textMuted}>
                    {dates.month(day)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {PERIODS.map((period) => {
            const periodSlots = slots.filter((slot) => periodOf(slot.hour) === period.id);
            if (!periodSlots.some((slot) => slot.available)) return null;
            return (
              <View key={period.id} style={{ gap: Spacing.sm }}>
                <View style={styles.periodLabel}>
                  <MaterialCommunityIcons name={period.icon} size={18} color={colors.accent} />
                  <Text variant="label">{t(`request.${period.id}`)}</Text>
                </View>
                <View style={styles.slots}>
                  {periodSlots.map((slot) => {
                    const isSelected = slot.value === scheduledAt;
                    return (
                      <Pressable
                        key={slot.value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected, disabled: !slot.available }}
                        disabled={!slot.available}
                        onPress={() => onChange({ scheduledAt: slot.value })}
                        style={[
                          styles.slot,
                          {
                            backgroundColor: isSelected ? colors.primaryFill : colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                            opacity: slot.available ? 1 : 0.35,
                          },
                        ]}>
                        <Text variant="label" center color={isSelected ? colors.onPrimary : colors.text}>
                          {dates.time(fromLocalString(slot.value))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function ModeCard({
  active,
  icon,
  title,
  hint,
  onPress,
}: {
  active: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.mode,
        { backgroundColor: active ? colors.primarySoft : colors.surface, borderColor: active ? colors.primary : colors.border },
      ]}>
      <View style={[styles.modeIcon, { backgroundColor: active ? colors.primaryFill : colors.surfaceMuted }]}>
        <Ionicons name={icon} size={20} color={active ? colors.onPrimary : colors.primary} />
      </View>
      <Text variant="label">{title}</Text>
      <Text variant="caption" muted>
        {hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: Spacing.sm },
  mode: { flex: 1, padding: Spacing.sm + 2, borderRadius: Radius.lg, borderWidth: 1.5, gap: Spacing.xs },
  modeIcon: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  days: { gap: Spacing.sm, paddingVertical: Spacing.xs, paddingHorizontal: 2 },
  day: {
    width: 68,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  periodLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slot: { width: '23%', paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1.5 },
});
