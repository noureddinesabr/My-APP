import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/text';
import { Gradient } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Gradients, Radius, softShadow, useColors } from '@/theme';

const KNOB = 56;
const PAD = 4;

/**
 * Slide-to-confirm: one deliberate gesture instead of a tap, so nothing is
 * confirmed by accident while driving. Slides toward the reading direction.
 */
export function SwipeButton({
  label,
  onConfirm,
  variant = 'accent',
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  variant?: 'accent' | 'primary';
  disabled?: boolean;
}) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const track = Math.max(0, width - KNOB - PAD * 2);
  const travel = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  const rtlRef = useRef(rtl);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
    rtlRef.current = rtl;
    disabledRef.current = disabled;
  }, [onConfirm, rtl, disabled]);

  // The responder is created once and reads the latest props through refs when a gesture happens.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => play('tap'),
      onPanResponderMove: (_, g) => {
        const dx = rtlRef.current ? -g.dx : g.dx;
        x.setValue(Math.max(0, Math.min(travel.current, dx)));
      },
      onPanResponderRelease: (_, g) => {
        const dx = rtlRef.current ? -g.dx : g.dx;
        if (dx >= travel.current * 0.85) {
          Animated.timing(x, { toValue: travel.current, duration: 120, useNativeDriver: false }).start(() => {
            onConfirmRef.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    travel.current = Math.max(0, next - KNOB - PAD * 2);
  };

  const translate = rtl ? Animated.multiply(x, -1) : x;
  const labelOpacity = track ? x.interpolate({ inputRange: [0, track * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }) : 1;

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={() => !disabled && onConfirm()}
      style={[styles.wrap, { opacity: disabled ? 0.5 : 1 }, softShadow(variant === 'accent' ? Gradients.accent[1] : Gradients.primary[1])]}>
      <Gradient colors={variant === 'accent' ? Gradients.accent : Gradients.primary} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]} pointerEvents="none">
        <Text variant="label" color={colors.onPrimary} center>
          {label}
        </Text>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.onPrimary} style={{ opacity: 0.7 }} />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.knob, { backgroundColor: colors.surface, transform: [{ translateX: translate }] }]}>
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={24} color={variant === 'accent' ? colors.accent : colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: KNOB + PAD * 2, borderRadius: Radius.pill, overflow: 'hidden', justifyContent: 'center', padding: PAD },
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
