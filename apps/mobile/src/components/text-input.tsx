import { I18nManager, TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { useLanguage } from '@/i18n/language-provider';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

export function TextInput({ style, ...rest }: TextInputProps) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const nativeSwap = !!(I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL);

  return (
    <RNTextInput
      placeholderTextColor={colors.textMuted}
      style={[
        {
          fontFamily: Fonts.medium,
          fontSize: 15,
          color: colors.text,
          backgroundColor: colors.surfaceMuted,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          minHeight: 48,
          textAlign: rtl !== nativeSwap ? 'right' : 'left',
        },
        style,
      ]}
      {...rest}
    />
  );
}
