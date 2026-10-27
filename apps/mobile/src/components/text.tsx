import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { alignFor, textDirection } from '@/i18n/direction';

import { useLanguage } from '@/i18n/language-provider';
import { Fonts, useColors } from '@/theme';

const variants = {
  /** One big number per screen (balance, earnings, ETA). */
  display: { fontFamily: Fonts.extrabold, fontSize: 40, lineHeight: 56, fontVariant: ['tabular-nums'] },
  hero: { fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 46 },
  title: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 38 },
  // The reading sizes follow the client home's "Where to?" list, which reads easily on a
  // phone at arm's length: nothing a person must read is smaller than 15.
  subtitle: { fontFamily: Fonts.semibold, fontSize: 19, lineHeight: 31 },
  body: { fontFamily: Fonts.medium, fontSize: 17, lineHeight: 28 },
  label: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 28 },
  caption: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 24 },
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
