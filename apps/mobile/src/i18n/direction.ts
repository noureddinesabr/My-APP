import { I18nManager } from 'react-native';

/**
 * Arabic is laid out by our own root `direction: 'rtl'` (as on the web), never by the
 * phone's native RTL mode, so `left`/`right` always mean the physical side. Builds before
 * this one turned native RTL on; on the first launch after updating it can still be on
 * (it is switched off for the next launch), and then the phone swaps left and right.
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
