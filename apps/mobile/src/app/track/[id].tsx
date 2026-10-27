import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { acceptOffer, advanceJob, cancelJob, cancelRequest, normalizeJob, rateJob, setOfferStatus } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { FreightRequest, Job, JobStatus, Offer } from '@/backend/types';
import { ContactButtons } from '@/components/contact-buttons';
import { useDateFormat } from '@/components/date-format';
import { Avatar, ConfirmSheet, RatingCard, StatusBanner } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import type { MapMarker } from '@/components/map/types';
import { formatMoney } from '@/components/money';
import { Celebration } from '@/components/motion/celebration';
import { CountUp, Pop } from '@/components/motion/effects';
import { Rise } from '@/components/motion/quest';
import { Radar } from '@/components/motion/scenes';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { canCancel, remaining, targetFor } from '@/lib/trip';
import { Radius, Spacing, useColors } from '@/theme';

/** The client's live view of one request: offers, then the trip, then rating. */
export default function TrackRequest() {
  const { id, sent } = useLocalSearchParams<{ id: string; sent?: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const request = useDoc('requests', id);
  const job = useDoc('jobs', request?.jobId ?? null);
  const celebration = useCelebrations(sent === '1', job ? normalizeJob(job) : null);

  if (request === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (request === null) {
    return (
      <Screen header={<Header title={t('track.title')} />}>
        <Text muted>{t('track.notFound')}</Text>
      </Screen>
    );
  }

  return (
    <Screen header={<Header title={names.shortRoute(request.from, request.to)} />} overlay={celebration}>
      {request.status === 'open' && <WaitingForOffers request={request} />}
      {request.status === 'cancelled' && !job && (
        <StatusBanner icon="close-circle-outline" tone="accent" title={t('track.cancelled')} body={t('track.cancelledBody')} />
      )}
      {job && <LiveTrip request={request} job={normalizeJob(job)} />}
    </Screen>
  );
}

/** The big moments: request sent, driver booked, delivered. Each plays once. */
function useCelebrations(justSent: boolean, job: Job | null) {
  const { t } = useTranslation();
  const [moment, setMoment] = useState<'sent' | 'booked' | 'done' | null>(justSent ? 'sent' : null);
  const seen = useRef<{ job: string | null; done: boolean } | null>(null);
  const done = job?.status === 'completed' || job?.status === 'delivered';

  useEffect(() => {
    // The first time we see this screen's job counts as "already known" (no replay on reopen).
    if (seen.current === null) {
      seen.current = { job: job?.id ?? null, done };
      return;
    }
    if (job && seen.current.job !== job.id) {
      seen.current.job = job.id;
      setMoment('booked');
    } else if (done && !seen.current.done) {
      seen.current.done = true;
      setMoment('done');
    }
  }, [job, done]);

  if (!moment) return undefined;
  const close = () => setMoment(null);
  if (moment === 'sent') return <Celebration title={t('quest.sentTitle')} body={t('quest.sentBody')} onDone={close} />;
  if (moment === 'booked') return <Celebration title={t('celebrate.bookedTitle')} body={t('celebrate.bookedBody', { name: job?.driverName ?? '' })} onDone={close} />;
  return <Celebration title={t('celebrate.doneTitle')} body={t('celebrate.doneBody')} onDone={close} />;
}

function Header({ title }: { title: string }) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <IconButton
        label={t('common.back')}
        icon={<ForwardChevron color={colors.text} flip />}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/client'))}
      />
      <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function RequestMap({
  request,
  extra = [],
  approach,
  focus,
  focusKey,
  follow,
}: {
  request: FreightRequest;
  extra?: MapMarker[];
  approach?: { lat: number; lng: number }[];
  focus?: { lat: number; lng: number }[];
  focusKey?: string;
  follow?: { lat: number; lng: number } | null;
}) {
  return (
    <FreightMap
      height={230}
      markers={[
        { id: 'from', kind: 'pickup', lat: request.from.lat, lng: request.from.lng },
        { id: 'to', kind: 'dropoff', lat: request.to.lat, lng: request.to.lng },
        ...extra,
      ]}
      route={[request.from, request.to]}
      approach={approach}
      focus={focus ?? [request.from, request.to, ...extra]}
      focusKey={focusKey ?? `${request.id}:${extra.length}`}
      follow={follow}
    />
  );
}

function WaitingForOffers({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { height: screen } = useWindowDimensions();
  const store = useStore();
  const offers = useQuery('offers', [['requestId', request.id]]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const pending = (offers ?? []).filter((offer) => offer.status === 'pending').sort((a, b) => a.price - b.price);

  const accept = async (offer: Offer) => {
    setAccepting(offer.id);
    try {
      await acceptOffer(store, request, offer, offers ?? []);
    } finally {
      setAccepting(null);
    }
  };

  return (
    <>
      {/* The map of the trip with the radar searching over it, like a ride app. */}
      <Rise index={0}>
        <View style={[styles.searchMap, { height: Math.round(screen * 0.46) }]}>
          <FreightMap
            fill
            bare
            style={StyleSheet.absoluteFill}
            markers={[
              { id: 'from', kind: 'pickup', lat: request.from.lat, lng: request.from.lng },
              { id: 'to', kind: 'dropoff', lat: request.to.lat, lng: request.to.lng },
            ]}
            route={[request.from, request.to]}
            focus={[request.from, request.to]}
            focusKey={request.id}
          />
          <View style={[StyleSheet.absoluteFill, styles.radarOver]} pointerEvents="none">
            <Radar size={pending.length ? 170 : 230}>
              <MaterialCommunityIcons name="truck-fast" size={pending.length ? 28 : 36} color={colors.onPrimary} />
            </Radar>
          </View>
        </View>
      </Rise>
      <Rise index={1} style={styles.waiting}>
        <Pop trigger={pending.length}>
          <Text variant="title" center>
            {pending.length ? t('track.offersCount', { count: pending.length }) : t('track.searching')}
          </Text>
        </Pop>
        <Text variant="body" muted center>
          {t('track.yourPrice', { price: formatMoney(t, request.price) })}
        </Text>
      </Rise>

      {pending.map((offer, index) => (
        <Rise key={offer.id} index={index + 1}>
          <OfferCard
            offer={offer}
            clientPrice={request.price}
            best={index === 0 && pending.length > 1}
            accepting={accepting === offer.id}
            onAccept={() => accept(offer)}
            onDecline={() => setOfferStatus(store, offer.id, 'declined')}
          />
        </Rise>
      ))}

      <TextLink label={t('track.cancelRequest')} onPress={() => setConfirmCancel(true)} />
      <ConfirmSheet
        visible={confirmCancel}
        title={t('track.cancelTitle')}
        body={pending.length ? t('track.cancelLoseOffers', { count: pending.length }) : t('track.cancelBody')}
        keep={t('track.keepRequest')}
        confirm={t('track.cancelConfirm')}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          cancelRequest(store, request);
        }}
      />
    </>
  );
}

function OfferCard({
  offer,
  clientPrice,
  best,
  accepting,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  clientPrice: number;
  best: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const diff = offer.price - clientPrice;
  const eta =
    offer.eta === 'scheduled'
      ? t('driver.etaScheduled')
      : offer.eta === 30
        ? t('driver.eta30')
        : offer.eta === 60
          ? t('driver.eta60')
          : t('driver.eta120');
  return (
    <Card style={best ? { borderWidth: 2, borderColor: colors.success } : undefined}>
      <View style={styles.row}>
        <Avatar name={offer.driverName} photo={offer.driverPhoto} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subtitle" numberOfLines={1}>
            {offer.driverName}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            ★ {offer.trips ? offer.rating.toFixed(1) : '–'} · {t(`vehicle.${offer.vehicle}`)} · {eta}
          </Text>
          {offer.committed && (
            <Text variant="caption" color={colors.primary}>
              ✓ {t('track.committed')}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <CountUp value={offer.price} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.primary} />
          {(best || diff < 0) && (
            <Text variant="caption" color={colors.success}>
              {best ? t('track.bestPrice') : t('track.belowYours', { amount: formatMoney(t, -diff) })}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.row}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('track.decline')}
          scaleTo={0.9}
          onPress={onDecline}
          style={[styles.decline, { backgroundColor: colors.control }]}>
          <MaterialCommunityIcons name="close" size={24} color={colors.onControl} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Button
            title={accepting ? t('track.accepting') : t('track.accept', { price: formatMoney(t, offer.price) })}
            variant="accent"
            icon="checkmark-circle"
            sound={null}
            disabled={accepting}
            onPress={onAccept}
          />
        </View>
      </View>
    </Card>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" scaleTo={0.96} onPress={onPress} style={styles.link}>
      <Text variant="label" color={colors.textMuted} center>
        {label}
      </Text>
    </PressableScale>
  );
}

function LiveTrip({ request, job }: { request: FreightRequest; job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const status: JobStatus = job.status === 'loading' ? 'atPickup' : job.status;
  const target = targetFor(status, job.from, job.to);
  const left = job.driverPos && target && status !== 'scheduled' ? remaining(job.driverPos, target) : null;
  const active = status !== 'completed' && status !== 'cancelled';
  const unread = (messages ?? []).filter((message) => message.from === 'driver' && message.at > job.clientReadAt).length;

  const banner: Record<JobStatus, { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body?: string }> = {
    scheduled: {
      icon: 'calendar-check',
      title: t('track.bookedTitle', { at: job.scheduledAt ? dates.pickupAt(job.scheduledAt) : '' }),
      body: t('track.bookedBody', { name: job.driverName }),
    },
    toPickup: {
      icon: 'truck-fast',
      title: left ? t('track.arrivingIn', { minutes: left.minutes }) : t('track.driverComing'),
      body: left ? t('track.kmAway', { km: left.km }) : t('track.waitingGps'),
    },
    atPickup: { icon: 'map-marker-check', title: t('status.atPickup'), body: t('track.atPickupBody') },
    loading: { icon: 'package-variant', title: t('status.atPickup'), body: t('track.atPickupBody') },
    inTransit: {
      icon: 'truck-delivery',
      title: left ? t('track.deliveryIn', { minutes: left.minutes }) : t('status.inTransit'),
      body: left ? t('track.kmLeft', { km: left.km }) : undefined,
    },
    atDropoff: { icon: 'flag-checkered', title: t('status.atDropoff'), body: t('track.atDropoffBody') },
    delivered: { icon: 'check-decagram', title: t('track.deliveredTitle'), body: t('track.deliveredBody') },
    completed: { icon: 'party-popper', title: t('track.completedTitle'), body: t('track.paidCash', { price: formatMoney(t, job.price) }) },
    cancelled: {
      icon: 'close-circle-outline',
      title: t('track.jobCancelled'),
      body: t(job.cancelledBy === 'driver' ? 'track.driverCancelledBody' : 'track.cancelledBody'),
    },
  };
  const current = banner[status];

  const driverMarker: MapMarker[] = job.driverPos
    ? [{ id: 'driver', kind: 'driver', lat: job.driverPos.lat, lng: job.driverPos.lng, label: job.driverName.split(' ')[0] }]
    : [];

  return (
    <>
      <StatusBanner
        icon={current.icon}
        title={current.title}
        body={current.body}
        tone={status === 'cancelled' ? 'accent' : status === 'completed' || status === 'delivered' ? 'success' : 'primary'}
      />

      {active && (
        <RequestMap
          request={request}
          extra={driverMarker}
          approach={status === 'toPickup' && job.driverPos ? [job.driverPos, job.from] : undefined}
          focus={job.driverPos && target && status !== 'scheduled' ? [job.driverPos, target] : undefined}
          focusKey={`${job.id}:${status}:${!!job.driverPos}`}
          follow={status === 'scheduled' ? null : job.driverPos}
        />
      )}
      {job.simulated && active && status !== 'scheduled' && (
        <View style={styles.row}>
          <MaterialCommunityIcons name="flask-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" muted>
            {t('track.simulatedGps')}
          </Text>
        </View>
      )}

      {active && status !== 'delivered' && (
        <Card style={{ ...styles.codeCard, borderColor: colors.primary }}>
          <MaterialCommunityIcons name="shield-key-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" muted>
              {t('track.codeLabel')}
            </Text>
            <Text variant="title" color={colors.primary} style={{ letterSpacing: 6, writingDirection: 'ltr', textAlign: 'left' }}>
              {job.deliveryCode}
            </Text>
            <Text variant="caption" muted>
              {t('track.codeHint')}
            </Text>
          </View>
        </Card>
      )}

      {status === 'delivered' && (
        <Button
          title={t('track.confirmDelivery')}
          variant="accent"
          icon="checkmark-done"
          sound="complete"
          onPress={() => advanceJob(store, job, 'completed')}
        />
      )}
      {status === 'completed' && !job.clientRating && (
        <RatingCard about="driver" name={job.driverName} onSubmit={(rating) => rateJob(store, job, 'client', rating)} />
      )}
      {status === 'completed' && job.clientRating && (
        <Card>
          <Text variant="label" center>
            {t('track.thanks')}
          </Text>
          <Button title={t('track.newRequest')} icon="add-circle-outline" onPress={() => router.replace('/request')} />
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <Avatar name={job.driverName} photo={job.driverPhoto} />
          <View style={{ flex: 1 }}>
            <Text variant="label">{job.driverName}</Text>
            <Text variant="caption" muted>
              {t(`vehicle.${job.vehicle}`)} · {job.plate}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="subtitle" color={colors.primary}>
              {formatMoney(t, job.price)}
            </Text>
            <Text variant="caption" muted>
              {t('track.cash')}
            </Text>
          </View>
        </View>
        {active && (
          <ContactButtons
            phone={job.driverPhone}
            unread={unread}
            onChat={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })}
          />
        )}
      </Card>

      {canCancel(status) && (
        <>
          <TextLink label={t('track.cancelTrip')} onPress={() => setConfirmCancel(true)} />
          <ConfirmSheet
            visible={confirmCancel}
            title={t('track.cancelTripTitle')}
            body={
              status === 'scheduled'
                ? t('track.cancelBookingBody', { name: job.driverName })
                : t('track.cancelTripBody', { name: job.driverName })
            }
            keep={t('track.keepTrip')}
            confirm={t('track.cancelConfirm')}
            onClose={() => setConfirmCancel(false)}
            onConfirm={() => {
              setConfirmCancel(false);
              cancelJob(store, job, 'client');
            }}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, borderStyle: 'dashed' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  waiting: { alignItems: 'center', gap: Spacing.xs },
  searchMap: { borderRadius: Radius.lg, overflow: 'hidden' },
  radarOver: { alignItems: 'center', justifyContent: 'center' },
  decline: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 48, justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  phone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
});
