import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic, type HapticKind } from '@/lib/haptics';
import { Springs } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that sinks slightly under the finger and springs back (UI-thread animation),
 * with a matching haptic on press.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  feedback = 'light',
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it sinks while pressed. */
  scaleTo?: number;
  /** Haptic on press; null for none (e.g. when a sound already plays one). */
  feedback?: HapticKind | null;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, Springs.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, Springs.press));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback) haptic(feedback);
        onPress?.(event);
      }}
      style={[style, animated, props.disabled ? { opacity: 0.45 } : null]}>
      {children}
    </AnimatedPressable>
  );
}
