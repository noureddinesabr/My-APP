import { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
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
  const { rtl } = useLanguage();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width / options.length;
  // Physical position of the chosen option (options run right to left in Arabic). On phones
  // with a native RTL layout, `left: 0` is mirrored to the right edge, so measure from there.
  const nativeSwap = !!(I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL);
  const target = (rtl ? width - (index + 1) * segment : index * segment) + 3;
  const base = nativeSwap ? width - segment + 3 : 3;
  const thumb = useAnimatedStyle(() => ({
    width: segment - 6,
    transform: [{ translateX: withSpring(target - base, Springs.press) }],
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
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: Radius.pill },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
