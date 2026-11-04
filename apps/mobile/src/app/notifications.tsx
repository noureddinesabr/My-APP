import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery, useStore } from '@/backend';
import { markNotificationsRead } from '@/backend/prototype';
import { useDateFormat } from '@/components/date-format';
import { PageHeader, PrototypeNote, StateView } from '@/components/ds';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Button, Screen } from '@/components/ui';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

/**
 * Notifications (Doc 5 C24 / D40): booking requests, confirmations, joins, discounts, account
 * decisions — newest first, unread in bold. In-app only for now; push, SMS and WhatsApp come
 * with the hosted backend and contracted providers.
 */
export default function Notifications() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const { account } = useMyRecord();
  const items = useQuery('notifications', account ? [['userId', account.id]] : null);
  const list = [...(items ?? [])].sort((a, b) => b.at - a.at);
  const unread = list.filter((item) => !item.read);

  return (
    <Screen
      header={
        <PageHeader
          title={t('notif.title')}
          onBack={() => router.back()}
          right={unread.length ? <Button compact variant="ghost" title={t('notif.markAll')} onPress={() => markNotificationsRead(store, unread)} /> : undefined}
        />
      }>
      {!account ? (
        <StateView state="empty" title={t('history.signIn')} />
      ) : items === undefined ? (
        <StateView state="loading" />
      ) : list.length === 0 ? (
        <StateView state="empty" title={t('notif.empty')} body={t('notif.emptyBody')} />
      ) : (
        list.map((item) => (
          <PressableScale
            key={item.id}
            accessibilityRole="button"
            scaleTo={0.98}
            onPress={() => {
              markNotificationsRead(store, [item]);
              if (item.link) router.push(item.link as Href);
            }}
            style={[styles.row, { backgroundColor: item.read ? colors.surface : colors.primarySoft }, rim(colors)]}>
            <MaterialCommunityIcons name="bell-ring-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" style={!item.read ? { fontFamily: Fonts.bold } : undefined}>
                {t(item.key, { ...item.params, amount: typeof item.params.amount === 'number' ? formatMoney(t, item.params.amount) : item.params.amount })}
              </Text>
              <Text variant="caption" muted>
                {dates.dayTime(new Date(item.at))}
              </Text>
            </View>
          </PressableScale>
        ))
      )}
      <PrototypeNote text={t('notif.prototype')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
});
