import { useState } from 'react';
import { Platform, TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { alignFor, textDirection } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

/**
 * A field that clearly looks like one: lighter than the page, with a visible border that
 * turns violet while typing, so people see at once where they can write.
 */
export function TextInput({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const [focused, setFocused] = useState(false);
  // What is typed starts on its own side: Arabic on the right, French/English on the left.
  const direction = textDirection(rest.value ?? rest.defaultValue, rtl);

  return (
    <RNTextInput
      maxFontSizeMultiplier={1.15}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
        // In a phone browser the keyboard can cover the page without resizing it: once it has
        // opened, scroll the field into view so people always see what they type.
        if (Platform.OS === 'web') {
          const node = event.target as unknown as { scrollIntoView?: (options: object) => void };
          for (const wait of [350, 800]) setTimeout(() => node?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }), wait);
        }
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        {
          fontFamily: Fonts.medium,
          fontSize: 17,
          color: colors.text,
          backgroundColor: colors.surfaceMuted,
          borderRadius: Radius.md,
          borderWidth: 2,
          borderColor: focused ? colors.primary : colors.border,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          minHeight: 54,
          // Allowed to shrink inside rows (browsers otherwise keep a text box's natural width).
          minWidth: 0,
          textAlign: alignFor(direction),
          writingDirection: direction,
        },
        style,
      ]}
      {...rest}
    />
  );
}
