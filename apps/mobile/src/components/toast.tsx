import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
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

/** Banner that slides in at the top for live events (new offer, driver arrived…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [slide] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setMessage(null));
  }, [slide]);

  const show = useCallback(
    (next: ToastMessage) => {
      if (next.sound) play(next.sound);
      setMessage(next);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: false, friction: 7 }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, 4500);
    },
    [slide, hide],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const tone = message?.tone === 'success' ? colors.success : message?.tone === 'accent' ? colors.accent : colors.primary;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + Spacing.sm,
              opacity: slide,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
            },
          ]}>
          <Pressable
            accessibilityRole="alert"
            onPress={() => {
              hide();
              message.onPress?.();
            }}
            style={[styles.toast, { backgroundColor: colors.surface, borderColor: tone }, softShadow(colors.shadow, 1.5)]}>
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
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  icon: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
