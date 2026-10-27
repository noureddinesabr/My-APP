import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useCountUp } from '@/components/motion/use-count-up';
import { Text } from '@/components/text';

/**
 * Small looping effects that make the app feel alive. All of them hold still when
 * "Reduce motion" is on, and none of them catch touches.
 */

/** A soft band of light that sweeps across its parent every few seconds (main buttons). */
export function Shimmer({ every = 3200, color = 'rgba(255,255,255,0.35)' }: { every?: number; color?: string }) {
  const still = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (still || !width) return;
    x.set(0);
    x.set(withRepeat(withSequence(withDelay(every, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1, false));
    return () => cancelAnimation(x);
  }, [x, width, every, still]);
  const band = Math.max(60, width * 0.35);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -band + x.get() * (width + band * 2) }, { skewX: '-20deg' }] }));
  if (still) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View style={[styles.band, { width: band }, style]}>
          <LinearGradient colors={['transparent', color, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

/** A dot with a ring rippling out of it: "live", "online", "new". */
export function PulseDot({ color, size = 12 }: { color: string; size?: number }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [t, still]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.get()), transform: [{ scale: 1 + t.get() * 1.8 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, ring]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }]} />
    </View>
  );
}

/** Gently bobs its child up and down (icons on banners, empty states). */
export function Float({ children, distance = 4, duration = 1400, style }: { children: ReactNode; distance?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.set(withRepeat(withSequence(withTiming(-distance, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1, false));
    return () => cancelAnimation(y);
  }, [y, distance, duration, still]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Pops (springs bigger, then back) every time `trigger` changes, e.g. a counter going up. */
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.set(withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 220 })));
  }, [trigger, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** A number that counts up (or down) to its new value, then pops. */
export function CountUp({
  value,
  from,
  format = String,
  variant,
  color,
  style,
}: {
  value: number;
  /** Count up from this on first show (e.g. 0), instead of starting at the value. */
  from?: number;
  format?: (value: number) => string;
  variant?: 'display' | 'hero' | 'title' | 'subtitle' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const shown = useCountUp(value, 700, from);
  return (
    <Pop trigger={value}>
      <Text variant={variant} color={color} style={style}>
        {format(shown)}
      </Text>
    </Pop>
  );
}

/** Nudges its child towards the reading end now and then: "slide me". */
export function Nudge({ children, distance = 10, every = 2600 }: { children: ReactNode; distance?: number; every?: number }) {
  const still = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    x.set(
      withRepeat(
        withSequence(withDelay(every, withTiming(distance, { duration: 260, easing: Easing.out(Easing.quad) })), withSpring(0, { damping: 6, stiffness: 180 })),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(x);
  }, [x, distance, every, still]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: -10, bottom: -10 },
});
