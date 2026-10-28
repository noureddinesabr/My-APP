import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { NoticeCard } from '@/components/notice';
import { notifyNow } from '@/lib/notify';
import { Springs } from '@/lib/motion';
import { play, type SoundName } from '@/lib/sounds';
import { Spacing } from '@/theme';

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
 * Live events (new offer, driver arrived…) as a phone-style notification at the top.
 * It springs in, can be flicked away (up or sideways) or tapped; otherwise it leaves after 6 s.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
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
      // App in the background (phone in the pocket): the same news as a phone notification.
      if (AppState.currentState !== 'active') notifyNow(next.title, next.body ?? '');
      if (next.sound) play(next.sound);
      setMessage(next);
      offset.set(HIDDEN);
      offset.set(withSpring(0, Springs.pop));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, 6000);
    },
    [offset, hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <Animated.View key={message.title} pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.sm }, style]}>
          <NoticeCard
            icon={message.icon ?? 'bell-ring-outline'}
            title={message.title}
            body={message.body}
            tone={message.tone}
            onDismiss={clear}
            onPress={() => {
              hide();
              message.onPress?.();
            }}
          />
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 100 },
});
