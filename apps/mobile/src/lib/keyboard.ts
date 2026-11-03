import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How tall the on-screen keyboard is right now (0 when closed). Phones report it with keyboard
 * events; a phone browser doesn't resize the page for the keyboard, so there it is read from
 * the visual viewport (the part of the page left visible above the keyboard).
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!viewport) return;
      const update = () => {
        const covered = window.innerHeight - viewport.height - viewport.offsetTop;
        // Small differences are browser bars, not a keyboard.
        setHeight(covered > 120 ? Math.round(covered) : 0);
      };
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      update();
      return () => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
      };
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * `keyboardVerticalOffset` for a KeyboardAvoidingView: how far below the top of the phone's
 * screen the app starts. The root layout pads everything by the status bar, and without this
 * the view lifts that much too little, leaving the bottom button half under the keyboard.
 */
export function useKeyboardOffset() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 0 : insets.top;
}
