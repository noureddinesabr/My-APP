import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ForwardChevron } from '@/components/ui';
import { play } from '@/lib/sounds';
import { softShadow, Spacing, useColors } from '@/theme';

/**
 * Going back, floating over the map like the ☰ and location buttons: a round button with a
 * chevron that springs when pressed (with a soft whoosh). Optionally followed by the trip as
 * two little pins (violet box → red flag) instead of a bar of words.
 */
export function BackButton({ onPress, trip }: { onPress: () => void; trip?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        feedback={null}
        scaleTo={0.86}
        onPress={() => {
          play('whoosh');
          onPress();
        }}
        style={[styles.round, softShadow(colors.shadow, 1)]}>
        <Glass style={styles.round} thickness="thick">
          <ForwardChevron color={colors.text} flip />
        </Glass>
      </PressableScale>
      {trip && (
        <Glass style={styles.trip} thickness="thick">
          <Pin color={colors.primaryFill} icon="package-variant-closed" />
          <View style={[styles.dash, { borderColor: colors.primary }]} />
          <Pin color={colors.accentFill} icon="flag-checkered" />
        </Glass>
      )}
    </View>
  );
}

function Pin({ color, icon }: { color: string; icon: 'package-variant-closed' | 'flag-checkered' }) {
  const colors = useColors();
  return (
    <View style={[styles.pin, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  trip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, height: 36, borderRadius: 18 },
  pin: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dash: { width: 18, borderTopWidth: 2, borderStyle: 'dashed' },
});
