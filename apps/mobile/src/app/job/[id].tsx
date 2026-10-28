import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { advanceJob, cancelJob, deliverWithCode, moveDriver, normalizeJob, rateJob, testReschedule } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { FreightRequest, Job, JobStatus } from '@/backend/types';
import { ContactButtons } from '@/components/contact-buttons';
import { useDateFormat } from '@/components/date-format';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { Avatar, ConfirmSheet, RatingCard } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { QuestScreen } from '@/components/motion/quest';
import { formatMoney } from '@/components/money';
import { describePlace, ITEM_OPTIONS } from '@/components/request/access-options';
import { SwipeButton } from '@/components/swipe-button';
import { ExternalLink } from '@/components/external-link';
import { LoadAttachments } from '@/components/media/load-attachments';
import { Text } from '@/components/text';
import { Celebration, useBecameTrue } from '@/components/motion/celebration';
import { CountUp } from '@/components/motion/effects';
import { PressableScale } from '@/components/motion/pressable-scale';
import { BRAND } from '@/constants/brands';
import { TextInput } from '@/components/text-input';
import { Button, ForwardChevron, Screen } from '@/components/ui';
import { getCity, type CityId } from '@/constants/cities';
import { watchPosition } from '@/lib/location';
import { commissionSplit } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import {
  autoStatus,
  canCancel,
  isLateCancel,
  reliability,
  remaining,
  simulatedStart,
  simulateStep,
  simulationTarget,
  targetFor,
} from '@/lib/trip';
import { useDriver } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const TICK_MS = 2000;

/** The driver's live view of an accepted job: automatic steps from GPS, few taps. */
export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const raw = useDoc('jobs', id);
  const request = useDoc('requests', raw?.requestId ?? null);
  if (raw === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (raw === null) return <Screen>{null}</Screen>;
  return <JobView job={normalizeJob(raw)} request={request ?? null} />;
}

/**
 * Follows the driver's position while the trip is on: real GPS on phones, or a test
 * simulation. Each position can move the trip forward on its own (arrived, left, at drop-off).
 */
