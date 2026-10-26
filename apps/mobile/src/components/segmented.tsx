import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { haptic } from '@/lib/haptics';
import { Springs } from '@/lib/motion';
import { Radius, useColors } from '@/theme';

/** Pill toggle with a thumb that springs to the chosen option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width / options.length;
  const thumb = useAnimatedStyle(() => ({
    width: segment - 6,
    transform: [{ translateX: withSpring(index * segment, Springs.press) }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      {width > 0 && <Animated.View style={[styles.thumb, { backgroundColor: colors.cta }, thumb]} />}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(option.value);
            }}
            style={styles.option}>
            <Text variant="label" center color={selected ? colors.onCta : colors.text}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.pill, padding: 3, minHeight: 46 },
  thumb: { position: 'absolute', top: 3, bottom: 3, start: 3, borderRadius: Radius.pill },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
