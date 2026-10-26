import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { play } from '@/lib/sounds';

/**
 * Opens a phone call, WhatsApp chat or map link.
 * In a browser this is a real link (`<a href>`): pages like the preview block opening links from
 * code, but they let the person follow a link they tap. In the phone app it opens through the system.
 */
export function ExternalLink({
  href,
  label,
  children,
  style,
}: {
  href: string;
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === 'web') {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        // react-native-web renders a Pressable with href as <a href>, keeping the normal link behaviour.
        {...({ href, hrefAttrs: { target: href.startsWith('http') ? '_blank' : '_top', rel: 'noopener noreferrer' } } as object)}
        onPress={() => play('tap')}
        style={style}>
        {children}
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        play('tap');
        Linking.openURL(href).catch(() => {});
      }}
      style={style}>
      {children}
    </Pressable>
  );
}

export const callUrl = (digits: string) => `tel:+${digits}`;
export const whatsappUrl = (digits: string) => `https://wa.me/${digits}`;
