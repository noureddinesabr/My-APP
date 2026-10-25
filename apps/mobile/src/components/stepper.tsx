import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/theme';

/** − value + control. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  format = String,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (value: number) => string;
}) {
  const colors = useColors();
  const button = (icon: 'remove' | 'add', next: number, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? '+' : '-'}
      disabled={!enabled}
      onPress={() => onChange(next)}
      style={[styles.button, { backgroundColor: colors.primarySoft, opacity: enabled ? 1 : 0.4 }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {button('remove', Math.max(min, value - step), value > min)}
      <Text variant="title" center style={{ minWidth: 96 }}>
        {format(value)}
      </Text>
      {button('add', Math.min(max, value + step), value < max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  button: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
