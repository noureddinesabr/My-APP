import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One vocabulary for touch feedback, matched to what just happened on screen:
 * - selection: a chip, tab, toggle or picker value changed
 * - light / medium: a button press / a sent message, a card picked up
 * - success: something completed (offer accepted, sheet confirmed, delivery done)
 * - warning: an action was refused (invalid code, missing permission)
 * - rigid: hitting a limit (stepper min/max, dragging past an edge)
 * - error: something failed
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'rigid' | 'error';

const NATIVE: Record<HapticKind, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  rigid: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

/** Android browsers: short vibration patterns (ms) as a stand-in for the Taptic Engine. */
const WEB: Record<HapticKind, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 18,
  success: [12, 60, 18],
  warning: [24, 50, 24],
  rigid: 28,
  error: [30, 40, 30, 40, 30],
};

export function haptic(kind: HapticKind) {
  if (Platform.OS !== 'web') {
    NATIVE[kind]().catch(() => {});
    return;
  }
  try {
    (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.(WEB[kind]);
  } catch {
    // Not allowed here (iOS Safari, sandboxed frames): visual feedback only.
  }
}
