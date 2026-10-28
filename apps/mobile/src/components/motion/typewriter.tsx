import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useColors } from '@/theme';

const LETTER_MS = 70;
const HOLD_MS = 1800;

/**
 * A hint that types itself, letter by letter, with a blinking cursor, then starts again: an
 * empty box that says "you can write here" without putting example words in it.
 */
export function TypewriterHint({ text }: { text: string }) {
  const colors = useColors();
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) return;
    const delay = shown >= text.length ? HOLD_MS : LETTER_MS;
    const timer = setTimeout(() => setShown((n) => (n >= text.length ? 0 : n + 1)), delay);
    return () => clearTimeout(timer);
  }, [shown, text, still]);
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.set(withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1, false));
  }, [blink]);
  const cursor = useAnimatedStyle(() => ({ opacity: blink.get() }));
  return (
    <View style={styles.row} pointerEvents="none">
      <Text muted>{text.slice(0, shown)}</Text>
      <Animated.View style={[styles.cursor, { backgroundColor: colors.primary }, cursor]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  cursor: { width: 2, height: 22, borderRadius: 1 },
});
