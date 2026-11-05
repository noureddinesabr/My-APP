import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MONTHS, useT, type Lang } from './i18n';
import { BOOKABLE_DAYS, FIRST_SLOT_HOUR, fromLocalString, LAST_SLOT_HOUR, MIN_NOTICE_MINUTES, toLocalString } from './lib/schedule';
import { play } from './sounds';
import { T, tap, useColors } from './ui';

const ITEM = 42;
const VISIBLE = 5;
const SNAP = { damping: 22, stiffness: 220, mass: 0.6 };

type WheelItem = { key: string; label: string; disabled?: boolean };

/** The click and a tick of vibration for every row that passes the middle. */
function tick() {
  play('tick');
  Haptics.selectionAsync().catch(() => {});
}

/**
 * A scrolling drum, like the clock and calendar wheels of modern phones (from the original
 * Xapp app): drag or flick it, it settles on the nearest row with a click for every row
 * that passes the middle. Tapping a row also picks it. Disabled rows are greyed and skipped.
 */
function WheelPicker({ items, index, onChange, width = 80, label }: { items: WheelItem[]; index: number; onChange: (index: number) => void; width?: number; label: string }) {
  const c = useColors();
  const offset = useSharedValue(-index * ITEM);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const last = items.length - 1;
  const usable = items.map((item) => !item.disabled);

  useEffect(() => {
    if (!dragging.get()) offset.set(withSpring(-index * ITEM, SNAP));
  }, [index, offset, dragging]);

  const settle = (raw: number) => {
    'worklet';
    let target = Math.max(0, Math.min(last, raw));
    if (!usable[target]) {
      for (let step = 1; step <= last; step++) {
        if (target + step <= last && usable[target + step]) {
          target += step;
          break;
        }
        if (target - step >= 0 && usable[target - step]) {
          target -= step;
          break;
        }
      }
    }
    return target;
  };

  const pan = usePanGesture({
    activeOffsetY: [-4, 4],
    onActivate: () => {
      'worklet';
      dragging.set(true);
      start.set(offset.get());
    },
    onUpdate: (event) => {
      'worklet';
      const next = start.get() + event.translationY;
      const min = -last * ITEM;
      offset.set(next > 0 ? next * 0.35 : next < min ? min + (next - min) * 0.35 : next);
    },
    onDeactivate: (event) => {
      'worklet';
      dragging.set(false);
      const projected = offset.get() + event.velocityY * 0.18;
      const target = settle(Math.round(-projected / ITEM));
      offset.set(withSpring(-target * ITEM, { ...SNAP, velocity: event.velocityY }));
      scheduleOnRN(onChange, target);
    },
  });

  useAnimatedReaction(
    () => Math.round(-offset.get() / ITEM),
    (now, before) => {
      if (before !== null && now !== before && now >= 0 && now <= last) scheduleOnRN(tick);
    },
  );

  const list = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() + ITEM * ((VISIBLE - 1) / 2) }] }));

  return (
    <GestureDetector gesture={pan}>
      <View accessibilityRole="adjustable" accessibilityLabel={`${label}: ${items[index]?.label ?? ''}`} style={{ height: ITEM * VISIBLE, overflow: 'hidden', width }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 2, right: 2, top: ITEM * ((VISIBLE - 1) / 2), height: ITEM, borderRadius: 12, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.raised }}
        />
        <Animated.View style={list}>
          {items.map((item, i) => (
            <Row
              key={item.key}
              item={item}
              i={i}
              offset={offset}
              onPress={() => {
                if (item.disabled) return;
                offset.set(withSpring(-i * ITEM, SNAP));
                onChange(i);
              }}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** One row: full size in the middle, smaller, fainter and tilted away towards the edges (a drum). */
function Row({ item, i, offset, onPress }: { item: WheelItem; i: number; offset: SharedValue<number>; onPress: () => void }) {
  const c = useColors();
  const style = useAnimatedStyle(() => {
    const distance = i + offset.get() / ITEM;
    return {
      opacity: interpolate(Math.abs(distance), [0, 1, 2, 3], [1, 0.62, 0.3, 0.1], 'clamp'),
      transform: [
        { perspective: 300 },
        { rotateX: `${interpolate(distance, [-3, 0, 3], [-62, 0, 62], 'clamp')}deg` },
        { scale: interpolate(Math.abs(distance), [0, 2], [1.12, 0.84], 'clamp') },
      ],
    };
  });
  return (
    <Animated.View style={[{ height: ITEM, justifyContent: 'center' }, style]}>
      <Pressable onPress={onPress} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <T size={21} weight="bold" color={item.disabled ? c.muted : c.fg} numberOfLines={1} style={{ writingDirection: 'ltr' }}>
          {item.label}
        </T>
      </Pressable>
    </Animated.View>
  );
}

// ---------- the clock and calendar wheels ----------

const MINUTE_STEP = 5;
const HOURS = Array.from({ length: LAST_SLOT_HOUR - FIRST_SLOT_HOUR + 1 }, (_, i) => FIRST_SLOT_HOUR + i);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const pad = (n: number) => String(n).padStart(2, '0');

function earliestTime(now: Date) {
  const t = new Date(now.getTime() + MIN_NOTICE_MINUTES * 60_000);
  t.setMinutes(Math.ceil(t.getMinutes() / MINUTE_STEP) * MINUTE_STEP, 0, 0);
  return t;
}
const lastDay = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + BOOKABLE_DAYS - 1, 23, 59);

function bookable(date: Date, now = new Date()) {
  return date >= earliestTime(now) && date <= lastDay(now) && date.getHours() >= FIRST_SLOT_HOUR && date.getHours() <= LAST_SLOT_HOUR;
}

/** Is there still a time left today? */
export function timeLeftToday(now = new Date()) {
  const first = earliestTime(now);
  return first.getDate() === now.getDate() && first.getHours() <= LAST_SLOT_HOUR;
}

/** The nearest bookable time, so a wheel never lands on an impossible time. */
export function nearestBookable(date: Date, now = new Date()) {
  if (bookable(date, now)) return date;
  const first = earliestTime(now);
  if (date < first) return first.getHours() < FIRST_SLOT_HOUR ? new Date(first.getFullYear(), first.getMonth(), first.getDate(), FIRST_SLOT_HOUR, 0) : first;
  if (date.getHours() < FIRST_SLOT_HOUR) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), FIRST_SLOT_HOUR, 0);
  if (date.getHours() > LAST_SLOT_HOUR) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), LAST_SLOT_HOUR, 0);
  const end = lastDay(now);
  return end < date ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 9, 0) : first;
}

