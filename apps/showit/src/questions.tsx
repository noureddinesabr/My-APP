import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useT } from './i18n';
import { T, tap, useColors } from './ui';

/**
 * Owner's report #8 (18 Nov 2026): the trip's questions are short, one row each, close together:
 * a small title line, then its answers as small pills on one line.
 */
export function QRow({ icon, mci, label, missing, children, onLayout }: { icon?: keyof typeof Ionicons.glyphMap; /** A MaterialCommunityIcons name, for icons Ionicons lacks. */ mci?: keyof typeof MaterialCommunityIcons.glyphMap; label: string; missing?: boolean; children: ReactNode; onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }} onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {mci ? <MaterialCommunityIcons name={mci} size={16} color={missing ? c.danger : c.live} /> : icon ? <Ionicons name={icon} size={15} color={missing ? c.danger : c.live} /> : null}
        <T size={13} weight="bold" color={missing ? c.danger : undefined} style={{ flex: 1 }}>
          {label}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** A small answer pill: a radio by default, a checkbox for answers that add up. */
export function Mini({ label, on, onPress, icon, check }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; check?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      hitSlop={3}
      accessibilityRole={check ? 'checkbox' : 'radio'}
      accessibilityState={check ? { checked: on } : { selected: on }}
      accessibilityLabel={label}
      // A finger scrolling the page must not pick an answer by passing over it.
      unstable_pressDelay={80}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.raised, opacity: pressed ? 0.85 : 1 })}>
      {on ? <Ionicons name="checkmark" size={14} color={c.onAccent} /> : icon ? <Ionicons name={icon} size={14} color={c.muted} /> : null}
      <T size={13} weight="bold" color={on ? c.onAccent : c.fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** − n + in one short line (in Arabic the + comes first, on the right). */
export function Counter({ value, onChange, min = 0, max = 4 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const c = useColors();
  const { t, lang } = useT();
  const round = (icon: 'remove' | 'add', label: string, next: number, disabled: boolean) => (
    <Pressable
      key={icon}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onChange(next);
      }}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: icon === 'add' ? c.accent : c.raised, borderWidth: icon === 'add' ? 0 : 1, borderColor: c.line, opacity: disabled ? 0.4 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={icon === 'add' ? c.onAccent : c.fg} />
    </Pressable>
  );
  const less = round('remove', t('helperLess'), Math.max(min, value - 1), value <= min);
  const more = round('add', t('helperMore'), Math.min(max, value + 1), value >= max);
  const n = (
    <T key="n" size={18} weight="heavy" style={{ minWidth: 24, textAlign: 'center' }}>
      {String(value)}
    </T>
  );
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{lang === 'ar' ? [more, n, less] : [less, n, more]}</View>;
}
