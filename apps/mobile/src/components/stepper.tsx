import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { holdStep, HOLD_DELAY_MS, HOLD_INTERVAL_MS } from '@/lib/hold-repeat';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

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
}: {
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
      if (next === current.current) return stop();
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
        {
          backgroundColor: pressed ? colors.primary : colors.primarySoft,
          opacity: enabled ? 1 : 0.4,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}>
      {({ pressed }) => <Ionicons name={icon} size={22} color={pressed ? colors.onPrimary : colors.primary} />}
    </Pressable>
  );

  return (
    <View style={styles.row}>
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
          style={styles.value}>
          <Text variant="title" center style={{ minWidth: 96 }}>
            {format(value)}
          </Text>
          {editable && (
            <View style={styles.hint}>
              <Ionicons name="pencil" size={11} color={colors.textMuted} />
              <Text variant="caption" muted style={{ fontSize: 11, lineHeight: 15 }}>
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
  value: { flex: 1, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, direction: 'ltr' },
  input: { flex: 1, maxWidth: 140, fontSize: 24, textAlign: 'center', borderWidth: 2, writingDirection: 'ltr' },
});
