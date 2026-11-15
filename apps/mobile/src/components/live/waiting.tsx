import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { acceptOffer, answerCounter, cancelRequest, counterOffer, setOfferStatus, updateRequestPrice } from '@/backend/actions';
import { addDueExampleOffers, exampleAgrees } from '@/backend/examples';
import { useQuery, useStore } from '@/backend';
import type { FreightRequest, Offer } from '@/backend/types';
import { BackButton } from '@/components/back-button';
import { Avatar, ConfirmSheet } from '@/components/live/parts';
import { FreightMap } from '@/components/map/freight-map';
import type { MapMarker } from '@/components/map/types';
import { currencyUnit, formatMoney } from '@/components/money';
import { PulseDot } from '@/components/motion/effects';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { ensureNotifications } from '@/lib/notify';
import { play } from '@/lib/sounds';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

const SMALL = { fontSize: 14, lineHeight: 20 };
const TINY = { fontSize: 12, lineHeight: 16 };
const stepFor = (price: number) => (price < 1000 ? 10 : price < 5000 ? 50 : 100);

/**
 * Page 4: the map takes most of the screen (the trip, a radar while looking, each driver who
 * offered as a pin with his price); at the bottom a slim panel with the offers (accept, decline,
 * suggest another price) and the customer's own price with Change and Cancel.
 */
