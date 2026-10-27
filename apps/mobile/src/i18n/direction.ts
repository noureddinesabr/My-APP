import { I18nManager } from 'react-native';

/**
 * On phones, Arabic runs in the native RTL mode, which also swaps `left` and `right` in
 * styles (so `left: 0` lands on the right). Use `physical()` where something must sit on a
 * given physical side whatever the language (map overlays, drawings).
 */
export const nativeSwap = !!(I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL);

/** The style key that really lands on the given physical side. */
export function physical(side: 'left' | 'right'): 'left' | 'right' {
  if (!nativeSwap) return side;
  return side === 'left' ? 'right' : 'left';
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏ]/;

/**
 * Direction of user-written text from its first strong letter: Arabic → right to left,
 * French/English → left to right; `fallback` when there is no letter yet (empty, digits).
 */
export function textDirection(text: string | undefined | null, fallback: boolean): 'rtl' | 'ltr' {
  for (const char of text ?? '') {
    if (RTL_CHAR.test(char)) return 'rtl';
    if (LTR_CHAR.test(char)) return 'ltr';
  }
  return fallback ? 'rtl' : 'ltr';
}

/** textAlign for text that starts on the right (rtl) or the left. */
export function alignFor(direction: 'rtl' | 'ltr') {
  return physical(direction === 'rtl' ? 'right' : 'left');
}
