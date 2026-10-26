import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

/** "+212 612345678" → "212612345678" for links. */
export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, '');
}

/**
 * Call and WhatsApp the other side in one tap. The number is also shown as
 * text with a copy button, for when a phone link can't open (e.g. in a browser).
 */
export function ContactButtons({ phone, unread = 0, onChat }: { phone: string; unread?: number; onChat?: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const digits = phoneDigits(phone);

  const open = (url: string) => {
    play('tap');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.row}>
        <Action icon="call" label={t('contact.call')} color={colors.success} onPress={() => open(`tel:+${digits}`)} />
        <Action
          icon="whatsapp"
          community
          label="WhatsApp"
          color="#25D366"
          onPress={() => open(`https://wa.me/${digits}`)}
        />
        {onChat && <Action icon="chatbubbles" label={t('chat.title')} color={colors.primary} badge={unread} onPress={onChat} />}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('contact.copy')}
        onPress={() => {
          Clipboard.setStringAsync(phone).then(() => {
            play('tap');
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        style={[styles.number, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="call-outline" size={16} color={colors.textMuted} />
        <Text variant="label" selectable style={{ flex: 1, writingDirection: 'ltr', textAlign: 'left' }}>
          {phone}
        </Text>
        <Text variant="caption" color={copied ? colors.success : colors.primary}>
          {copied ? t('contact.copied') : t('contact.copy')}
        </Text>
      </Pressable>
    </View>
  );
}

function Action({
  icon,
  label,
  color,
  onPress,
  community,
  badge = 0,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  community?: boolean;
  badge?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.85 : 1 }]}>
      {community ? (
        <MaterialCommunityIcons name={icon as 'whatsapp'} size={22} color={colors.onPrimary} />
      ) : (
        <Ionicons name={icon as 'call'} size={20} color={colors.onPrimary} />
      )}
      <Text variant="label" color={colors.onPrimary}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
          <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 11, lineHeight: 15 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 48,
    borderRadius: Radius.md,
  },
  number: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  badge: {
    position: 'absolute',
    top: -6,
    end: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