export function WaitingForOffers({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { height: screen } = useWindowDimensions();
  const offers = useQuery('offers', [['requestId', request.id]]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [counterFor, setCounterFor] = useState<Offer | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const live = (offers ?? []).filter((offer) => offer.status === 'pending' || offer.status === 'countered').sort((a, b) => a.price - b.price);
  const panelMax = Math.round(screen * 0.42);

  useEffect(() => {
    ensureNotifications();
  }, []);

  // Test version: example drivers send offers a few seconds after the request (clearly labelled).
  const known = offers?.map((offer) => offer.id).join(',');
  useEffect(() => {
    if (offers === undefined || request.status !== 'open') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    addDueExampleOffers(store, request, offers, Date.now()).then((next) => {
      if (next !== null) timer = setTimeout(() => addDueExampleOffers(store, request, offers, Date.now()), Math.max(300, next - Date.now()));
    });
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, request.id, request.status, request.price]);

  // Example drivers answer a counter-price after a few seconds.
  const countered = live.filter((offer) => offer.example && offer.status === 'countered').map((offer) => offer.id).join(',');
  useEffect(() => {
    const waiting = live.filter((offer) => offer.example && offer.status === 'countered');
    if (!waiting.length) return;
    const timer = setTimeout(() => waiting.forEach((offer) => answerCounter(store, offer, exampleAgrees(offer)).catch(() => {})), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countered]);

  const accept = async (offer: Offer) => {
    setAccepting(offer.id);
    try {
      play('success');
      await acceptOffer(store, request, offer, offers ?? []);
    } finally {
      setAccepting(null);
    }
  };

  const pins: MapMarker[] = live
    .filter((offer) => offer.pos)
    .map((offer) => ({ id: offer.id, kind: 'driver', lat: offer.pos!.lat, lng: offer.pos!.lng, label: formatMoney(t, offer.price) }));

  return (
    <>
      <FreightMap
        fill
        bare
        style={StyleSheet.absoluteFill}
        inset={{ top: 90, bottom: panelMax + 20 }}
        markers={[
          { id: 'from', kind: 'pickup', lat: request.from.lat, lng: request.from.lng, label: t('map.pickup') },
          { id: 'to', kind: 'dropoff', lat: request.to.lat, lng: request.to.lng, label: t('map.dropoff') },
          ...pins,
        ]}
        route={[request.from, request.to]}
        // While looking: the whole trip. Once drivers offer: the pickup and the drivers around it, so their pins don't pile up.
        focus={pins.length ? [request.from, ...pins] : [request.from, request.to]}
        focusKey={`${request.id}:${pins.length}`}
        radar={live.length ? null : request.from}
      />

      <View style={styles.top} pointerEvents="box-none">
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/client'))} />
        <View style={[styles.status, { backgroundColor: colors.surfaceRaised }, rim(colors)]}>
          <PulseDot color={live.length ? colors.success : colors.primary} size={8} />
          <Text style={[SMALL, { fontFamily: Fonts.semibold }]}>
            {live.length ? t('wait.offers', { count: live.length }) : t('wait.looking')}
          </Text>
        </View>
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.panel, { maxHeight: panelMax, backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        {!!request.cancelledDrivers?.length && (
          <Text color={colors.accent} style={TINY}>
            {t('track.driverCancelledBack')}
          </Text>
        )}
        {live.length > 0 ? (
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: Spacing.sm }} showsVerticalScrollIndicator={false}>
            {live.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                yourPrice={request.price}
                accepting={accepting === offer.id}
                onAccept={() => accept(offer)}
                onDecline={() => {
                  play('tap');
                  setOfferStatus(store, offer.id, 'declined');
                }}
                onCounter={() => setCounterFor(offer)}
              />
            ))}
          </ScrollView>
        ) : (
          <Text muted style={SMALL}>
            {t('wait.lookingBody')}
          </Text>
        )}

        <View style={[styles.priceBar, { borderColor: colors.rim }]}>
          <View style={{ flex: 1 }}>
            <Text muted style={TINY}>
              {t('wait.yourPrice')}
            </Text>
            <Text color={colors.primary} style={{ fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24 }}>
              {formatMoney(t, request.price)}
            </Text>
          </View>
          <SmallButton icon="create-outline" label={t('wait.change')} onPress={() => setPriceOpen(true)} />
          <SmallButton icon="close" label={t('wait.cancel')} danger onPress={() => setCancelOpen(true)} />
        </View>
      </Animated.View>

      <PriceSheet
        key={`p${request.price}`}
        visible={priceOpen}
        title={t('wait.changeTitle')}
        body={t('wait.changeBody')}
        start={request.price}
        confirm={(price) => t('wait.changeSend', { price: formatMoney(t, price) })}
        onClose={() => setPriceOpen(false)}
        onDone={(price) => {
          setPriceOpen(false);
          updateRequestPrice(store, request, price);
        }}
      />
      <PriceSheet
        key={`c${counterFor?.id ?? ''}`}
        visible={!!counterFor}
        title={t('wait.counterTitle')}
        body={counterFor ? t('wait.counterBody', { name: counterFor.driverName, price: formatMoney(t, counterFor.price) }) : ''}
        // Starts a little under the lower of the two prices; the customer adjusts it.
        start={counterFor ? Math.max(10, Math.round((Math.min(counterFor.price, request.price) * 0.95) / 10) * 10) : request.price}
        confirm={(price) => t('wait.counterSend', { price: formatMoney(t, price) })}
        onClose={() => setCounterFor(null)}
        onDone={(price) => {
          if (counterFor) counterOffer(store, counterFor, price);
          setCounterFor(null);
        }}
      />
      <ConfirmSheet
        visible={cancelOpen}
        title={t('track.cancelTitle')}
        body={live.length ? t('track.cancelLoseOffers', { count: live.length }) : t('track.cancelBody')}
        keep={t('track.keepRequest')}
        confirm={t('track.cancelConfirm')}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          cancelRequest(store, request);
        }}
      />
    </>
  );
}

