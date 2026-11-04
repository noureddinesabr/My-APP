import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@/backend';
import { normalizeJob } from '@/backend/actions';
import { LoadCard } from '@/components/driver/load-card';
import { useDateFormat } from '@/components/date-format';
import { FilterChips, ListRow, PageHeader, StateView } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { BookingCard } from '@/components/route-cards';
import { Screen } from '@/components/ui';
import { maxTons } from '@/lib/pricing';
import { useAccount } from '@/state/account';
import { useDriver } from '@/state/driver';

type Tab = 'available' | 'pending' | 'accepted' | 'active' | 'completed';

/**
 * Jobs tab (Doc 5 D24–D33): available customer requests, the driver's pending offers and
 * route-booking requests, accepted bookings, trips under way and completed trips — each item
 * opens its own screen (offer, job, or route booking) in one tap.
 */
export default function DriverJobs() {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { driver } = useAccount();
  const { profile } = useDriver();
  const [tab, setTab] = useState<Tab>('available');
  const open = useQuery('requests', [['status', 'open']]);
  const offers = useQuery('offers', driver ? [['driverId', driver.id]] : null);
  const rawJobs = useQuery('jobs', driver ? [['driverId', driver.id]] : null);
  const bookings = useQuery('bookings', driver ? [['driverId', driver.id]] : null);
  const jobs = (rawJobs ?? []).map(normalizeJob);
  const capacity = profile.vehicle ? maxTons(profile.vehicle.type) : Infinity;
  const offered = new Set((offers ?? []).filter((o) => o.status === 'pending').map((o) => o.requestId));

  const lists = {
    available: (open ?? []).filter((r) => r.clientId !== driver?.id && !offered.has(r.id)),
    pendingOffers: (offers ?? []).filter((o) => o.status === 'pending'),
    pendingBookings: (bookings ?? []).filter((b) => b.status === 'requested' || b.status === 'awaitingOriginal'),
    acceptedJobs: jobs.filter((j) => j.status === 'scheduled'),
    acceptedBookings: (bookings ?? []).filter((b) => b.status === 'confirmed'),
    activeJobs: jobs.filter((j) => !['scheduled', 'completed', 'cancelled'].includes(j.status)),
    activeBookings: (bookings ?? []).filter((b) => b.status === 'inTransit' || b.status === 'delivered'),
    doneJobs: jobs.filter((j) => j.status === 'completed' || j.status === 'cancelled'),
    doneBookings: (bookings ?? []).filter((b) => b.status === 'completed' || b.status === 'cancelled' || b.status === 'declined'),
  };
  const counts: Record<Tab, number> = {
    available: lists.available.length,
    pending: lists.pendingOffers.length + lists.pendingBookings.length,
    accepted: lists.acceptedJobs.length + lists.acceptedBookings.length,
    active: lists.activeJobs.length + lists.activeBookings.length,
    completed: lists.doneJobs.length + lists.doneBookings.length,
  };
  const jobRow = (j: (typeof jobs)[number]) => (
    <ListRow
      key={j.id}
      icon="truck-fast-outline"
      title={names.shortRoute(j.from, j.to)}
      subtitle={`${t(`status.${j.status}`)} · ${j.clientName}${j.scheduledAt ? ` · ${dates.pickupShort(j.scheduledAt)}` : ''}`}
      value={formatMoney(t, j.price)}
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })}
    />
  );
  const bookingRow = (b: (typeof lists.pendingBookings)[number]) => <BookingCard key={b.id} booking={b} driverView onPress={() => router.push({ pathname: '/route/[id]', params: { id: b.routeId } })} />;

  return (
    <Screen header={<PageHeader title={t('tabs.jobs')} />}>
      <FilterChips<Tab> value={tab} onChange={setTab} options={(['available', 'pending', 'accepted', 'active', 'completed'] as const).map((value) => ({ value, label: t(`jobs.${value}`), count: counts[value] }))} />
      {!driver ? (
        <StateView state="empty" title={t('driver.signInTitle')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
      ) : open === undefined || rawJobs === undefined ? (
        <StateView state="loading" />
      ) : counts[tab] === 0 ? (
        <StateView state="empty" title={t(`jobs.empty_${tab}`)} />
      ) : (
        <>
          {tab === 'available' && lists.available.map((r) => <LoadCard key={r.id} load={r} fits={r.weightKnown === false || r.tons <= capacity} offered={false} />)}
          {tab === 'pending' && (
            <>
              {lists.pendingBookings.map(bookingRow)}
              {lists.pendingOffers.map((o) => (
                <ListRow key={o.id} icon="hand-coin-outline" title={t('jobs.offerSent', { price: formatMoney(t, o.price) })} subtitle={dates.dayTime(new Date(o.createdAt))} onPress={() => router.push({ pathname: '/load/[id]', params: { id: o.requestId } })} />
              ))}
            </>
          )}
          {tab === 'accepted' && (
            <>
              {lists.acceptedBookings.map(bookingRow)}
              {lists.acceptedJobs.map(jobRow)}
            </>
          )}
          {tab === 'active' && (
            <>
              {lists.activeBookings.map(bookingRow)}
              {lists.activeJobs.map(jobRow)}
            </>
          )}
          {tab === 'completed' && (
            <>
              {lists.doneBookings.map(bookingRow)}
              {lists.doneJobs.map(jobRow)}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
