import { Slot } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery } from '@/backend';
import { TabBar } from '@/components/tab-bar';
import { useAccount } from '@/state/account';

/** Driver app: five tabs — Home, Routes, Jobs, Earnings, Profile (Doc 2 §4). */
export default function DriverTabs() {
  const { t } = useTranslation();
  const { driver } = useAccount();
  const bookings = useQuery('bookings', driver ? [['driverId', driver.id]] : null);
  const waiting = (bookings ?? []).filter((booking) => booking.status === 'requested').length;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <TabBar
        items={[
          { href: '/driver', label: t('tabs.home'), icon: 'home-outline', iconActive: 'home' },
          { href: '/routes', label: t('tabs.routes'), icon: 'map-marker-path', iconActive: 'map-marker-path' },
          { href: '/jobs', label: t('tabs.jobs'), icon: 'briefcase-outline', iconActive: 'briefcase', badge: waiting },
          { href: '/earnings', label: t('tabs.earnings'), icon: 'chart-box-outline', iconActive: 'chart-box' },
          { href: '/driver-profile', label: t('tabs.profile'), icon: 'account-circle-outline', iconActive: 'account-circle' },
        ]}
      />
    </View>
  );
}
