import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { alignFor, textDirection } from '@/i18n/direction';

import { useLanguage } from '@/i18n/language-provider';
import { Fonts, useColors } from '@/theme';

const variants = {
  /** One big number per screen (balance, earnings, ETA). */
  display: { fontFamily: Fonts.extrabold, fontSize: 40, lineHeight: 54, fontVariant: ['tabular-nums'] },
  hero: { fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 44 },
  title: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 34 },
  subtitle: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 28 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 24 },
  caption: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20 },
} as const satisfies Record<string, TextStyle>;

type Props = TextProps & {
  variant?: keyof typeof variants;
  muted?: boolean;
  color?: string;
  center?: boolean;
  /** Something a person wrote (chat, notes): align it by its own language, not the app's. */
  userText?: boolean;
};

export function Text({ variant = 'body', muted, color, center, userText, style, ...rest }: Props) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const direction = userText && typeof rest.children === 'string' ? textDirection(rest.children, rtl) : rtl ? 'rtl' : 'ltr';
  const start = alignFor(direction);

  return (
    <RNText
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: center ? 'center' : start, writingDirection: direction },
        style,
      ]}
      {...rest}
    />
  );
}
