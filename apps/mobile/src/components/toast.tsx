import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Glass } from '@/components/glass';
import { Text } from '@/components/text';
import { Springs } from '@/lib/motion';
import { play, type SoundName } from '@/lib/sounds';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

export type ToastMessage = {
  title: string;
  body?: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  tone?: 'primary' | 'success' | 'accent';
  sound?: SoundName;
  onPress?: () => void;
};

const ToastContext = createContext<(message: ToastMessage) => void>(() => {});
const HIDDEN = -160;

/**
 * Live events (new offer, driver arrived…) as a floating glass banner at the top.
 * It springs in, and can be flicked away upwards; otherwise it leaves after 4.5 s.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const offset = useSharedValue(HIDDEN);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => setMessage(null), []);

  const hide = useCallback(() => {
    offset.set(
      withSpring(HIDDEN, Springs.bar, (finished) => {
        if (finished) scheduleOnRN(clear);
      }),
    );
  }, [offset, clear]);

  const show = useCallback(
    (next: ToastMessage) => {
      if (next.sound) play(next.sound);
      setMessage(next);
      offset.set(HIDDEN);
      offset.set(withSpring(0, Springs.pop));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, 4500);
    },
    [offset, hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (event) => {
      'worklet';
      offset.set(event.translationY < 0 ? event.translationY : event.translationY * 0.15);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.translationY < -24 || event.velocityY < -500) scheduleOnRN(hide);
      else offset.set(withSpring(0, { ...Springs.pop, velocity: event.velocityY }));
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
    opacity: 1 + Math.max(-1, offset.get() / 120),
  }));

  const tone = message?.tone === 'success' ? colors.successFill : message?.tone === 'accent' ? colors.accentFill : colors.primaryFill;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <GestureDetector gesture={pan}>
          <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.sm }, style]}>
            <Pressable
              accessibilityRole="alert"
              onPress={() => {
                hide();
                message.onPress?.();
              }}
              style={softShadow(colors.shadow, 1.5)}>
              <Glass style={styles.toast} thickness="thick">
                <View style={[styles.icon, { backgroundColor: tone }]}>
                  <MaterialCommunityIcons name={message.icon ?? 'bell-ring-outline'} size={20} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1}>
                    {message.title}
                  </Text>
                  {message.body && (
                    <Text variant="caption" muted numberOfLines={2}>
                      {message.body}
                    </Text>
                  )}
                </View>
              </Glass>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl },
  icon: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
