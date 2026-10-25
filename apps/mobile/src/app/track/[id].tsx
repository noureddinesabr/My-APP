import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';

import { acceptOffer, advanceJob, cancelJob, cancelRequest, rateJob, sendMessage, setOfferStatus } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { FreightRequest, Job, Offer } from '@/backend/types';
import { Avatar, ChatBox, ConfirmModal, JobTimeline, RatingCard, StatusBanner } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import type { MapMarker } from '@/components/map/types';
import { formatMoney } from '@/components/money';
import { formatWeight } from '@/components/request/load-step';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { canCancel, remaining, targetFor } from '@/lib/trip';
import { useAccount } from '@/state/account';
import { Radius, Spacing, useColors } from '@/theme';

/** The client's live view of one request: offers, then the trip, then rating. */
export default function TrackRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const request = useDoc('requests', id);
  const job = useDoc('jobs', request?.jobId ?? null);

  if (request === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (request === null) {
    return (
      <Screen>
        <Header title={t('track.title')} />
        <Text muted>{t('track.notFound')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={names.cityRoute(request.from, request.to)} />
      {request.status === 'open' && <WaitingForOffers request={request} />}
      {request.status === 'cancelled' && !job && (
        <StatusBanner icon="close-circle-outline" tone="accent" title={t('track.cancelled')} body={t('track.cancelledBody')} />
      )}
      {job && <LiveTrip request={request} job={job} />}
    </Screen>
  );
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
}: {
  request: FreightRequest;
  extra?: MapMarker[];
  approach?: { lat: number; lng: number }[];
  focus?: { lat: number; lng: number }[];
  focusKey?: string;
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
    />
  );
}

/** Pulsing "searching" indicator while drivers look at the request. */
function Radar() {
  const colors = useColors();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.radar}>
      <Animated.View
        style={[
          styles.radarRing,
          {
            borderColor: colors.primary,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }],
          },
        ]}
      />
      <View style={[styles.radarCore, { backgroundColor: colors.primary }]}>
        <MaterialCommunityIcons name="truck-fast" size={26} color={colors.onPrimary} />
      </View>
    </View>
  );
}

