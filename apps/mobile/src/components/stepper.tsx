import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Pop, Shimmer } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { holdStep, HOLD_DELAY_MS, HOLD_INTERVAL_MS } from '@/lib/hold-repeat';
import { haptic } from '@/lib/haptics';
import { play } from '@/lib/sounds';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

/**
 * − value + control. Holding − or + keeps changing the value, faster the longer it is held.
 * With `editable`, tapping the value lets the user type an exact number.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  format = String,
  editable = false,
  unit,
  bright,
}: {
  /** The big, flashy version (the price): a glowing green value between large coloured − and + buttons. */
  bright?: boolean;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  editable?: boolean;
  /** Shown next to the number while typing, e.g. "DH". */
  unit?: string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [typing, setTyping] = useState<string | null>(null);
  const current = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  useEffect(() => {
    current.current = value;
  }, [value]);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const start = (direction: 1 | -1) => {
    stop();
    play('tap');
    const apply = (repeats: number) => {
      const next = clamp(current.current + direction * holdStep(step, repeats));
      if (next === current.current) {
        // Reached the minimum or maximum: a firm tick.
        haptic('rigid');
        return stop();
      }
      if (repeats > 0) haptic('selection');
      current.current = next;
      onChange(next);
      timer.current = setTimeout(() => apply(repeats + 1), repeats === 0 ? HOLD_DELAY_MS : HOLD_INTERVAL_MS);
    };
    apply(0);
  };

  const commit = () => {
    if (typing === null) return;
    const parsed = Number(typing.replace(/[^\d]/g, ''));
    if (typing.trim() && Number.isFinite(parsed)) onChange(clamp(Math.round(parsed)));
    setTyping(null);
  };

  const button = (icon: 'remove' | 'add', direction: 1 | -1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? '+' : '-'}
      accessibilityHint={t('common.holdToRepeat')}
      disabled={!enabled}
      onPressIn={() => start(direction)}
      onPressOut={stop}
      style={({ pressed }) => [
        styles.button,
        bright && styles.brightButton,
        {
          backgroundColor: bright ? (icon === 'add' ? colors.successFill : colors.accentFill) : pressed ? colors.primaryFill : colors.primarySoft,
          opacity: enabled ? 1 : 0.4,
          transform: [{ scale: pressed ? 0.88 : 1 }],
        },
        bright && softShadow(icon === 'add' ? colors.successFill : colors.accentFill, 1),
      ]}>
      {({ pressed }) => <Ionicons name={icon} size={bright ? 30 : 22} color={bright || pressed ? colors.onPrimary : colors.primary} />}
    </Pressable>
  );

  return (
    // The bright version reads like a number line in every language: − on the left, + on the right.
    <View style={[styles.row, bright && { direction: 'ltr' }]}>
      {button('remove', -1, value > min)}
      {typing !== null ? (
        <View style={styles.editRow}>
          <TextInput
            autoFocus
            selectTextOnFocus
            value={typing}
            onChangeText={(text) => setTyping(text.replace(/[^\d]/g, '').slice(0, 7))}
            onSubmitEditing={commit}
            onBlur={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel={t('common.typeAmount')}
            style={[styles.input, { borderColor: colors.primary }]}
          />
          {unit && <Text variant="subtitle">{unit}</Text>}
        </View>
      ) : (
        <Pressable
          accessibilityRole={editable ? 'button' : 'text'}
          accessibilityHint={editable ? t('common.tapToType') : undefined}
          disabled={!editable}
          onPress={() => setTyping(String(value))}
          style={[styles.value, bright && [styles.brightValue, { backgroundColor: colors.successFill, borderColor: colors.success }, softShadow(colors.successFill, 1.6)]]}>
          {bright && <Shimmer every={1800} color="rgba(255,255,255,0.35)" />}
          <Pop trigger={value}>
            <Text variant="hero" center color={bright ? colors.onPrimary : undefined} style={[{ minWidth: 120 }, bright && styles.brightText]}>
              {format(value)}
            </Text>
          </Pop>
          {editable && (
            <View style={styles.hint}>
              <Ionicons name="pencil" size={11} color={bright ? colors.onPrimary : colors.textMuted} />
              <Text variant="caption" muted={!bright} color={bright ? colors.onPrimary : undefined} style={{ fontSize: 13, lineHeight: 18, opacity: bright ? 0.9 : 1 }}>
                {t('common.tapToType')}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      {button('add', 1, value < max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  button: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  brightButton: { width: 60, height: 60, borderRadius: 30 },
  brightValue: { borderRadius: Radius.xl, borderWidth: 2, paddingVertical: Spacing.sm, overflow: 'hidden' },
  brightText: { fontSize: 34, lineHeight: 46 },
  value: { flex: 1, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, direction: 'ltr' },
  input: { flex: 1, maxWidth: 140, fontSize: 24, textAlign: 'center', borderWidth: 2, writingDirection: 'ltr' },
});
