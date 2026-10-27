import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { alignFor, textDirection } from '@/i18n/direction';

import { useLanguage } from '@/i18n/language-provider';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

export function TextInput({ style, ...rest }: TextInputProps) {
  const colors = useColors();
  const { rtl } = useLanguage();
  // What is typed starts on its own side: Arabic on the right, French/English on the left.
  const direction = textDirection(rest.value ?? rest.defaultValue, rtl);

  return (
    <RNTextInput
      placeholderTextColor={colors.textMuted}
      style={[
        {
          fontFamily: Fonts.medium,
          fontSize: 17,
          color: colors.text,
          backgroundColor: colors.surfaceMuted,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          minHeight: 52,
          textAlign: alignFor(direction),
          writingDirection: direction,
        },
        style,
      ]}
      {...rest}
    />
  );
}