function useDriverTracking(job: Job, simulate: boolean, homeCity: CityId | undefined) {
  const store = useStore();
  const latest = useRef(job);
  const advancing = useRef<JobStatus | null>(null);
  useEffect(() => {
    latest.current = job;
  }, [job]);
  const moving = job.status !== 'scheduled' && job.status !== 'delivered' && job.status !== 'completed' && job.status !== 'cancelled';

  // GPS decides the steps: arrived at pickup, left with the load, arrived at drop-off.
  useEffect(() => {
    if (!moving || !job.driverPos) return;
    const next = autoStatus(job.status, job.driverPos, job.from, job.to);
    if (next && advancing.current !== next) {
      advancing.current = next;
      play(next === 'atDropoff' || next === 'atPickup' ? 'success' : 'step');
      advanceJob(store, job, next).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.driverPos?.lat, job.driverPos?.lng, job.status]);

  // Test simulation: drives to the pickup, waits there to "load", then drives to the drop-off.
  useEffect(() => {
    if (!simulate || !moving) return;
    if (!latest.current.driverPos) {
      const home = homeCity ? getCity(homeCity) : job.from;
      moveDriver(store, job.id, simulatedStart(job.from, home), true).catch(() => {});
    }
    let legKm = 0;
    const timer = setInterval(() => {
      const current = latest.current;
      const position = current.driverPos;
      const target = simulationTarget(
        current.status,
        current.from,
        current.to,
        current.timeline.atPickup ?? current.timeline.loading,
        Date.now(),
      );
      if (!position || !target) return;
      if (!legKm) legKm = remaining(position, target).km;
      const next = simulateStep(position, target, legKm, TICK_MS / 1000);
      if (next.lat === position.lat && next.lng === position.lng) return;
      moveDriver(store, current.id, next, true).catch(() => {});
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, moving, job.id, job.status]);

  // Real GPS on phones.
  useEffect(() => {
    if (simulate || !moving) return;
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
  }, [simulate, moving, job.id, store]);
}

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [target]);
  return target === null ? null : target - now;
}

function JobView({ job, request }: { job: Job; request: FreightRequest | null }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { profile } = useDriver();
  const { record } = useDriverRecord();
  const { height: screen } = useWindowDimensions();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const unread = (messages ?? []).filter((message) => message.from === 'client' && message.at > job.driverReadAt).length;
  // Phones use real GPS; the browser preview can't, so it simulates the drive.
  const [simulate, setSimulate] = useState(Platform.OS === 'web');
  // Null when closed; otherwise whether this cancel counts as late (decided when opened).
  const [confirmCancel, setConfirmCancel] = useState<{ late: boolean } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const status: JobStatus = job.status === 'loading' ? 'atPickup' : job.status;
  const active = status !== 'completed' && status !== 'cancelled';
  const scheduledMs = job.scheduledAt ? fromLocalString(job.scheduledAt).getTime() : null;
  const untilPickup = useCountdown(status === 'scheduled' ? scheduledMs : null);

  useDriverTracking(job, simulate && active, profile.vehicle?.homeCity);

  const target = targetFor(status, job.from, job.to);
  const left = job.driverPos && target && status !== 'scheduled' ? remaining(job.driverPos, target) : null;
  const { driverKeeps } = commissionSplit(job.price);
  const delivered = useBecameTrue(status === 'completed');

  const start = () => {
    play('send');
    advanceJob(store, job, 'toPickup').catch(() => {});
  };

  const deliver = async () => {
    const ok = await deliverWithCode(store, job, code);
    if (ok) play('complete');
    else {
      play('error');
      setCodeError(true);
    }
  };

  const navUrl = (point: { lat: number; lng: number }, app: 'waze' | 'google') =>
    app === 'waze'
      ? `https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;

  const countdown =
    untilPickup === null
      ? ''
      : untilPickup <= 0
        ? t('job.pickupNow')
        : untilPickup < 3_600_000
          ? t('job.inMinutes', { minutes: Math.ceil(untilPickup / 60_000) })
          : t('job.inHours', { hours: Math.floor(untilPickup / 3_600_000), minutes: Math.floor((untilPickup % 3_600_000) / 60_000) });

  const heading: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body?: string } =
    status === 'scheduled'
      ? { icon: 'calendar-clock', title: t('job.bookedFor', { at: dates.pickupAt(job.scheduledAt!) }), body: countdown }
      : status === 'toPickup'
        ? {
            icon: 'navigation-variant',
            title: t('job.toPickupTitle'),
            body: left ? t('job.distanceLeft', { km: left.km, minutes: left.minutes }) : t('track.waitingGps'),
          }
        : status === 'atPickup'
          ? { icon: 'package-variant', title: t('job.atPickupTitle'), body: t('job.atPickupBody') }
          : status === 'inTransit'
            ? {
                icon: 'truck-delivery',
                title: t('job.toDropoffTitle'),
                body: left ? t('job.distanceLeft', { km: left.km, minutes: left.minutes }) : undefined,
              }
            : status === 'atDropoff'
              ? { icon: 'flag-checkered', title: t('job.atDropoffTitle'), body: t('job.atDropoffBody') }
              : status === 'delivered'
                ? { icon: 'timer-sand', title: t('job.waitingConfirm'), body: t('job.waitingConfirmBody', { name: job.clientName }) }
                : status === 'completed'
                  ? { icon: 'party-popper', title: t('job.completedTitle'), body: t('job.earned', { amount: formatMoney(t, driverKeeps) }) }
                  : {
                      icon: 'close-circle-outline',
                      title: t('track.jobCancelled'),
                      body: t(job.cancelledBy === 'client' ? 'job.clientCancelledBody' : 'job.youCancelledBody'),
                    };

  const footer =
    status === 'scheduled' ? (
      <SwipeButton label={t('job.slideStart')} onConfirm={start} variant="primary" />
    ) : status === 'atDropoff' || status === 'inTransit' ? (
      <View style={{ gap: Spacing.sm }}>
        <View style={styles.codeRow}>
          <MaterialCommunityIcons name="shield-key-outline" size={22} color={colors.primary} />
          <TextInput
            value={code}
            onChangeText={(value) => {
              setCodeError(false);
              setCode(value.replace(/\D/g, '').slice(0, 4));
            }}
            placeholder={t('job.codePlaceholder')}
            keyboardType="number-pad"
            accessibilityLabel={t('job.codePlaceholder')}
            style={[styles.code, !!code && styles.codeFilled, codeError && { borderWidth: 2, borderColor: colors.accent }]}
          />
        </View>
        {codeError && (
          <Text variant="caption" color={colors.accent} center>
            {t('job.wrongCode')}
          </Text>
        )}
        <SwipeButton label={t('job.slideDeliver')} onConfirm={deliver} disabled={code.length !== 4} />
      </View>
    ) : undefined;

  // Like the client's screens: the map on top all the time, and under it one page at a time.
  const hasLoadInfo = !!request && (request.itemOptions.length > 0 || request.helpers > 0 || !!request.notes || !!request.voiceNote || (request.media?.length ?? 0) > 0);
  const pages = [
    'now',
    ...(status === 'scheduled' ? ['booking'] : []),
    ...(status === 'completed' ? ['earnings'] : []),
    'client',
    'places',
    ...(hasLoadInfo ? ['load'] : []),
  ] as const;
  const [page, setPage] = useState(0);
  const current = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;
  const leave = () => router.replace('/driver');
  const pageFooter =
    current === 'now' && footer ? footer : !last ? <Button title={t('quest.next')} variant="primary" sound="whoosh" onPress={() => setPage(page + 1)} /> : undefined;

  const map = (
    <View style={{ flex: 1 }}>
      <FreightMap
        fill
        bare
        style={{ flex: 1, borderRadius: 0 }}
        inset={{ top: 96, bottom: 48 }}
        markers={[
          { id: 'from', kind: 'pickup', lat: job.from.lat, lng: job.from.lng, label: t('map.pickup') },
          { id: 'to', kind: 'dropoff', lat: job.to.lat, lng: job.to.lng, label: t('map.dropoff') },
          ...(job.driverPos && active ? [{ id: 'me', kind: 'driver' as const, lat: job.driverPos.lat, lng: job.driverPos.lng }] : []),
        ]}
        route={[job.from, job.to]}
        approach={status === 'toPickup' && job.driverPos ? [job.driverPos, job.from] : undefined}
        focus={job.driverPos && target && active && status !== 'scheduled' ? [job.driverPos, target] : [job.from, job.to]}
        focusKey={`${job.id}:${status}:${!!job.driverPos}`}
        follow={active && status !== 'scheduled' ? job.driverPos : null}
      />
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
      </View>
    </View>
  );

  return (
    <>
      <QuestScreen
        top={map}
        topHeight={Math.round(screen * (screen < 700 ? 0.4 : 0.45))}
        stepKey={current}
        progress={(page + 1) / pages.length}
        title={current === 'now' ? heading.title : t(`job.page_${current}`)}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={() => (page > 0 ? setPage(page - 1) : leave())}
        onClose={leave}
        footer={pageFooter}>
        {current === 'now' && (
          <View style={{ gap: Spacing.sm }}>
            {!!heading.body && (
              <View style={[styles.statusLine, { backgroundColor: status === 'cancelled' ? colors.accentSoft : colors.primarySoft }]}>
                <MaterialCommunityIcons name={heading.icon} size={20} color={status === 'cancelled' ? colors.accent : colors.primary} />
                <Text variant="label" color={status === 'cancelled' ? colors.accent : colors.primary} style={{ flex: 1 }}>
                  {heading.body}
                </Text>
              </View>
            )}
            {(status === 'toPickup' || status === 'inTransit') && target && (
              <View style={styles.row}>
                <NavButton label="Waze" icon="waze" color={BRAND.waze} href={navUrl(target, 'waze')} />
                <NavButton label="Google Maps" icon="google-maps" color={BRAND.googleMaps} href={navUrl(target, 'google')} />
              </View>
            )}
            {active && status !== 'scheduled' && (
              <AutoNote
                simulate={simulate}
                onToggle={() => {
                  play('tap');
                  setSimulate(!simulate);
                }}
              />
            )}
            {/* Manual fallbacks for when GPS can't tell (indoor car parks, weak signal). */}
            {status === 'toPickup' && <Fallback label={t('job.manualArrived')} onPress={() => advanceJob(store, job, 'atPickup')} />}
            {status === 'atPickup' && <Fallback label={t('job.manualLeft')} onPress={() => advanceJob(store, job, 'inTransit')} />}
            {status === 'inTransit' && <Fallback label={t('job.manualArrivedDropoff')} onPress={() => advanceJob(store, job, 'atDropoff')} />}
            {(status === 'atDropoff' || status === 'inTransit') && <Fallback label={t('job.noCode')} onPress={() => advanceJob(store, job, 'delivered')} />}
            {(status === 'completed' || status === 'cancelled') && <Button title={t('job.findLoads')} icon="search" onPress={leave} />}
            {/* The slide control takes the footer here, so the next page opens from this chip. */}
            {footer && !last && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('quest.next')}
                scaleTo={0.97}
                onPress={() => {
                  play('whoosh');
                  setPage(page + 1);
                }}
                style={[styles.nextChip, { backgroundColor: colors.primarySoft }]}>
                <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
                  {t(`job.page_${pages[page + 1]}`)}
                </Text>
                <ForwardChevron color={colors.primary} />
              </PressableScale>
            )}
          </View>
        )}
        {current === 'booking' && (
          <View style={{ gap: Spacing.sm }}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="handshake-outline" size={24} color={colors.primary} />
              <Text variant="label" style={{ flex: 1 }}>
                {t('job.commitTitle', { at: dates.pickupAt(job.scheduledAt!) })}
              </Text>
            </View>
            <Text muted>{t('job.commitBody', { reliability: record ? reliability(record.stats) : 100 })}</Text>
            <View style={styles.row}>
              <Ionicons name="notifications-outline" size={18} color={colors.textMuted} />
              <Text variant="caption" muted style={{ flex: 1 }}>
                {t('job.remindersInfo')}
              </Text>
            </View>
            <TestBox label={t('job.testSoon')} onPress={() => testReschedule(store, job, 40)} />
          </View>
        )}
        {current === 'earnings' && (
          <View style={{ gap: Spacing.xs }}>
            <Row label={t('job.tripPrice')} value={formatMoney(t, job.price)} />
            <Row label={t('job.commission')} value={`− ${formatMoney(t, job.commission)}`} />
            <View style={styles.earned}>
              <Text variant="label">{t('job.youKeep')}</Text>
              <CountUp value={driverKeeps} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.success} />
            </View>
            {record && <Row label={t('wallet.balance')} value={formatMoney(t, record.wallet)} />}
            {!job.driverRating && <RatingCard about="client" name={job.clientName} onSubmit={(rating) => rateJob(store, job, 'driver', rating)} />}
          </View>
        )}
        {current === 'client' && (
          <View style={{ gap: Spacing.sm }}>
            <View style={styles.row}>
              <Avatar name={job.clientName} photo={job.clientPhoto} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{job.clientName}</Text>
                <Text variant="caption" muted>
                  {t('job.clientPays', { price: formatMoney(t, job.price) })}
                </Text>
              </View>
            </View>
            {active && <ContactButtons phone={job.clientPhone} unread={unread} onChat={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })} />}
            {last && canCancel(status) && (
              <Button title={t('job.cancel')} variant="ghost" onPress={() => setConfirmCancel({ late: isLateCancel(scheduledMs ?? Date.now(), Date.now()) })} />
            )}
          </View>
        )}
        {current === 'places' && (
          <View style={{ gap: Spacing.sm }}>
            <PlaceRow
              icon="arrow-up-circle-outline"
              title={t('request.atPickup')}
              value={names.label(job.from)}
              detail={request ? [request.fromDetails, describePlace(t, request.pickup)] : []}
            />
            <PlaceRow
              icon="arrow-down-circle-outline"
              title={t('request.atDropoff')}
              value={names.label(job.to)}
              detail={request ? [request.toDetails, describePlace(t, request.dropoff)] : []}
            />
            {last && canCancel(status) && (
              <Button title={t('job.cancel')} variant="ghost" onPress={() => setConfirmCancel({ late: isLateCancel(scheduledMs ?? Date.now(), Date.now()) })} />
            )}
          </View>
        )}
        {current === 'load' && request && (
          <View style={{ gap: Spacing.sm }}>
            {request.itemOptions.length > 0 && (
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
            {request.helpers > 0 && (
              <Text variant="caption" muted>
                {t('driver.helpers', { count: request.helpers })}
              </Text>
            )}
            {!!request.notes && (
              <Text muted userText>
                {request.notes}
              </Text>
            )}
            <LoadAttachments request={request} />
            {canCancel(status) && (
              <Button title={t('job.cancel')} variant="ghost" onPress={() => setConfirmCancel({ late: isLateCancel(scheduledMs ?? Date.now(), Date.now()) })} />
            )}
          </View>
        )}
      </QuestScreen>
      {delivered.shown && (
        <Celebration overMap title={t('celebrate.doneTitle')} body={t('celebrate.earnedBody', { amount: formatMoney(t, driverKeeps) })} onDone={delivered.close} />
      )}
      <ConfirmSheet
        visible={!!confirmCancel}
        title={t('job.cancelTitle')}
        body={
          confirmCancel?.late
            ? t('job.cancelBodyLate', { price: formatMoney(t, job.price) })
            : t('job.cancelBody', { price: formatMoney(t, job.price), commission: formatMoney(t, job.commission) })
        }
        keep={t('job.keepJob')}
        confirm={t('job.cancelConfirm')}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => {
          setConfirmCancel(null);
          cancelJob(store, job, 'driver');
        }}
      />
    </>
  );
}

function AutoNote({ simulate, onToggle }: { simulate: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.autoRow]}>
      <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.textMuted} />
      <Text variant="caption" muted style={{ flex: 1 }}>
        {t('job.autoSteps')}
      </Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: simulate }} onPress={onToggle} style={styles.toggle}>
        <MaterialCommunityIcons name={simulate ? 'flask' : 'crosshairs-gps'} size={16} color={simulate ? colors.accent : colors.primary} />
        <Text variant="caption" color={simulate ? colors.accent : colors.primary}>
          {simulate ? t('job.simulating') : t('job.realGps')}
        </Text>
      </Pressable>
    </View>
  );
}

function NavButton({ label, icon, color, href }: { label: string; icon: 'waze' | 'google-maps'; color: string; href: string }) {
  const colors = useColors();
  return (
    <ExternalLink href={href} label={label} style={[styles.nav, { backgroundColor: colors.surface, borderColor: color }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text variant="label">{label}</Text>
    </ExternalLink>
  );
}

function Fallback({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        play('step');
        onPress();
      }}
      style={styles.fallback}>
      <Text variant="caption" color={colors.primary} style={{ textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TestBox({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.testBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="flask-outline" size={18} color={colors.accent} />
        <Text variant="caption" color={colors.accent} style={{ flex: 1 }}>
          {t('driver.testMode')}
        </Text>
      </View>
      <Button title={label} variant="ghost" icon="time-outline" onPress={onPress} />
    </View>
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

function PlaceRow({
  icon,
  title,
  value,
  detail,
}: {
  icon: 'arrow-up-circle-outline' | 'arrow-down-circle-outline';
  title: string;
  value: string;
  detail: string[];
}) {
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
  nextChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48, paddingHorizontal: Spacing.md, borderRadius: Radius.pill },
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.lg },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  earned: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  auto: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  nav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  fallback: { alignSelf: 'center', padding: Spacing.xs },
  testBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, direction: 'ltr' },
  code: { flex: 1, minWidth: 0, fontSize: 18, textAlign: 'center', writingDirection: 'ltr' },
  codeFilled: { fontSize: 24, letterSpacing: 8 },
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