function TimeWheels({ mode, value, onChange, lang }: { mode: 'today' | 'date'; value: string; onChange: (v: string) => void; lang: Lang }) {
  const c = useColors();
  const { t, rtl } = useT();
  const now = new Date();
  const chosen = fromLocalString(value);
  const first = earliestTime(now);
  const end = lastDay(now);
  const set = (date: Date) => onChange(toLocalString(nearestBookable(date, now)));
  const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min);

  const months: { year: number; month: number }[] = [];
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ year: d.getFullYear(), month: d.getMonth() });
  const monthIndex = Math.max(0, months.findIndex((m) => m.year === chosen.getFullYear() && m.month === chosen.getMonth()));
  const { year, month } = months[monthIndex];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOpen = (day: number) => at(year, month, day, 23, 59) >= first && at(year, month, day, 0, 0) <= end;

  const dayItems = Array.from({ length: daysInMonth }, (_, i) => ({ key: String(i + 1), label: String(i + 1), disabled: !dayOpen(i + 1) }));
  const monthItems = months.map((m) => ({ key: `${m.year}-${m.month}`, label: MONTHS[lang][m.month] }));
  const hourItems = HOURS.map((h) => ({ key: String(h), label: pad(h), disabled: !MINUTES.some((min) => bookable(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), h, min), now)) }));
  const minuteItems = MINUTES.map((min) => ({ key: String(min), label: pad(min), disabled: !bookable(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), chosen.getHours(), min), now) }));
  const hourIndex = Math.max(0, HOURS.indexOf(chosen.getHours()));
  const minuteIndex = Math.max(0, MINUTES.indexOf(Math.round(chosen.getMinutes() / MINUTE_STEP) * MINUTE_STEP));

  const day = (
    <Column key="day" label={t('wheelDay')}>
      <WheelPicker label={t('wheelDay')} width={60} items={dayItems} index={chosen.getDate() - 1} onChange={(i) => set(at(year, month, i + 1, chosen.getHours(), chosen.getMinutes()))} />
    </Column>
  );
  const mon = (
    <Column key="month" label={t('wheelMonth')}>
      <WheelPicker
        label={t('wheelMonth')}
        width={lang === 'ar' ? 84 : 72}
        items={monthItems}
        index={monthIndex}
        onChange={(i) => {
          const next = months[i];
          const d = Math.min(chosen.getDate(), new Date(next.year, next.month + 1, 0).getDate());
          set(at(next.year, next.month, d, chosen.getHours(), chosen.getMinutes()));
        }}
      />
    </Column>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, direction: rtl ? 'rtl' : 'ltr' }}>
      {mode === 'date' ? (
        <>
          {/* Arabic reads month, day, hour, minute from the right. */}
          {rtl ? [mon, day] : [day, mon]}
          <View style={{ width: 1.5, height: 120, marginHorizontal: 4, marginTop: 18, backgroundColor: c.line }} />
        </>
      ) : null}
      <Column label={t('wheelHour')}>
        <WheelPicker label={t('wheelHour')} width={mode === 'today' ? 92 : 60} items={hourItems} index={hourIndex} onChange={(i) => set(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), HOURS[i], chosen.getMinutes()))} />
      </Column>
      <T size={26} weight="heavy" color={c.accent} style={{ marginTop: 18 }}>
        :
      </T>
      <Column label={t('wheelMinute')}>
        <WheelPicker label={t('wheelMinute')} width={mode === 'today' ? 92 : 60} items={minuteItems} index={minuteIndex} onChange={(i) => set(at(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), chosen.getHours(), MINUTES[i]))} />
      </Column>
    </View>
  );
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <T size={12} muted style={{ textAlign: 'center' }}>
        {label}
      </T>
      {children}
    </View>
  );
}

