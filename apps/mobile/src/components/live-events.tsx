import { router, usePathname } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { markReminders, normalizeJob, postEvent } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { Job, JobStatus } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { useToast, type ToastMessage } from '@/components/toast';
import { cancelReminders, scheduleReminders } from '@/lib/notify';
import { fromLocalString } from '@/lib/schedule';
import { dueReminder } from '@/lib/trip';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';

type Side = 'client' | 'driver';

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

const open = (job: Job, side: Side) =>
  side === 'client'
    ? () => router.push({ pathname: '/track/[id]', params: { id: job.requestId } })
    : () => router.push({ pathname: '/job/[id]', params: { id: job.id } });

/** Client-side messages when the trip moves forward. */
const CLIENT_JOB_EVENTS: Partial<Record<JobStatus, Omit<ToastMessage, 'onPress' | 'title'> & { key: string }>> = {
  toPickup: { key: 'live.driverStarted', icon: 'truck-fast', sound: 'step' },
  atPickup: { key: 'live.driverArrived', icon: 'map-marker-check', tone: 'success', sound: 'success' },
  inTransit: { key: 'live.inTransit', icon: 'truck-delivery', sound: 'step' },
  atDropoff: { key: 'live.atDropoff', icon: 'flag-checkered', sound: 'step' },
  delivered: { key: 'live.delivered', icon: 'check-decagram', tone: 'success', sound: 'complete' },
  completed: { key: 'live.completed', icon: 'party-popper', tone: 'success', sound: 'complete' },
  cancelled: { key: 'live.jobCancelled', icon: 'close-circle-outline', tone: 'accent', sound: 'error' },
};