function WaitingForOffers({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
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
      <RequestMap request={request} />
      <Card style={styles.searching}>
        <Radar />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{pending.length ? t('track.offersCount', { count: pending.length }) : t('track.searching')}</Text>
          <Text variant="caption" muted>
            {t('track.yourPrice', { price: formatMoney(t, request.price) })} · {formatWeight(t, request.tons)} · {t(`vehicle.${request.vehicle}`)}
          </Text>
        </View>
      </Card>

      {pending.map((offer, index) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          clientPrice={request.price}
          best={index === 0 && pending.length > 1}
          accepting={accepting === offer.id}
          onAccept={() => accept(offer)}
          onDecline={() => setOfferStatus(store, offer.id, 'declined')}
        />
      ))}

      {pending.length === 0 && (
        <Text variant="caption" muted center>
          {t('track.waitingHint')}
        </Text>
      )}

      <Button title={t('track.cancelRequest')} variant="ghost" onPress={() => setConfirmCancel(true)} />
      <ConfirmModal
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
    offer.eta === 'scheduled' ? t('driver.etaScheduled') : offer.eta === 30 ? t('driver.eta30') : offer.eta === 60 ? t('driver.eta60') : t('driver.eta120');
  return (
    <Card style={best ? { borderWidth: 1.5, borderColor: colors.success } : undefined}>
      <View style={styles.row}>
        <Avatar name={offer.driverName} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{offer.driverName}</Text>
          <Text variant="caption" muted>
            ★ {offer.rating.toFixed(1)} · {t('track.trips', { count: offer.trips })} · {t(`vehicle.${offer.vehicle}`)}
          </Text>
          <Text variant="caption" muted>
            {offer.plate} · {eta}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="title" color={colors.primary}>
            {formatMoney(t, offer.price)}
          </Text>
          <Text variant="caption" color={diff < 0 ? colors.success : diff > 0 ? colors.accent : colors.textMuted}>
            {diff === 0
              ? t('track.sameAsYours')
              : diff < 0
                ? t('track.belowYours', { amount: formatMoney(t, -diff) })
                : t('track.aboveYours', { amount: formatMoney(t, diff) })}
          </Text>
        </View>
      </View>
      {best && (
        <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
          <Text variant="caption" color={colors.success}>
            {t('track.bestPrice')}
          </Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button title={t('track.decline')} variant="ghost" onPress={onDecline} />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            title={accepting ? t('track.accepting') : t('track.accept', { price: formatMoney(t, offer.price) })}
            icon="checkmark-circle-outline"
            sound="success"
            disabled={accepting}
            onPress={onAccept}
          />
        </View>
      </View>
    </Card>
  );
}

function LiveTrip({ request, job }: { request: FreightRequest; job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { client } = useAccount();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const target = targetFor(job.status, job.from, job.to);
  const left = job.driverPos && target ? remaining(job.driverPos, target) : null;

  const banner = {
    toPickup: {
      icon: 'truck-fast' as const,
      title: left ? t('track.arrivingIn', { minutes: left.minutes }) : t('track.driverComing'),
      body: left ? t('track.kmAway', { km: left.km }) : t('track.waitingGps'),
    },
    atPickup: { icon: 'map-marker-check' as const, title: t('status.atPickup'), body: t('track.atPickupBody') },
    loading: { icon: 'package-variant' as const, title: t('status.loading'), body: t('track.loadingBody') },
    inTransit: {
      icon: 'truck-delivery' as const,
      title: left ? t('track.deliveryIn', { minutes: left.minutes }) : t('status.inTransit'),
      body: left ? t('track.kmLeft', { km: left.km }) : undefined,
    },
    atDropoff: { icon: 'flag-checkered' as const, title: t('status.atDropoff'), body: t('track.atDropoffBody') },
    delivered: { icon: 'check-decagram' as const, title: t('track.deliveredTitle'), body: t('track.deliveredBody') },
    completed: { icon: 'party-popper' as const, title: t('track.completedTitle'), body: t('track.paidCash', { price: formatMoney(t, job.price) }) },
    cancelled: { icon: 'close-circle-outline' as const, title: t('track.jobCancelled'), body: t(job.cancelledBy === 'driver' ? 'track.driverCancelledBody' : 'track.cancelledBody') },
  }[job.status];

  const driverMarker: MapMarker[] = job.driverPos
    ? [{ id: 'driver', kind: 'driver', lat: job.driverPos.lat, lng: job.driverPos.lng, label: job.driverName.split(' ')[0] }]
    : [];

  return (
    <>
      <StatusBanner
        icon={banner.icon}
        title={banner.title}
        body={banner.body}
        tone={job.status === 'cancelled' ? 'accent' : job.status === 'completed' || job.status === 'delivered' ? 'success' : 'primary'}
      />

      {job.status !== 'completed' && job.status !== 'cancelled' && (
        <RequestMap
          request={request}
          extra={driverMarker}
          approach={job.status === 'toPickup' && job.driverPos ? [job.driverPos, job.from] : undefined}
          focus={job.driverPos && target ? [job.driverPos, target] : undefined}
          focusKey={`${job.id}:${job.status}:${!!job.driverPos}`}
        />
      )}
      {job.simulated && job.status !== 'completed' && (
        <View style={styles.row}>
          <MaterialCommunityIcons name="flask-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" muted>
            {t('track.simulatedGps')}
          </Text>
        </View>
      )}

      {job.status === 'delivered' && (
        <Button
          title={t('track.confirmDelivery')}
          variant="accent"
          icon="checkmark-done"
          sound="complete"
          onPress={() => advanceJob(store, job, 'completed')}
        />
      )}
      {job.status === 'completed' && !job.clientRating && (
        <RatingCard about="driver" name={job.driverName} onSubmit={(rating) => rateJob(store, job, 'client', rating)} />
      )}
      {job.status === 'completed' && job.clientRating && (
        <Card>
          <Text variant="label" center>
            {t('track.thanks')}
          </Text>
          <Button title={t('track.newRequest')} icon="add-circle-outline" onPress={() => router.replace('/request')} />
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <Avatar name={job.driverName} />
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
        <View style={[styles.phone, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <Text variant="label" selectable style={{ writingDirection: 'ltr' }}>
            {job.driverPhone}
          </Text>
        </View>
      </Card>

      {job.status !== 'completed' && job.status !== 'cancelled' && client && (
        <ChatBox me="client" messages={messages ?? []} onSend={(text) => sendMessage(store, job.id, 'client', text)} />
      )}

      <JobTimeline job={job} />

      {canCancel(job.status) && (
        <>
          <Button title={t('track.cancelTrip')} variant="ghost" onPress={() => setConfirmCancel(true)} />
          <ConfirmModal
            visible={confirmCancel}
            title={t('track.cancelTripTitle')}
            body={t('track.cancelTripBody', { name: job.driverName })}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  searching: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  radar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  radarRing: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3 },
  radarCore: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  phone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
});