// ---------- the "When?" choice: now, today at a time, or another day ----------

/** `value` is 'now' or a local time "YYYY-MM-DDTHH:mm". */
export function WhenPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const now = new Date();
  const todayOpen = timeLeftToday(now);
  const chosen = value === 'now' ? null : fromLocalString(value);
  const isToday = !!chosen && chosen.toDateString() === now.toDateString();
  const mode: 'now' | 'today' | 'date' = !chosen ? 'now' : isToday ? 'today' : 'date';
  const defaultFor = (m: 'today' | 'date') => {
    if (m === 'today') return toLocalString(nearestBookable(new Date(now.getTime() + 2 * 3600_000), now));
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
    return toLocalString(nearestBookable(tomorrow, now));
  };
  const option = (m: 'now' | 'today' | 'date', icon: keyof typeof Ionicons.glyphMap, title: string, sub: string, disabled?: boolean) => {
    const on = mode === m;
    return (
      <Pressable
        key={m}
        accessibilityRole="radio"
        accessibilityState={{ selected: on, disabled }}
        disabled={disabled}
        onPress={() => {
          tap();
          onChange(m === 'now' ? 'now' : defaultFor(m));
        }}
        style={{ flex: 1, minWidth: 96, borderRadius: 18, padding: 12, gap: 4, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.surface : c.raised, opacity: disabled ? 0.45 : 1 }}>
        <Ionicons name={icon} size={22} color={on ? c.accent : c.fg} />
        <T weight="heavy">{title}</T>
        <T size={12} muted>
          {sub}
        </T>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {option('now', 'flash-outline', t('whenNow'), t('whenNowSub'))}
        {option('today', 'today-outline', t('whenToday'), t('whenTodaySub'), !todayOpen)}
        {option('date', 'calendar-outline', t('whenOther'), t('whenOtherSub'))}
      </View>
      {mode !== 'now' && chosen ? <TimeWheels mode={mode} value={value} onChange={onChange} lang={lang} /> : null}
    </View>
  );
}

/** "Now", "Today 15:30", "Tomorrow 09:00" or "Sat 8 Nov 09:00" in the chosen language. */
export function formatWhen(value: string, lang: Lang, t: ReturnType<typeof useT>['t']) {
  if (!value || value === 'now') return t('fmtNow');
  const d = fromLocalString(value);
  if (Number.isNaN(d.getTime())) return value;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return t('fmtToday', { time });
  if (d.toDateString() === tomorrow.toDateString()) return t('fmtTomorrow', { time });
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${time}`;
}

