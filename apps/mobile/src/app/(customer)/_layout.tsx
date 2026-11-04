import { Slot } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery } from '@/backend';
import { useUnread } from '@/components/notification-bell';
import { TabBar } from '@/components/tab-bar';
import { useAccount } from '@/state/account';

/** Customer app: four tabs — Home, Bookings, Messages, Account (Doc 2 §3). */
export default function CustomerTabs() {
  const { t } = useTranslation();
  const { client } = useAccount();
  const jobs = useQuery('jobs', client ? [['clientId', client.id]] : null);
  const active = (jobs ?? []).filter((job) => job.status !== 'completed' && job.status !== 'cancelled').length;
  const unread = useUnread();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <TabBar
        items={[
          { href: '/client', label: t('tabs.home'), icon: 'home-outline', iconActive: 'home' },
          { href: '/bookings', label: t('tabs.bookings'), icon: 'clipboard-text-outline', iconActive: 'clipboard-text', badge: active },
          { href: '/messages', label: t('tabs.messages'), icon: 'message-outline', iconActive: 'message', badge: unread },
          { href: '/account', label: t('tabs.account'), icon: 'account-circle-outline', iconActive: 'account-circle' },
        ]}
      />
    </View>
  );
}
