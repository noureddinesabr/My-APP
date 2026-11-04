import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@/backend';
import { normalizeJob } from '@/backend/actions';
import { useDateFormat } from '@/components/date-format';
import { FilterChips, ListRow, PageHeader, StateView } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { BookingCard } from '@/components/route-cards';
import { Screen } from '@/components/ui';
import { useAccount } from '@/state/account';

type Tab = 'active' | 'upcoming' | 'completed';

/**
 * Bookings tab (Doc 5 C21): everything the customer has booked, in three lists — active (on
 * the road or waiting for offers), upcoming (booked ahead, awaiting the driver) and completed.
 * Request-based trips and route bookings sit together.
 */
export default function Bookings() {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { client } = useAccount();
  const [tab, setTab] = useState<Tab>('active');
  const requests = useQuery('requests', client ? [['clientId', client.id]] : null);
  const jobs = useQuery('jobs', client ? [['clientId', client.id]] : null);
  const bookings = useQuery('bookings', client ? [['customerId', client.id]] : null);
  const loading = client && (requests === undefined || jobs === undefined || bookings === undefined);

  const jobList = (jobs ?? []).map(normalizeJob);
  const group = {
    active: {
      requests: (requests ?? []).filter((r) => r.status === 'open'),
      jobs: jobList.filter((j) => !['scheduled', 'completed', 'cancelled'].includes(j.status)),
      bookings: (bookings ?? []).filter((b) => ['inTransit', 'delivered', 'awaitingOriginal'].includes(b.status)),
    },
    upcoming: {
      requests: [],
      jobs: jobList.filter((j) => j.status === 'scheduled'),
      bookings: (bookings ?? []).filter((b) => ['requested', 'confirmed'].includes(b.status)),
    },
    completed: {
      requests: (requests ?? []).filter((r) => r.status === 'cancelled'),
      jobs: jobList.filter((j) => j.status === 'completed' || j.status === 'cancelled'),
      bookings: (bookings ?? []).filter((b) => ['completed', 'cancelled', 'declined'].includes(b.status)),
    },
  };
  const count = (key: Tab) => group[key].requests.length + group[key].jobs.length + group[key].bookings.length;
  const shown = group[tab];

  return (
    <Screen header={<PageHeader title={t('tabs.bookings')} />}>
      <FilterChips<Tab>
        value={tab}
        onChange={setTab}
        options={(['active', 'upcoming', 'completed'] as const).map((value) => ({ value, label: t(`bookings.${value}`), count: client ? count(value) : undefined }))}
      />
      {!client ? (
        <StateView state="empty" title={t('history.signIn')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'client' } })} />
      ) : loading ? (
        <StateView state="loading" />
      ) : count(tab) === 0 ? (
        <StateView state="empty" title={t(`bookings.empty_${tab}`)} action={t('home2.find')} onAction={() => router.push('/search')} />
      ) : (
        <>
          {shown.requests.map((r) => (
            <ListRow
              key={r.id}
              icon="bullhorn-outline"
              title={names.shortRoute(r.from, r.to)}
              subtitle={`${t(`requestStatus.${r.status}`)} · ${dates.dayTime(new Date(r.createdAt))}`}
              value={formatMoney(t, r.price)}
              onPress={() => router.push({ pathname: '/track/[id]', params: { id: r.id } })}
            />
          ))}
          {shown.jobs.map((j) => (
            <ListRow
              key={j.id}
              icon="truck-fast-outline"
              title={names.shortRoute(j.from, j.to)}
              subtitle={`${t(`status.${j.status}`)} · ${j.driverName}`}
              value={formatMoney(t, j.price)}
              onPress={() => router.push({ pathname: '/track/[id]', params: { id: j.requestId } })}
            />
          ))}
          {shown.bookings.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </>
      )}
    </Screen>
  );
}
