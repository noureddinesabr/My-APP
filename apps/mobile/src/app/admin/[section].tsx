import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Audit, Commission, Company, Invoices, NotificationSettings, Payments, Policies, Reports } from '@/components/admin/finance';
import { Bookings, Disputes, Requests, Routes, SharedTrips } from '@/components/admin/marketplace';
import { ActiveOps, LiveMap, Overview } from '@/components/admin/monitor';
import { Admins, Customers, Drivers } from '@/components/admin/people';
import { StateView } from '@/components/ds';

/** One page per admin section (the sidebar's keys). */
export default function AdminSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { t } = useTranslation();
  switch (section) {
    case 'overview':
      return <Overview />;
    case 'map':
      return <LiveMap />;
    case 'active':
      return <ActiveOps />;
    case 'requests':
      return <Requests />;
    case 'routes':
      return <Routes />;
    case 'returns':
      return <Routes kind="return" />;
    case 'bookings':
      return <Bookings />;
    case 'shared':
      return <SharedTrips />;
    case 'disputes':
      return <Disputes />;
    case 'drivers':
      return <Drivers />;
    case 'vehicles':
      return <Drivers vehiclesView />;
    case 'customers':
      return <Customers />;
    case 'invoices':
      return <Invoices />;
    case 'payments':
      return <Payments />;
    case 'commission':
      return <Commission />;
    case 'reports':
      return <Reports />;
    case 'policies':
      return <Policies />;
    case 'company':
      return <Company />;
    case 'notifications':
      return <NotificationSettings />;
    case 'audit':
      return <Audit />;
    case 'admins':
      return <Admins />;
    default:
      return <StateView state="error" title={t('admin2.unknownPage')} />;
  }
}
