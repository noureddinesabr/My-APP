import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDateFormat } from '@/components/date-format';
import { Text } from '@/components/text';
import { WheelPicker, type WheelItem } from '@/components/wheel-picker';
import { BOOKABLE_DAYS, FIRST_SLOT_HOUR, fromLocalString, LAST_SLOT_HOUR, MIN_NOTICE_MINUTES, toLocalString } from '@/lib/schedule';
import { Fonts, Spacing, useColors } from '@/theme';

const MINUTE_STEP = 5;
const HOURS = Array.from({ length: LAST_SLOT_HOUR - FIRST_SLOT_HOUR + 1 }, (_, i) => FIRST_SLOT_HOUR + i);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const pad = (n: number) => String(n).padStart(2, '0');

/** The first time that can still be booked (drivers need notice), rounded up to the wheel's minutes. */
function earliestTime(now: Date) {
  const t = new Date(now.getTime() + MIN_NOTICE_MINUTES * 60_000);
  const rounded = Math.ceil(t.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  t.setMinutes(rounded, 0, 0);
  return t;
}

function lastDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + BOOKABLE_DAYS - 1, 23, 59);
}

/** Can this exact time be booked? */
export function bookable(date: Date, now = new Date()) {
  return date >= earliestTime(now) && date <= lastDay(now) && date.getHours() >= FIRST_SLOT_HOUR && date.getHours() <= LAST_SLOT_HOUR;
}

/** Is there still a time left today? */
export function timeLeftToday(now = new Date()) {
  const first = earliestTime(now);
  return first.getDate() === now.getDate() && first.getHours() <= LAST_SLOT_HOUR;
}

/** The nearest bookable time to `date` (same day when possible), so a wheel never lands on an impossible time. */
export function nearestBookable(date: Date, now = new Date()) {
  if (bookable(date, now)) return date;
  const first = earliestTime(now);
  if (date < first) return first.getHours() < FIRST_SLOT_HOUR ? new Date(first.getFullYear(), first.getMonth(), first.getDate(), FIRST_SLOT_HOUR, 0) : first;
  if (date.getHours() < FIRST_SLOT_HOUR) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), FIRST_SLOT_HOUR, 0);
  if (date.getHours() > LAST_SLOT_HOUR) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), LAST_SLOT_HOUR, 0);
  return lastDay(now) < date ? new Date(lastDay(now).getFullYear(), lastDay(now).getMonth(), lastDay(now).getDate(), 9, 0) : first;
}

/**
 * Clock and calendar wheels. `today`: hour and minute only. `date`: day and month (the year
 * follows by itself), then hour and minute. Times that can't be booked (too soon, too late,
 * more than two weeks ahead) are greyed out and the wheels skip them.
 */
export function TimeWheels({ mode, value, onChange }: { mode: 'today' | 'date'; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const now = new Date();
  const chosen = fromLocalString(value);
  const first = earliestTime(now);
  const end = lastDay(now);

  const set = (date: Date) => onChange(toLocalString(nearestBookable(date, now)));
  const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min);

  // Months the two weeks run through (one or two), with the year worked out from them.
  const months: { year: number; month: number }[] = [];
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  const monthIndex = Math.max(0, months.findIndex((m) => m.year === chosen.getFullYear() && m.month === chosen.getMonth()));
  const { year, month } = months[monthIndex];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOpen = (day: number) => {
    const start = at(year, month, day, 23, 59);
    return start >= first && at(year, month, day, 0, 0) <= end;
  };

  const dayItems: WheelItem[] = Array.from({ length: daysInMonth }, (_, i) => ({ key: String(i + 1), label: String(i + 1), disabled: !dayOpen(i + 1) }));
  const monthItems: WheelItem[] = months.map((m) => ({ key: `${m.year}-${m.month}`, label: dates.month(new Date(m.year, m.month, 1)) }));
  const hourItems: WheelItem[] = HOURS.map((h) => ({
    key: String(h),
    label: pad(h),
    disabled: !MINUTES.some((min) => bookable(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), h, min), now)),
  }));
  const minuteItems: WheelItem[] = MINUTES.map((min) => ({
    key: String(min),
    label: pad(min),
    disabled: !bookable(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), chosen.getHours(), min), now),
  }));
  const hourIndex = Math.max(0, HOURS.indexOf(chosen.getHours()));
  const minuteIndex = Math.max(0, MINUTES.indexOf(Math.round(chosen.getMinutes() / MINUTE_STEP) * MINUTE_STEP));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {mode === 'date' && (
          <>
            <Column label={t('wheel.day')}>
              <WheelPicker
                label={t('wheel.day')}
                width={64}
                items={dayItems}
                index={chosen.getDate() - 1}
                onChange={(i) => set(at(year, month, i + 1, chosen.getHours(), chosen.getMinutes()))}
              />
            </Column>
            <Column label={t('wheel.month')}>
              <WheelPicker
                label={t('wheel.month')}
                width={84}
                items={monthItems}
                index={monthIndex}
                onChange={(i) => {
                  const next = months[i];
                  const day = Math.min(chosen.getDate(), new Date(next.year, next.month + 1, 0).getDate());
                  set(at(next.year, next.month, day, chosen.getHours(), chosen.getMinutes()));
                }}
              />
            </Column>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>
        )}
        <Column label={t('wheel.hour')}>
          <WheelPicker
            label={t('wheel.hour')}
            width={mode === 'today' ? 96 : 64}
            items={hourItems}
            index={hourIndex}
            onChange={(i) => set(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), HOURS[i], chosen.getMinutes()))}
          />
        </Column>
        <Text style={styles.colon} color={colors.primary}>
          :
        </Text>
        <Column label={t('wheel.minute')}>
          <WheelPicker
            label={t('wheel.minute')}
            width={mode === 'today' ? 96 : 64}
            items={minuteItems}
            index={minuteIndex}
            onChange={(i) => set(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), chosen.getHours(), MINUTES[i]))}
          />
        </Column>
      </View>
    </View>
  );
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.column}>
      <Text variant="caption" muted center style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export { earliestTime };

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // Always left to right, like a clock and a written date.
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, direction: 'ltr' },
  column: { alignItems: 'center', gap: 2 },
  label: { fontSize: 12, lineHeight: 16 },
  colon: { fontFamily: Fonts.extrabold, fontSize: 26, lineHeight: 34, marginTop: 18 },
  divider: { width: 1.5, height: 120, marginHorizontal: Spacing.xs, marginTop: 18 },
});