/** One offer, small: who, how soon, the price, and three actions. */
function OfferRow({
  offer,
  yourPrice,
  accepting,
  onAccept,
  onDecline,
  onCounter,
}: {
  offer: Offer;
  yourPrice: number;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const eta = offer.eta === 'scheduled' ? t('driver.etaScheduled') : offer.eta === 30 ? t('driver.eta30') : offer.eta === 60 ? t('driver.eta60') : t('driver.eta120');
  const waiting = offer.status === 'countered';
  const diff = offer.price - yourPrice;
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.offer, { backgroundColor: colors.surface, borderColor: colors.rim }]}>
      <View style={styles.row}>
        <Avatar name={offer.driverName} photo={offer.driverPhoto} size={38} />
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={[SMALL, { fontFamily: Fonts.semibold, flexShrink: 1 }]}>{offer.driverName}</Text>
            {offer.example && (
              <View style={[styles.tag, { backgroundColor: colors.control }]}>
                <Text muted style={{ fontSize: 11, lineHeight: 14 }}>
                  {t('wait.example')}
                </Text>
              </View>
            )}
          </View>
          <Text muted style={TINY}>
            ★ {offer.trips ? offer.rating.toFixed(1) : '–'} · {t(`vehicle.${offer.vehicle}`)} · {eta}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text color={colors.primary} style={{ fontFamily: Fonts.bold, fontSize: 17, lineHeight: 22 }}>
            {formatMoney(t, offer.price)}
          </Text>
          {offer.agreedCounter ? (
            <Text color={colors.success} style={TINY}>
              {t('wait.agreed')}
            </Text>
          ) : diff !== 0 ? (
            <Text muted style={TINY}>
              {diff > 0 ? `+${formatMoney(t, diff)}` : `−${formatMoney(t, -diff)}`}
            </Text>
          ) : null}
        </View>
      </View>
      {waiting ? (
        <Text muted style={TINY}>
          {t('wait.counterWaiting', { price: formatMoney(t, offer.counter ?? 0), name: offer.driverName })}
        </Text>
      ) : (
        <View style={styles.row}>
          <SmallButton icon="close" label={t('wait.decline')} onPress={onDecline} />
          <SmallButton icon="swap-horizontal" label={t('wait.counter')} onPress={onCounter} />
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: accepting }}
            disabled={accepting}
            scaleTo={0.96}
            onPress={onAccept}
            style={[styles.accept, { backgroundColor: colors.cta }]}>
            <Ionicons name="checkmark" size={16} color={colors.onCta} />
            <Text color={colors.onCta} style={[SMALL, { fontFamily: Fonts.semibold }]}>
              {t('wait.accept')}
            </Text>
          </PressableScale>
        </View>
      )}
    </Animated.View>
  );
}

function SmallButton({ icon, label, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" scaleTo={0.95} onPress={onPress} style={[styles.small, { backgroundColor: colors.control }]}>
      <Ionicons name={icon} size={15} color={danger ? colors.accent : colors.primary} />
      <Text color={danger ? colors.accent : colors.onControl} style={SMALL}>
        {label}
      </Text>
    </PressableScale>
  );
}

function PriceSheet({
  visible,
  title,
  body,
  start,
  confirm,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  body: string;
  start: number;
  confirm: (price: number) => string;
  onClose: () => void;
  onDone: (price: number) => void;
}) {
  const { t } = useTranslation();
  const [price, setPrice] = useState(start);
  return (
    <Sheet visible={visible} onClose={onClose} drag="handle">
      <View style={{ gap: Spacing.sm }}>
        <Text center style={{ fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24 }}>
          {title}
        </Text>
        <Text muted center style={SMALL}>
          {body}
        </Text>
        <Stepper value={price} step={stepFor(price)} min={10} max={200_000} onChange={setPrice} format={(value) => formatMoney(t, value)} editable unit={currencyUnit(t)} />
        <Button title={confirm(price)} variant="accent" icon="checkmark" sound="send" onPress={() => onDone(price)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill },
  panel: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomWidth: 0,
  },
  offer: { gap: Spacing.sm, padding: Spacing.sm + 2, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill },
  small: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderRadius: Radius.pill },
  accept: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 36, borderRadius: Radius.pill },
  priceBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
});
