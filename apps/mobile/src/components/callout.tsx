import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Springs } from '@/lib/motion';
import { Radius, softShadow, Spacing, useColors } from '@/theme';


/** Holds the predicted-next-step callout at the bottom of a screen, in the thumb zone. */
export function CalloutSlot({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <View style={[styles.wrap, { paddingBottom: Spacing.md }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

/** The predicted next step, floating above the dock (resume a draft, open the live trip…). */
export function Callout({
  icon,
  title,
  body,
  onPress,
  tone = 'primary',
  progress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  onPress: () => void;
  tone?: 'primary' | 'success' | 'accent';
  /** 0–1: shows a progress bar (e.g. how much of a draft is done). */
  progress?: number;
}) {
  const colors = useColors();
  const fill = tone === 'success' ? colors.successFill : tone === 'accent' ? colors.accentFill : colors.primaryFill;
  return (
    <Animated.View entering={FadeInDown.springify().damping(Springs.pop.damping).stiffness(Springs.pop.stiffness)} exiting={FadeOutDown}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={title}
        scaleTo={0.97}
        feedback="medium"
        onPress={onPress}
        style={[styles.callout, { backgroundColor: colors.surfaceFloating, borderColor: colors.rim }, softShadow(colors.shadow, 1.2)]}>
        <View style={[styles.calloutIcon, { backgroundColor: fill }]}>
          <Ionicons name={icon} size={20} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>
            {title}
          </Text>
          {body && (
            <Text variant="caption" muted numberOfLines={1}>
              {body}
            </Text>
          )}
          {progress !== undefined && (
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          )}
        </View>
        <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  dock: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.xl, padding: Spacing.xs + 2 },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.lg },
  mainItem: { flex: 1, alignItems: 'center', gap: 2 },
  mainCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  label: { fontSize: 11, lineHeight: 15 },
  badge: {
    position: 'absolute',
    top: -6,
    end: -10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 3,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 13 },
  callout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  calloutIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 3 },
});