/**
 * Turns live database changes into notifications for the current role: offers, trip
 * progress, chat messages and booking reminders. On phones, booking reminders are also
 * scheduled as system notifications so they arrive when the app is closed.
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
  const dates = useDateFormat();
  const offers = useQuery('offers', [['clientId', clientId]]);
  const rawJobs = useQuery('jobs', [['clientId', clientId]]);
  const jobs = rawJobs?.map(normalizeJob);

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
    (job) => job.status,
    (job, before) => {
      if (!before && job.status === 'scheduled') {
        toast({
          title: t('live.bookingConfirmedClient', { at: dates.pickupAt(job.scheduledAt!) }),
          body: t('live.bookingConfirmedClientBody', { name: job.driverName }),
          icon: 'calendar-check',
          tone: 'success',
          sound: 'success',
          onPress: open(job, 'client'),
        });
        return;
      }
      if (!before) return; // The client just accepted this offer on this screen.
      const event = CLIENT_JOB_EVENTS[job.status];
      if (!event || (job.status === 'cancelled' && job.cancelledBy === 'client')) return;
      toast({ ...event, title: t(event.key, { name: job.driverName }), onPress: open(job, 'client') });
    },
  );

  return (
    <>
      {(jobs ?? [])
        .filter((job) => job.status !== 'completed' && job.status !== 'cancelled')
        .map((job) => (
          <JobWatch key={job.id} job={job} side="client" />
        ))}
    </>
  );
}

function DriverEvents({ driverId }: { driverId: string | undefined }) {
  const { t } = useTranslation();
  const toast = useToast();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const open_ = useQuery('requests', [['status', 'open']]);
  const offers = useQuery('offers', driverId ? [['driverId', driverId]] : null);
  const rawJobs = useQuery('jobs', driverId ? [['driverId', driverId]] : null);
  const jobs = rawJobs?.map(normalizeJob);

  useChanges(
    open_,
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
      if (offer.status === 'declined') toast({ title: t('live.offerDeclined'), icon: 'close-circle-outline', tone: 'accent', sound: 'error' });
    },
  );

  useChanges(
    jobs,
    (job) => job.status,
    (job, before) => {
      if (!before) {
        // A new job means the client accepted this driver's offer.
        toast(
          job.status === 'scheduled'
            ? {
                title: t('live.bookingConfirmedDriver', { at: dates.pickupAt(job.scheduledAt!) }),
                body: t('live.bookingConfirmedDriverBody'),
                icon: 'calendar-check',
                tone: 'success',
                sound: 'success',
                onPress: open(job, 'driver'),
              }
            : {
                title: t('live.offerAccepted'),
                body: t('live.offerAcceptedBody', { price: formatMoney(t, job.price) }),
                icon: 'check-decagram',
                tone: 'success',
                sound: 'success',
                onPress: open(job, 'driver'),
              },
        );
      } else if (job.status === 'completed') {
        toast({ title: t('live.clientConfirmed'), icon: 'party-popper', tone: 'success', sound: 'complete', onPress: open(job, 'driver') });
      } else if (job.status === 'cancelled' && job.cancelledBy === 'client') {
        toast({ title: t('live.clientCancelled'), icon: 'close-circle-outline', tone: 'accent', sound: 'error' });
      }
    },
  );

  return (
    <>
      {(jobs ?? [])
        .filter((job) => job.status !== 'completed' && job.status !== 'cancelled')
        .map((job) => (
          <JobWatch key={job.id} job={job} side="driver" />
        ))}
    </>
  );
}

const REMINDER_ICONS = { day: 'calendar-clock', twoHours: 'clock-outline', leave: 'truck-fast', late: 'clock-alert-outline' } as const;

/** Per active job: new chat messages from the other side and booking reminders. */
function JobWatch({ job, side }: { job: Job; side: Side }) {
  const { t } = useTranslation();
  const toast = useToast();
  const store = useStore();
  const dates = useDateFormat();
  const pathname = usePathname();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const other = side === 'client' ? job.driverName : job.clientName;
  const latest = useRef(job);
  useEffect(() => {
    latest.current = job;
  }, [job]);

  useChanges(
    messages,
    () => 'seen',
    (message, before) => {
      if (before || message.from === side || message.from === 'system') return;
      if (pathname === `/chat/${job.id}`) return;
      toast({
        title: t('live.newMessage', { name: other }),
        body: message.kind === 'text' ? message.text : message.kind === 'location' ? t('chat.sharedLocation') : t('chat.sharedPhoto'),
        icon: 'chat-processing-outline',
        sound: 'offer',
        onPress: () => router.push({ pathname: '/chat/[id]', params: { id: job.id } }),
      });
    },
  );

  // In-app reminders for scheduled bookings, checked every 20 seconds.
  const remind = useEffectEvent(() => {
    const current = latest.current;
    if (!current.scheduledAt || (current.status !== 'scheduled' && current.status !== 'toPickup')) return;
    const at = fromLocalString(current.scheduledAt).getTime();
    const { show, markSent } = dueReminder(at, Date.now(), current.remindersSent, side, current.status !== 'scheduled');
    if (!markSent.length) return;
    markReminders(store, current, markSent).catch(() => {});
    if (!show) return;
    if (show === 'late' && side === 'client') postEvent(store, current.id, 'late').catch(() => {});
    toast({
      title: t(`reminder.${side}.${show}.title`, { at: dates.pickupAt(current.scheduledAt), name: other }),
      body: t(`reminder.${side}.${show}.body`, { name: other }),
      icon: REMINDER_ICONS[show],
      tone: show === 'late' ? 'accent' : 'primary',
      sound: show === 'late' ? 'error' : 'offer',
      onPress: open(current, side),
    });
  });
  useEffect(() => {
    remind();
    const timer = setInterval(remind, 20_000);
    return () => clearInterval(timer);
  }, []);

  // Phone notifications for the same reminders, so they arrive with the app closed.
  const scheduledKey = job.status === 'scheduled' ? job.scheduledAt : null;
  const schedule = useEffectEvent((key: string | null) => {
    if (!key) {
      cancelReminders(job.id);
      return;
    }
    const at = fromLocalString(key).getTime();
    const ids = side === 'driver' ? (['day', 'twoHours', 'leave', 'late'] as const) : (['day', 'twoHours', 'late'] as const);
    const offsets = { day: -24 * 3_600_000, twoHours: -2 * 3_600_000, leave: -45 * 60_000, late: 10 * 60_000 };
    scheduleReminders(
      job.id,
      ids.map((id) => ({
        id,
        at: at + offsets[id],
        title: t(`reminder.${side}.${id}.title`, { at: dates.pickupAt(key), name: other }),
        body: t(`reminder.${side}.${id}.body`, { name: other }),
      })),
    );
  });
  useEffect(() => {
    schedule(scheduledKey);
  }, [scheduledKey]);

  return null;
}
