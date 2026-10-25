import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@/backend';
import type { Job, JobStatus } from '@/backend/types';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { useToast, type ToastMessage } from '@/components/toast';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';

/** Remembers what was already seen so only real changes notify (never the first load). */
function useChanges<T extends { id: string }>(items: T[] | undefined, key: (item: T) => string, onChange: (item: T, before: string | undefined) => void) {
  const seen = useRef<Map<string, string> | null>(null);
  const handle = useEffectEvent(onChange);
  useEffect(() => {
    if (!items) return;
    const previous = seen.current;
    const next = new Map(items.map((item) => [item.id, key(item)]));
    if (previous) {
      for (const item of items) {
        const before = previous.get(item.id);
        if (before !== key(item)) handle(item, before);
      }
    }
    seen.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}

/** Client-side messages when the driver moves the trip forward. */
const CLIENT_JOB_EVENTS: Partial<Record<JobStatus, Omit<ToastMessage, 'onPress' | 'title'> & { key: string }>> = {
  atPickup: { key: 'live.driverArrived', icon: 'map-marker-check', tone: 'success', sound: 'success' },
  loading: { key: 'live.loading', icon: 'package-variant', sound: 'step' },
  inTransit: { key: 'live.inTransit', icon: 'truck-fast', sound: 'step' },
  atDropoff: { key: 'live.atDropoff', icon: 'flag-checkered', sound: 'step' },
  delivered: { key: 'live.delivered', icon: 'check-decagram', tone: 'success', sound: 'complete' },
  cancelled: { key: 'live.jobCancelled', icon: 'close-circle-outline', tone: 'accent', sound: 'error' },
};

/**
 * Turns live database changes into notifications for the current role:
 * new offers and trip progress for clients, new requests and offer answers for drivers.
 */
export function LiveEvents() {
  const { role } = useRole();
  const { client, driver } = useAccount();
  const clientId = role === 'client' ? client?.id : undefined;
  const driverId = role === 'driver' ? driver?.id : undefined;
  return (
    <>
      {clientId && <ClientEvents clientId={clientId} />}
      {role === 'driver' && <DriverEvents driverId={driverId} />}
    </>
  );
}

function ClientEvents({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const offers = useQuery('offers', [['clientId', clientId]]);
  const jobs = useQuery('jobs', [['clientId', clientId]]);

  useChanges(
    offers,
    (offer) => `${offer.status}:${offer.price}`,
    (offer, before) => {
      if (offer.status !== 'pending') return;
      toast({
        title: t(before ? 'live.offerUpdated' : 'live.newOffer', { price: formatMoney(t, offer.price) }),
        body: `${offer.driverName} · ${t(`vehicle.${offer.vehicle}`)} · ★ ${offer.rating.toFixed(1)}`,
        icon: 'hand-coin-outline',
        sound: 'offer',
        onPress: () => router.push({ pathname: '/track/[id]', params: { id: offer.requestId } }),
      });
    },
  );

  useChanges(
    jobs,
    (job: Job) => job.status,
    (job) => {
      const event = CLIENT_JOB_EVENTS[job.status];
      if (!event || (job.status === 'cancelled' && job.cancelledBy === 'client')) return;
      toast({
        ...event,
        title: t(event.key, { name: job.driverName }),
        onPress: () => router.push({ pathname: '/track/[id]', params: { id: job.requestId } }),
      });
    },
  );
  return null;
}

function DriverEvents({ driverId }: { driverId: string | undefined }) {
  const { t } = useTranslation();
  const toast = useToast();
  const names = useLocationLabel();
  const open = useQuery('requests', [['status', 'open']]);
  const offers = useQuery('offers', driverId ? [['driverId', driverId]] : null);
  const jobs = useQuery('jobs', driverId ? [['driverId', driverId]] : null);

  useChanges(
    open,
    () => 'open',
    (request, before) => {
      if (before) return;
      toast({
        title: t('live.newRequest', { price: formatMoney(t, request.price) }),
        body: names.cityRoute(request.from, request.to),
        icon: 'package-variant-closed',
        sound: 'offer',
        onPress: () => router.push({ pathname: '/load/[id]', params: { id: request.id } }),
      });
    },
  );

  useChanges(
    offers,
    (offer) => offer.status,
    (offer) => {
      if (offer.status === 'accepted') {
        toast({
          title: t('live.offerAccepted'),
          body: t('live.offerAcceptedBody', { price: formatMoney(t, offer.price) }),
          icon: 'check-decagram',
          tone: 'success',
          sound: 'success',
          onPress: () => router.push('/driver'),
        });
      } else if (offer.status === 'declined') {
        toast({ title: t('live.offerDeclined'), icon: 'close-circle-outline', tone: 'accent', sound: 'error' });
      }
    },
  );

  useChanges(
    jobs,
    (job) => job.status,
    (job) => {
      if (job.status === 'completed') {
        toast({ title: t('live.clientConfirmed'), icon: 'party-popper', tone: 'success', sound: 'complete' });
      } else if (job.status === 'cancelled' && job.cancelledBy === 'client') {
        toast({ title: t('live.clientCancelled'), icon: 'close-circle-outline', tone: 'accent', sound: 'error' });
      }
    },
  );
  return null;
}
