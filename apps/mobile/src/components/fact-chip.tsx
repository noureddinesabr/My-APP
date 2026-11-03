import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** One colour family per kind of detail, so a summary reads at a glance (what, how heavy, when…). */
export type FactTone = 'violet' | 'blue' | 'green' | 'gold' | 'red';

/** The tone's colour token: text-safe on the page in both light and dark themes. */
export function useToneColor(tone: FactTone) {
  const colors = useColors();
  return { violet: colors.primary, blue: colors.location, green: colors.success, gold: colors.star, red: colors.accent }[tone];
}

/**
 * A detail as a coloured chip: the icon in a filled circle of its tone, the words, then an
 * optional number shown big and bold in that tone (helpers 2, floor 3) and a quieter note after
 * it (stairs only). Wraps instead of cutting.
 */
export function FactChip({
  icon,
  tone,
  label,
  value,
  after,
  big,
}: {
  icon: IconName;
  tone: FactTone;
  label: string;
  value?: string | number;
  after?: string;
  big?: boolean;
}) {
  const colors = useColors();
  const color = useToneColor(tone);
  return (
    <View style={[styles.chip, big && styles.chipBig, { backgroundColor: `${color}1F`, borderColor: `${color}66` }]}>
      <View style={[styles.icon, big && styles.iconBig, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={big ? 17 : 14} color={colors.background} />
      </View>
      <Text variant="caption" style={[styles.label, big && styles.labelBig]}>
        {label}
      </Text>
      {value !== undefined && (
        <Text style={[styles.value, big && styles.valueBig]} color={color}>
          {value}
        </Text>
      )}
      {after && (
        <Text variant="caption" muted style={[styles.after, big && styles.labelBig]}>
          {after}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingStart: 3, paddingEnd: Spacing.sm + 2, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1.5, flexShrink: 1 },
  chipBig: { paddingVertical: 6, paddingStart: 6, gap: Spacing.sm },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconBig: { width: 30, height: 30, borderRadius: 15 },
  value: { fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 22 },
  valueBig: { fontSize: 22, lineHeight: 28 },
  label: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18 },
  labelBig: { fontSize: 15, lineHeight: 21 },
  after: { flexShrink: 1, fontSize: 14, lineHeight: 19 },
});
