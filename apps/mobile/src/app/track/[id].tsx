import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { acceptOffer, advanceJob, cancelJob, cancelRequest, normalizeJob, rateJob, setOfferStatus } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { FreightRequest, Job, JobStatus, Offer } from '@/backend/types';
import { ContactButtons } from '@/components/contact-buttons';
import { useDateFormat } from '@/components/date-format';
import { Avatar, ConfirmSheet, RatingCard, StatusBanner } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import type { MapMarker } from '@/components/map/types';
import { formatMoney } from '@/components/money';
import { Celebration } from '@/components/motion/celebration';
import { CountUp, Pop, PulseDot } from '@/components/motion/effects';
import { BackButton } from '@/components/back-button';
import { QuestScreen, Rise } from '@/components/motion/quest';
import { ensureNotifications } from '@/lib/notify';
import { SearchingCard } from '@/components/live/searching';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { canCancel, remaining, targetFor } from '@/lib/trip';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

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

  // While drivers look at it: the whole map with the radar, and a live card at the bottom.
  if (request.status === 'open') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <WaitingForOffers request={request} title={names.shortRoute(request.from, request.to)} />
        {celebration}
      </View>
    );
  }

  if (job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LiveTrip request={request} job={normalizeJob(job)} />
        {celebration}
      </View>
    );
  }

  return (
    <Screen header={<Header title={t('track.title')} />} overlay={celebration}>
      {request.status === 'cancelled' && (
        <StatusBanner icon="close-circle-outline" tone="accent" title={t('track.cancelled')} body={t('track.cancelledBody')} />
      )}
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
  // Over the live map (not in front of it): the radar and the trip stay in view.
  if (moment === 'sent') return <Celebration overMap title={t('quest.sentTitle')} body={t('quest.sentBody')} onDone={close} duration={2800} />;
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
      <Text variant="subtitle" style={{ flex: 1 }}>
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
  const { t } = useTranslation();
  return (
    <FreightMap
      fill
      bare
      style={{ flex: 1, borderRadius: 0 }}
      inset={{ top: 100, bottom: 36 }}
      markers={[
        { id: 'from', kind: 'pickup', lat: request.from.lat, lng: request.from.lng, label: t('map.pickup') },
        { id: 'to', kind: 'dropoff', lat: request.to.lat, lng: request.to.lng, label: t('map.dropoff') },
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

function WaitingForOffers({ request, title }: { request: FreightRequest; title: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { height: screen } = useWindowDimensions();
  const store = useStore();
  const offers = useQuery('offers', [['requestId', request.id]]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const pending = (offers ?? []).filter((offer) => offer.status === 'pending').sort((a, b) => a.price - b.price);
  // Offers can arrive while the phone is in a pocket: ask once to show them as notifications.
  useEffect(() => {
    ensureNotifications();
  }, []);
  // The live card never climbs over the map: at most the same share as the request panel.
  const panelMax = Math.round(screen * (pending.length ? 0.55 : 0.5));

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
      {/* The whole map behind, the radar searching over the trip. */}
      <FreightMap
        fill
        bare
        style={StyleSheet.absoluteFill}
        inset={{ top: 110, bottom: panelMax }}
        markers={[
          { id: 'from', kind: 'pickup', lat: request.from.lat, lng: request.from.lng, label: t('map.pickup') },
          { id: 'to', kind: 'dropoff', lat: request.to.lat, lng: request.to.lng, label: t('map.dropoff') },
        ]}
        route={[request.from, request.to]}
        focus={[request.from, request.to]}
        focusKey={`${request.id}:${panelMax}`}
        // Searching for drivers around the pickup (under the pins, so they stay readable).
        radar={pending.length ? null : request.from}
      />

      {/* Floating back button (the pins on the map already show the trip). */}
      <View style={styles.floatTop} pointerEvents="box-none">
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/client'))} />
      </View>

      {/* The live card. */}
      <Animated.View
        entering={FadeInDown.springify().damping(16)}
        style={[styles.livePanel, { maxHeight: panelMax, backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        {!pending.length ? (
          // Still looking: one card that fits the panel, nothing to scroll.
          <View style={styles.livePanelContent}>
            <SearchingCard since={request.createdAt} price={request.price} cancelLabel={t('track.cancelRequest')} onCancel={() => setConfirmCancel(true)} />
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.livePanelContent} showsVerticalScrollIndicator={false}>
          <View style={styles.liveRow}>
            <View style={[styles.liveBadge, { backgroundColor: colors.successSoft }]}>
              <PulseDot color={colors.success} size={9} />
              <Text variant="caption" color={colors.success} style={styles.liveText}>
                {t('track.live')}
              </Text>
            </View>
            <Text variant="caption" muted style={{ flex: 1 }}>
              {t('track.liveBody')}
            </Text>
          </View>

          <View style={styles.titleRow}>
            <Pop trigger={pending.length}>
              <Text variant="title">{pending.length ? t('track.offersCount', { count: pending.length }) : t('track.searchingShort')}</Text>
            </Pop>
            {!pending.length && <ThinkingDots color={colors.primary} />}
          </View>

          {/* The price the client offers, standing out. */}
          <View style={[styles.pricePill, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {t('track.offeredPrice')}
            </Text>
            <CountUp value={request.price} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.primary} />
          </View>

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
        </ScrollView>
        )}
      </Animated.View>

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

/** Three dots bouncing one after another: "still looking". */
function ThinkingDots({ color }: { color: string }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const still = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-6, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 420 })), -1, false)));
  }, [y, delay, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
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
          <Text variant="subtitle">
            {offer.driverName}
          </Text>
          <Text variant="caption" muted>
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

/** The trip with the driver moving on it, kept at the top of the screen while the rest scrolls. */
function LiveTripMap({ request, job }: { request: FreightRequest; job: Job }) {
  const status: JobStatus = job.status === 'loading' ? 'atPickup' : job.status;
  const target = targetFor(status, job.from, job.to);
  if (status === 'completed' || status === 'cancelled') return null;
  const driverMarker: MapMarker[] = job.driverPos
    ? [{ id: 'driver', kind: 'driver', lat: job.driverPos.lat, lng: job.driverPos.lng, label: job.driverName.split(' ')[0] }]
    : [];
  return (
    <RequestMap
      request={request}
      extra={driverMarker}
      approach={status === 'toPickup' && job.driverPos ? [job.driverPos, job.from] : undefined}
      focus={job.driverPos && target && status !== 'scheduled' ? [job.driverPos, target] : undefined}
      focusKey={`${job.id}:${status}:${!!job.driverPos}`}
      follow={status === 'scheduled' ? null : job.driverPos}
    />
  );
}

function LiveTrip({ request, job }: { request: FreightRequest; job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { height: screen } = useWindowDimensions();
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

  // Like the request flow: the map on top the whole time, and under it one page at a time.
  const pages = ['now', 'driver'] as const;
  const [page, setPage] = useState(0);
  const currentPage = pages[page];
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/client'));
  const footer =
    currentPage === 'now' && status === 'delivered' ? (
      <Button title={t('track.confirmDelivery')} variant="accent" icon="checkmark-done" sound="complete" onPress={() => advanceJob(store, job, 'completed')} />
    ) : page < pages.length - 1 ? (
      <Button title={t('quest.next')} variant="primary" sound="whoosh" onPress={() => setPage(page + 1)} />
    ) : undefined;

  return (
    <>
      <QuestScreen
        top={
          <View style={{ flex: 1 }}>
            <LiveTripMap request={request} job={job} />
            <View style={styles.mapMenu} pointerEvents="box-none">
              <MenuButton />
            </View>
          </View>
        }
        topHeight={Math.round(screen * (screen < 700 ? 0.4 : 0.45))}
        stepKey={currentPage}
        progress={(page + 1) / pages.length}
        title={currentPage === 'now' ? current.title : t('track.page_driver')}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={() => (page > 0 ? setPage(page - 1) : leave())}
        onClose={leave}
        footer={footer}>
        {currentPage === 'now' && (
          <View style={{ gap: Spacing.sm }}>
            {!!current.body && (
              <View style={[styles.statusLine, { backgroundColor: status === 'cancelled' ? colors.accentSoft : colors.primarySoft }]}>
                <MaterialCommunityIcons name={current.icon} size={20} color={status === 'cancelled' ? colors.accent : colors.primary} />
                <Text variant="label" color={status === 'cancelled' ? colors.accent : colors.primary} style={{ flex: 1 }}>
                  {current.body}
                </Text>
              </View>
            )}
            {job.simulated && active && status !== 'scheduled' && (
              <View style={styles.row}>
                <MaterialCommunityIcons name="flask-outline" size={14} color={colors.textMuted} />
                <Text variant="caption" muted style={{ flex: 1 }}>
                  {t('track.simulatedGps')}
                </Text>
              </View>
            )}
            {active && status !== 'delivered' && (
              <View style={[styles.codeCard, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
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
              </View>
            )}
            {status === 'completed' && !job.clientRating && (
              <RatingCard about="driver" name={job.driverName} onSubmit={(rating) => rateJob(store, job, 'client', rating)} />
            )}
            {status === 'completed' && job.clientRating && (
              <>
                <Text variant="label" center>
                  {t('track.thanks')}
                </Text>
                <Button title={t('track.newRequest')} icon="add-circle-outline" onPress={() => router.replace('/request')} />
              </>
            )}
          </View>
        )}
        {currentPage === 'driver' && (
          <View style={{ gap: Spacing.sm }}>
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
            {active && <ContactButtons phone={job.driverPhone} unread={unread} onChat={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })} />}
            {canCancel(status) && <TextLink label={t('track.cancelTrip')} onPress={() => setConfirmCancel(true)} />}
          </View>
        )}
      </QuestScreen>
      <ConfirmSheet
        visible={confirmCancel}
        title={t('track.cancelTripTitle')}
        body={status === 'scheduled' ? t('track.cancelBookingBody', { name: job.driverName }) : t('track.cancelTripBody', { name: job.driverName })}
        keep={t('track.keepTrip')}
        confirm={t('track.cancelConfirm')}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          cancelJob(store, job, 'client');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mapMenu: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.lg },
  floatTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  routeChip: { flexShrink: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  livePanel: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomWidth: 0,
  },
  livePanelContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm + 2, paddingVertical: 3, borderRadius: Radius.pill },
  liveText: { fontFamily: Fonts.extrabold, letterSpacing: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  dots: { flexDirection: 'row', gap: 5, paddingBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pricePill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5 },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, borderStyle: 'dashed', padding: Spacing.md, borderRadius: Radius.lg },
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
