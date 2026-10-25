import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { advanceJob, cancelJob, moveDriver, rateJob, sendMessage } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { FreightRequest, Job, JobStatus } from '@/backend/types';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { Avatar, ChatBox, ConfirmModal, JobTimeline, RatingCard, StatusBanner } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { formatMoney } from '@/components/money';
import { describePlace, ITEM_OPTIONS } from '@/components/request/access-options';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { getCity, type CityId } from '@/constants/cities';
import { watchPosition } from '@/lib/location';
import { commissionSplit } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { arrived, canCancel, nextStatus, remaining, simulatedStart, simulateStep, targetFor } from '@/lib/trip';
import { useDriver } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const TICK_MS = 2000;

/** Big button label for moving the trip to its next step. */
const NEXT_ACTION: Partial<Record<JobStatus, string>> = {
  toPickup: 'job.arrivedPickup',
  atPickup: 'job.startLoading',
  loading: 'job.startTrip',
  inTransit: 'job.arrivedDropoff',
  atDropoff: 'job.delivered',
};

/** The driver's live view of an accepted job: navigation, steps, client contact, then rating. */
export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const job = useDoc('jobs', id);
  const request = useDoc('requests', job?.requestId ?? null);
  if (job === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (job === null) return <Screen>{null}</Screen>;
  return <JobView job={job} request={request ?? null} />;
}

/**
 * Keeps the driver's position up to date on the job while heading somewhere:
 * real GPS on phones, or a test simulation that drives toward the target.
 */
