import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
import { haptic } from '@/lib/haptics';
import { Springs } from '@/lib/motion';
import { play } from '@/lib/sounds';
import { Radius, useColors } from '@/theme';

const KNOB = 56;
const PAD = 4;
/** Share of the track that confirms when released. */
const CONFIRM_AT = 0.85;

/**
 * Slide-to-confirm: one deliberate gesture instead of a tap, so nothing is confirmed by
 * accident while driving. Follows the finger on the UI thread, ticks when it reaches the
 * confirm point, and springs back if released early. Slides toward the reading direction.
 */
export function SwipeButton({
  label,
  onConfirm,
  variant = 'accent',
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  /** accent: green (finish / deliver); primary: blue (start). */
  variant?: 'accent' | 'primary';
  disabled?: boolean;
}) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const [width, setWidth] = useState(0);
  const travel = Math.max(0, width - KNOB - PAD * 2);
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const direction = rtl ? -1 : 1;
  const fill = variant === 'accent' ? colors.successFill : colors.primaryFill;

  const confirm = () => {
    play('success');
    onConfirm();
  };

  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-6, 6],
    onBegin: () => {
      'worklet';
      scheduleOnRN(haptic, 'light');
    },
    onUpdate: (event) => {
      'worklet';
      const next = Math.max(0, Math.min(travel, event.translationX * direction));
      x.set(next);
      const reached = next >= travel * CONFIRM_AT;
      if (reached !== armed.get()) {
        armed.set(reached);
        scheduleOnRN(haptic, reached ? 'selection' : 'light');
      }
    },
    onDeactivate: (event) => {
      'worklet';
      armed.set(false);
      if (event.translationX * direction >= travel * CONFIRM_AT) {
        x.set(
          withSpring(travel, Springs.press, (finished) => {
            if (!finished) return;
            scheduleOnRN(confirm);
            x.set(withSpring(0, Springs.sheet));
          }),
        );
      } else {
        x.set(withSpring(0, { ...Springs.press, velocity: event.velocityX * direction }));
      }
    },
  });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * direction }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: travel ? interpolate(x.get(), [0, travel * 0.6], [1, 0], 'clamp') : 1 }));
  const trailStyle = useAnimatedStyle(() => ({ width: x.get() + KNOB }));

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={() => !disabled && confirm()}
      style={[styles.wrap, { backgroundColor: fill, opacity: disabled ? 0.5 : 1 }]}>
      <Animated.View style={[styles.trail, { backgroundColor: colors.heroControl }, trailStyle]} pointerEvents="none" />
      <Animated.View style={[styles.labelWrap, labelStyle]} pointerEvents="none">
        <Text variant="label" color={colors.onPrimary} center>
          {label}
        </Text>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.onPrimary} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, { backgroundColor: colors.onPrimary }, knobStyle]}>
          <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={24} color={fill} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: KNOB + PAD * 2, borderRadius: Radius.pill, overflow: 'hidden', justifyContent: 'center', padding: PAD },
  trail: { position: 'absolute', top: PAD, bottom: PAD, start: PAD, borderRadius: Radius.pill },
  labelWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: KNOB + 8,
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' },
});
