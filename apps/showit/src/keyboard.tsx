import type { ReactNode } from 'react';
import { KeyboardAwareScrollView, KeyboardProvider, useKeyboardState } from 'react-native-keyboard-controller';

/**
 * The keyboard on phones (react-native-keyboard-controller). Android phones draw the app under
 * the system bars, so the window no longer shrinks for the keyboard by itself: this library reads
 * the keyboard's real height and position, and the scroll views keep the box being typed in
 * fully visible right above it. The browser preview uses `keyboard.web.tsx`.
 */
export function KeyboardShell({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

/** How much of the bottom of the screen the keyboard covers (0 when it's closed). */
export function useKeyboardInset() {
  return useKeyboardState((s) => (s.isVisible ? s.height : 0));
}

/** A ScrollView that scrolls the focused box above the keyboard, with a little room under it. */
export const KeyboardScroll = KeyboardAwareScrollView;
