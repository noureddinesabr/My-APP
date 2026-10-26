import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/text';
import { Gradient } from '@/components/ui';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

/**
 * Linear progress toward a finish line. `completed` counts steps the user has
 * really done (including ones done before this screen, like choosing an account type),
 * so progress never starts at 0%.
 */
export function ProgressSteps({ labels, completed }: { labels: string[]; completed: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const percent = Math.round((completed / labels.length) * 100);

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.header}>
        <Text variant="caption" color={colors.primary}>
          {t('request.percentDone', { percent })}
        </Text>
        <Text variant="caption" muted>
          {labels[Math.min(completed, labels.length - 1)]}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <Gradient colors={Gradients.primary} style={{ ...styles.fill, width: `${Math.max(percent, 4)}%` }} />
      </View>
      <View style={styles.dots}>
        {labels.map((label, index) => {
          const done = index < completed;
          const current = index === completed;
          return (
            <View key={label} style={styles.dotItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? colors.primaryFill : colors.surface,
                    borderColor: done || current ? colors.primary : colors.border,
                  },
                ]}>
                {done && <Ionicons name="checkmark" size={12} color={colors.onPrimary} />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  dotItem: { alignItems: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