function useDriverTracking(job: Job, simulate: boolean, homeCity: CityId | undefined) {
  const store = useStore();
  const target = targetFor(job.status, job.from, job.to);
  const position = useRef(job.driverPos);
  useEffect(() => {
    position.current = job.driverPos;
  }, [job.driverPos]);

  // Start position once, so the client sees the driver straight away.
  useEffect(() => {
    if (job.driverPos || !simulate) return;
    const home = homeCity ? getCity(homeCity) : job.from;
    moveDriver(store, job.id, simulatedStart(job.from, home), true).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, simulate]);

  // Simulated drive toward the current target.
  useEffect(() => {
    if (!simulate || !target) return;
    const legStart = position.current ?? job.from;
    const legKm = remaining(legStart, target).km;
    const timer = setInterval(() => {
      const current = position.current;
      if (!current || arrived(current, target)) return;
      const next = simulateStep(current, target, legKm, TICK_MS / 1000);
      position.current = next;
      moveDriver(store, job.id, next, true).catch(() => {});
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, job.status, job.id]);

  // Real GPS on phones.
  useEffect(() => {
    if (simulate || job.status === 'completed' || job.status === 'cancelled') return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let lastWrite = 0;
    watchPosition((point) => {
      if (Date.now() - lastWrite < 4000) return;
      lastWrite = Date.now();
      moveDriver(store, job.id, point, false).catch(() => {});
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe?.();
      else stop = unsubscribe;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [simulate, job.status, job.id, store]);
}

function JobView({ job, request }: { job: Job; request: FreightRequest | null }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const { profile } = useDriver();
  const { record } = useDriverRecord();
  const messages = useQuery('messages', [['jobId', job.id]]);
  // Phones use real GPS; the browser preview can't, so it simulates the drive.
  const [simulate, setSimulate] = useState(Platform.OS === 'web');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = job.status !== 'completed' && job.status !== 'cancelled';

  useDriverTracking(job, simulate && active, profile.vehicle?.homeCity);

  const target = targetFor(job.status, job.from, job.to);
  const left = job.driverPos && target ? remaining(job.driverPos, target) : null;
  const atTarget = !!(job.driverPos && target && arrived(job.driverPos, target));
  const next = nextStatus(job.status);
  const { driverKeeps } = commissionSplit(job.price);

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    try {
      await advanceJob(store, job, next);
      play(next === 'delivered' ? 'complete' : 'step');
    } finally {
      setBusy(false);
    }
  };

  const heading =
    job.status === 'toPickup'
      ? { title: t('job.toPickupTitle'), body: left ? t('job.distanceLeft', { km: left.km, minutes: left.minutes }) : t('track.waitingGps') }
      : job.status === 'inTransit'
        ? { title: t('job.toDropoffTitle'), body: left ? t('job.distanceLeft', { km: left.km, minutes: left.minutes }) : undefined }
        : job.status === 'delivered'
          ? { title: t('job.waitingConfirm'), body: t('job.waitingConfirmBody', { name: job.clientName }) }
          : job.status === 'completed'
            ? { title: t('job.completedTitle'), body: t('job.earned', { amount: formatMoney(t, driverKeeps) }) }
            : job.status === 'cancelled'
              ? { title: t('track.jobCancelled'), body: t(job.cancelledBy === 'client' ? 'job.clientCancelledBody' : 'job.youCancelledBody') }
              : { title: t(`status.${job.status}`), body: names.label(job.status === 'atDropoff' ? job.to : job.from) };

  return (
    <Screen
      footer={
        active && next ? (
          <Button
            title={busy ? t('login.sending') : t(NEXT_ACTION[job.status] ?? 'job.next')}
            variant={atTarget || !target ? 'accent' : 'primary'}
            icon="checkmark-circle-outline"
            sound={null}
            disabled={busy}
            onPress={advance}
          />
        ) : undefined
      }>
      <View style={styles.header}>
        <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.replace('/driver')} />
        <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={1}>
          {names.cityRoute(job.from, job.to)}
        </Text>
      </View>

      <StatusBanner
        icon={job.status === 'completed' ? 'party-popper' : job.status === 'cancelled' ? 'close-circle-outline' : 'navigation-variant'}
        title={heading.title}
        body={heading.body}
        tone={job.status === 'cancelled' ? 'accent' : job.status === 'completed' || job.status === 'delivered' ? 'success' : 'primary'}
      />

      {active && (
        <FreightMap
          height={260}
          markers={[
            { id: 'from', kind: 'pickup', lat: job.from.lat, lng: job.from.lng },
            { id: 'to', kind: 'dropoff', lat: job.to.lat, lng: job.to.lng },
            ...(job.driverPos ? [{ id: 'me', kind: 'driver' as const, lat: job.driverPos.lat, lng: job.driverPos.lng }] : []),
          ]}
          route={[job.from, job.to]}
          approach={job.status === 'toPickup' && job.driverPos ? [job.driverPos, job.from] : undefined}
          focus={job.driverPos && target ? [job.driverPos, target] : [job.from, job.to]}
          focusKey={`${job.id}:${job.status}:${!!job.driverPos}`}
        />
      )}

      {active && (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: simulate }}
          onPress={() => {
            play('tap');
            setSimulate(!simulate);
          }}
          style={[styles.simulate, { backgroundColor: simulate ? colors.accentSoft : colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={simulate ? 'flask' : 'crosshairs-gps'} size={18} color={simulate ? colors.accent : colors.primary} />
          <Text variant="caption" color={simulate ? colors.accent : colors.text} style={{ flex: 1 }}>
            {simulate ? t('job.simulating') : t('job.realGps')}
          </Text>
          <Text variant="caption" color={colors.primary}>
            {simulate ? t('job.useGps') : t('job.useSimulation')}
          </Text>
        </Pressable>
      )}

      {job.status === 'completed' && (
        <Card>
          <Text variant="label">{t('job.earnings')}</Text>
          <Row label={t('job.tripPrice')} value={formatMoney(t, job.price)} />
          <Row label={t('job.commission')} value={`− ${formatMoney(t, job.commission)}`} />
          <Row label={t('job.youKeep')} value={formatMoney(t, driverKeeps)} strong />
          {record && <Row label={t('wallet.balance')} value={formatMoney(t, record.wallet)} />}
        </Card>
      )}
      {job.status === 'completed' && !job.driverRating && (
        <RatingCard about="client" name={job.clientName} onSubmit={(rating) => rateJob(store, job, 'driver', rating)} />
      )}
      {(job.status === 'completed' || job.status === 'cancelled') && (
        <Button title={t('job.findLoads')} icon="search" onPress={() => router.replace('/driver')} />
      )}

      <Card>
        <View style={styles.row}>
          <Avatar name={job.clientName} />
          <View style={{ flex: 1 }}>
            <Text variant="label">{job.clientName}</Text>
            <Text variant="caption" muted>
              {t('job.clientPays', { price: formatMoney(t, job.price) })}
            </Text>
          </View>
        </View>
        <View style={[styles.phone, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <Text variant="label" selectable style={{ writingDirection: 'ltr' }}>
            {job.clientPhone}
          </Text>
        </View>
        <Place icon="arrow-up-circle-outline" title={t('request.atPickup')} value={names.label(job.from)} detail={request ? [request.fromDetails, describePlace(t, request.pickup)] : []} />
        <Place icon="arrow-down-circle-outline" title={t('request.atDropoff')} value={names.label(job.to)} detail={request ? [request.toDetails, describePlace(t, request.dropoff)] : []} />
        {request && request.itemOptions.length > 0 && (
          <View style={styles.tags}>
            {ITEM_OPTIONS.filter((option) => request.itemOptions.includes(option.id)).map((option) => (
              <View key={option.id} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name={option.icon} size={14} color={colors.accent} />
                <Text variant="caption" color={colors.accent}>
                  {t(option.key)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {request && request.helpers > 0 && (
          <Text variant="caption" muted>
            {t('driver.helpers', { count: request.helpers })}
          </Text>
        )}
        {!!request?.notes && <Text muted>{request.notes}</Text>}
      </Card>

      {active && <ChatBox me="driver" messages={messages ?? []} onSend={(text) => sendMessage(store, job.id, 'driver', text)} />}

      <JobTimeline job={job} />

      {canCancel(job.status) && (
        <>
          <Button title={t('job.cancel')} variant="ghost" onPress={() => setConfirmCancel(true)} />
          <ConfirmModal
            visible={confirmCancel}
            title={t('job.cancelTitle')}
            body={t('job.cancelBody', { price: formatMoney(t, job.price), commission: formatMoney(t, job.commission) })}
            keep={t('job.keepJob')}
            confirm={t('job.cancelConfirm')}
            onClose={() => setConfirmCancel(false)}
            onConfirm={() => {
              setConfirmCancel(false);
              cancelJob(store, job, 'driver');
            }}
          />
        </>
      )}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <Text muted={!strong} variant={strong ? 'label' : 'body'}>
        {label}
      </Text>
      <Text variant={strong ? 'subtitle' : 'label'} color={strong ? colors.success : colors.text}>
        {value}
      </Text>
    </View>
  );
}

function Place({ icon, title, value, detail }: { icon: 'arrow-up-circle-outline' | 'arrow-down-circle-outline'; title: string; value: string; detail: string[] }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {title}
        </Text>
        <Text variant="label">{value}</Text>
        {detail.filter(Boolean).map((line) => (
          <Text key={line} variant="caption" muted>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  simulate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  phone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
