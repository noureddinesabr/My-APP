import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import { Glass } from '@/components/glass';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Fonts, softShadow, useColors } from '@/theme';

/** Unread in-app notifications for the signed-in account of the current role. */
export function useUnread() {
  const { account } = useMyRecord();
  const items = useQuery('notifications', account ? [['userId', account.id]] : null);
  return (items ?? []).filter((item) => !item.read).length;
}

/**
 * The bell over a map (top start corner): opens the notification list. Replaces the old ☰
 * drawer now that the bottom tabs carry the navigation, so no screen has two menus.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const colors = useColors();
  const unread = useUnread();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('notif.title')}
      scaleTo={0.9}
      onPress={() => router.push('/notifications')}
      style={[styles.button, softShadow(colors.shadow, 1)]}>
      <Glass style={styles.button} thickness="thick">
        <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
      </Glass>
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.accentFill, borderColor: colors.surface }]}>
          <Text variant="caption" color={colors.onPrimary} style={styles.badgeText}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, end: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 13, fontFamily: Fonts.bold },
});
