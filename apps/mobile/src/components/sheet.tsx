import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { useDirectionStyle } from '@/i18n/language-provider';
import { haptic } from '@/lib/haptics';
import { useKeyboardHeight } from '@/lib/keyboard';
import { Springs } from '@/lib/motion';
import { Radius, Spacing, useColors } from '@/theme';

const OFFSCREEN = 2000;
/** Dismiss when dragged past this share of the sheet's height, or flicked faster than this (pt/s). */
const DISMISS_RATIO = 0.3;
const DISMISS_VELOCITY = 900;

/**
 * Modal bottom sheet: slides up on a spring, follows the finger, and is dismissed by
 * dragging or flicking it down (velocity-aware), tapping outside, or the system back.
 * `drag="handle"` limits dragging to the grab bar, for sheets with maps or lists inside.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  drag = 'sheet',
  fullHeight,
  overMap,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  drag?: 'sheet' | 'handle';
  /** Take almost the whole screen (map pickers, long forms). */
  fullHeight?: boolean;
  /**
   * Over a map screen: take the panel's place only (never higher, even with the keyboard open)
   * and don't dim, so the map above stays in full view.
   */
  overMap?: boolean;
}) {
  const mapSafe = useMapSafeHeight();
  // The browser doesn't move the page for the keyboard: lift the sheet ourselves (phones use the avoiding view).
  const keyboard = useKeyboardHeight();
  const webLift = Platform.OS === 'web' ? keyboard : 0;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const layerDirection = useDirectionStyle();
  const [mounted, setMounted] = useState(visible);
  const offset = useSharedValue(OFFSCREEN);
  const height = useSharedValue(0);
  const bumped = useSharedValue(false);

  // Open: mount first, the spring starts once the sheet has measured itself.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!visible && mounted) {
      offset.set(
        withSpring(height.get() || OFFSCREEN, Springs.sheet, (finished) => {
          if (!finished) return;
          height.set(0); // re-measured (and animated in) next time it opens
          scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, mounted, offset, height]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    const first = height.get() === 0;
    height.set(measured);
    if (first && visible) {
      offset.set(measured);
      offset.set(withSpring(0, Springs.sheet));
    }
  };

  const close = () => {
    haptic('medium');
    onClose();
  };

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      'worklet';
      const y = event.translationY;
      // Rubber band when pulled up past the top, with a firm tick at the limit.
      offset.set(y >= 0 ? y : y * 0.18);
      if (y < -40 && !bumped.get()) {
        bumped.set(true);
        scheduleOnRN(haptic, 'rigid');
      }
    },
    onDeactivate: (event) => {
      'worklet';
      bumped.set(false);
      const dismiss = event.translationY > height.get() * DISMISS_RATIO || event.velocityY > DISMISS_VELOCITY;
      if (dismiss) {
        offset.set(withSpring(height.get(), { ...Springs.sheet, velocity: event.velocityY }));
        scheduleOnRN(close);
      } else {
        offset.set(withSpring(0, { ...Springs.sheet, velocity: event.velocityY }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: height.get() ? interpolate(offset.get(), [0, height.get()], [1, 0], 'clamp') : 0,
  }));

  if (!mounted) return null;

  const grabber = (
    <View style={styles.grabArea}>
      <View style={[styles.grabber, { backgroundColor: colors.border }]} />
      {title && (
        <Text variant="subtitle" center>
          {title}
        </Text>
      )}
    </View>
  );

  const panel = (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.sheet,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.rim, paddingBottom: insets.bottom + Spacing.lg },
        fullHeight && !overMap && { height: '92%' },
        overMap && { height: mapSafe + insets.bottom },
        sheetStyle,
      ]}>
      {drag === 'handle' ? <GestureDetector gesture={pan}>{grabber}</GestureDetector> : grabber}
      <View style={[styles.body, (fullHeight || overMap) && { flex: 1 }]}>{children}</View>
    </Animated.View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={[styles.root, layerDirection]}>
        <Animated.View style={[StyleSheet.absoluteFill, !overMap && { backgroundColor: colors.scrim }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="close" onPress={close} />
        </Animated.View>
        {/* Rides up with the keyboard, so the field and the first answers stay in view. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} pointerEvents="box-none" style={[styles.root, { paddingBottom: webLift }]}>
          {drag === 'sheet' ? <GestureDetector gesture={pan}>{panel}</GestureDetector> : panel}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** The map's share of the screen that must always stay visible above a panel. */
const MAP_MIN = 0.4;
/** Panels under a map: 55% of the screen, the map above; less when the keyboard is up. */
const PANEL_SHARE = 0.55;
/** The strip of map left above the panel while typing. */
const KEYBOARD_MAP = 0.14;

/**
 * Height for a panel or sheet under a map that never covers the map: the panel's usual
 * share of the screen, smaller while the keyboard is open so the map keeps its part above.
 */
export function useMapSafeHeight() {
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  // With the keyboard up, the panel rises so the field and its suggestions stay in view; a strip of map stays above.
  if (keyboard) return Math.max(180, height - keyboard - Math.round(height * KEYBOARD_MAP));
  return Math.max(180, Math.min(Math.round(height * PANEL_SHARE), height - Math.round(height * MAP_MIN)));
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '92%',
  },
  grabArea: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, paddingHorizontal: Spacing.lg },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
});
