import { I18nManager, Text as RNText, type TextProps } from 'react-native';

import { useLanguage } from '@/i18n/language-provider';
import { Fonts, useColors } from '@/theme';

const variants = {
  hero: { fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 44 },
  title: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 34 },
  subtitle: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 28 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 24 },
  caption: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20 },
} as const;

type Props = TextProps & {
  variant?: keyof typeof variants;
  muted?: boolean;
  color?: string;
  center?: boolean;
};

export function Text({ variant = 'body', muted, color, center, style, ...rest }: Props) {
  const colors = useColors();
  const { rtl } = useLanguage();
  // React Native swaps left/right itself when the native layout is RTL, so undo that swap.
  const nativeSwap = !!(I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL);
  const start = rtl !== nativeSwap ? 'right' : 'left';

  return (
    <RNText
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: center ? 'center' : start },
        style,
      ]}
      {...rest}
    />
  );
}
