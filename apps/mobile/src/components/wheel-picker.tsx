import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { play } from '@/lib/sounds';
import { Fonts, Radius, useColors } from '@/theme';

const ITEM = 42;
const VISIBLE = 5;
const SNAP = { damping: 22, stiffness: 220, mass: 0.6 };

export type WheelItem = { key: string; label: string; disabled?: boolean };

/**
 * A scrolling drum, like the clock and calendar wheels of modern phones: drag or flick it,
 * it settles on the nearest row with a little click and a tick of vibration for every row
 * that passes the middle. Tapping a row also picks it. Disabled rows are greyed and skipped.
 */
export function WheelPicker({
  items,
  index,
  onChange,
  width = 80,
  label,
}: {
  items: WheelItem[];
  index: number;
  onChange: (index: number) => void;
  width?: number;
  /** Read out for screen readers (e.g. "Hour"). */
  label: string;
}) {
  const colors = useColors();
  const offset = useSharedValue(-index * ITEM);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const last = items.length - 1;
  const usable = items.map((item) => !item.disabled);

  // Follows the chosen row when it changes from outside (e.g. another wheel made it invalid).
  useEffect(() => {
    if (!dragging.get()) offset.set(withSpring(-index * ITEM, SNAP));
  }, [index, offset, dragging]);

  // Nearest allowed row to the one the wheel stopped on.
  const settle = (raw: number) => {
    'worklet';
    let target = Math.max(0, Math.min(last, raw));
    if (!usable[target]) {
      for (let step = 1; step <= last; step++) {
        if (target + step <= last && usable[target + step]) {
          target += step;
          break;
        }
        if (target - step >= 0 && usable[target - step]) {
          target -= step;
          break;
        }
      }
    }
    return target;
  };

  const pan = usePanGesture({
    activeOffsetY: [-4, 4],
    onActivate: () => {
      'worklet';
      dragging.set(true);
      start.set(offset.get());
    },
    onUpdate: (event) => {
      'worklet';
      const next = start.get() + event.translationY;
      const min = -last * ITEM;
      // Rubber band past the ends.
      offset.set(next > 0 ? next * 0.35 : next < min ? min + (next - min) * 0.35 : next);
    },
    onDeactivate: (event) => {
      'worklet';
      dragging.set(false);
      const projected = offset.get() + event.velocityY * 0.18;
      const target = settle(Math.round(-projected / ITEM));
      offset.set(withSpring(-target * ITEM, { ...SNAP, velocity: event.velocityY }));
      scheduleOnRN(onChange, target);
    },
  });

  // The click: each time a new row crosses the middle.
  useAnimatedReaction(
    () => Math.round(-offset.get() / ITEM),
    (now, before) => {
      if (before !== null && now !== before && now >= 0 && now <= last) scheduleOnRN(play, 'tick');
    },
  );

  const list = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() + ITEM * ((VISIBLE - 1) / 2) }] }));

  return (
    <GestureDetector gesture={pan}>
      <View accessibilityRole="adjustable" accessibilityLabel={`${label}: ${items[index]?.label ?? ''}`} style={[styles.wheel, { width }]}>
        {/* The selected row's band, behind the numbers. */}
        <View style={[styles.band, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]} pointerEvents="none" />
        <Animated.View style={list}>
          {items.map((item, i) => (
            <Row
              key={item.key}
              item={item}
              i={i}
              offset={offset}
              onPress={() => {
                if (item.disabled) return;
                offset.set(withSpring(-i * ITEM, SNAP));
                onChange(i);
              }}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** One row: full size in the middle, smaller, fainter and tilted away towards the edges (a drum). */
function Row({ item, i, offset, onPress }: { item: WheelItem; i: number; offset: SharedValue<number>; onPress: () => void }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => {
    const distance = i + offset.get() / ITEM;
    return {
      opacity: interpolate(Math.abs(distance), [0, 1, 2, 3], [1, 0.62, 0.3, 0.1], 'clamp'),
      transform: [
        { perspective: 300 },
        { rotateX: `${interpolate(distance, [-3, 0, 3], [-62, 0, 62], 'clamp')}deg` },
        { scale: interpolate(Math.abs(distance), [0, 2], [1.12, 0.84], 'clamp') },
      ],
    };
  });
  return (
    <Animated.View style={[styles.row, style]}>
      <Pressable onPress={onPress} style={styles.press} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.text} color={item.disabled ? colors.textMuted : colors.text} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wheel: { height: ITEM * VISIBLE, overflow: 'hidden' },
  band: { position: 'absolute', left: 2, right: 2, top: ITEM * ((VISIBLE - 1) / 2), height: ITEM, borderRadius: Radius.md, borderWidth: 1.5 },
  row: { height: ITEM, justifyContent: 'center' },
  press: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 30, writingDirection: 'ltr' },
});
