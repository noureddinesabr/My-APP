import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { sendOffer, setOfferStatus } from '@/backend/actions';
import { useDoc, useStore } from '@/backend';
import type { FreightRequest } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { vehicleIcon, weightKey } from '@/constants/vehicles';
import { Stepper } from '@/components/stepper';
import { LoadAttachments } from '@/components/media/load-attachments';
import { FactChip } from '@/components/fact-chip';
import { Text } from '@/components/text';
import { Celebration, useBecameTrue } from '@/components/motion/celebration';
import { CountUp, Shimmer } from '@/components/motion/effects';
import { Button, Chip, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { NotificationBell } from '@/components/notification-bell';
import { QuestScreen } from '@/components/motion/quest';
import { isExample, sampleLoads } from '@/constants/sample-loads';
import { commissionSplit, maxTons } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { useDriver, type Eta } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const MAX_PRICE = 200_000;

export default function LoadDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const example = isExample(id);
  const sample = useMemo(() => (example ? (sampleLoads().find((item) => item.id === id) ?? null) : undefined), [example, id]);
  const live = useDoc('requests', example ? null : id);
  const load = example ? sample : live;

  if (load === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (load === null) return <Missing />;
  return <LoadView load={load} example={example} />;
}

function Missing() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <Screen>
      <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
      <Text muted>{t('track.notFound')}</Text>
    </Screen>
  );
}

function LoadView({ load, example }: { load: FreightRequest; example: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { profile, setOffer } = useDriver();
  const { height: screen } = useWindowDimensions();
  const { account, record, approved } = useDriverRecord();
  const { paused, company } = useDriverInvoices(account);
  const rate = company.commissionRate;
  const liveOffer = useDoc('offers', !example && account ? `${load.id}_${account.id}` : null);
  const localOffer = example ? profile.offers[load.id] : undefined;
  const sent = example ? localOffer : liveOffer && liveOffer.status === 'pending' ? liveOffer : undefined;

  const [custom, setCustom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentMoment, setSentMoment] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  // The client accepted while the driver was looking at this load.
  const won = useBecameTrue(liveOffer?.status === 'accepted');
  const scheduled = !!load.scheduledAt;
  const eta: Eta = scheduled ? 'scheduled' : 30;

  // A weight the client didn't know never blocks an offer; the driver judges from the size and photos.
  const fits = !profile.vehicle || load.weightKnown === false || load.tons <= maxTons(profile.vehicle.type);
  const closed = !example && load.status !== 'open';
  // Higher offers in steps that suit the amount, like inDrive's "+10 / +20".
  const step = load.price < 500 ? 10 : load.price < 2000 ? 50 : 100;
  const raises = [1, 2, 4].map((n) => load.price + step * n);

  const offer = async (price: number) => {
    if (example) {
      play('send');
      setSentMoment(true);
      setOffer(load.id, { price, eta });
      setCustom(null);
      return;
    }
    if (!record) return;
    setBusy(true);
    try {
      // Accepting a booking is the promise to be there at that time.
      await sendOffer(store, record, load, price, eta, scheduled);
      play('send');
      setSentMoment(true);
      setCustom(null);
    } catch {
      play('error');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (example) setOffer(load.id, null);
    else if (liveOffer) await setOfferStatus(store, liveOffer.id, 'withdrawn');
    setCustom(null);
  };

  // What blocks an offer, in the order the driver can fix it.
  const blocker = closed
    ? 'closed'
    : !approved
      ? 'verify'
      : !example && !account
        ? 'signIn'
        : !fits
          ? 'heavy'
          : !example && !record
            ? 'loading'
            : !example && paused
              ? 'invoice'
              : null;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/driver'));
  const extras = (load.media?.length ?? 0) + (load.voiceNote ? 1 : 0) + (load.notes.trim() ? 1 : 0);
  const price = custom ?? load.price;
  const { commission, driverKeeps } = commissionSplit(price, rate);

  const map = (
    <View style={{ flex: 1 }}>
      <FreightMap
        fill
        bare
        style={{ flex: 1, borderRadius: 0 }}
        inset={{ top: 96, bottom: 48 }}
        markers={[
          { id: 'from', kind: 'pickup', lat: load.from.lat, lng: load.from.lng, label: names.short(load.from) },
          { id: 'to', kind: 'dropoff', lat: load.to.lat, lng: load.to.lng, label: names.short(load.to) },
        ]}
        route={[load.from, load.to]}
        focus={[load.from, load.to]}
        focusKey={load.id}
      />
      <View style={styles.mapTop} pointerEvents="box-none">
        <NotificationBell />
        <View style={{ flex: 1 }} />
        <View style={[styles.badge, { backgroundColor: example ? colors.accentFill : colors.successFill }]}>
          <Text variant="caption" color={colors.onPrimary}>
            {example ? t('driver.example') : t('driver.live')}
          </Text>
        </View>
      </View>
    </View>
  );

  const canOffer = !blocker && !sent;
  const footer = canOffer ? (
    <Button
      title={busy ? t('login.sending') : custom !== null ? t('simple.sendPrice', { price: formatMoney(t, custom) }) : t('simple.accept', { price: formatMoney(t, load.price) })}
      variant="accent"
      icon={custom !== null ? 'paper-plane-outline' : 'checkmark-circle'}
      sound={null}
      disabled={busy}
      onPress={() => offer(price)}
    />
  ) : undefined;

  return (
    <>
      <QuestScreen
        top={map}
        topHeight={Math.round(screen * (screen < 700 ? 0.36 : 0.42))}
        stepKey="load"
        title={names.shortRoute(load.from, load.to)}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={leave}
        footer={footer}>
        <View style={{ gap: Spacing.sm }}>
          {/* The whole job in one card: the client's cash price, then size, time and distance. */}
          <View style={[styles.ticket, { backgroundColor: colors.successFill, borderColor: colors.success }]}>
            <Shimmer every={3200} color="rgba(255,255,255,0.3)" />
            <Text variant="caption" color={colors.onPrimary}>
              {example ? t('driver.clientOffers') : t('driver.clientOffersName', { name: load.clientName })}
            </Text>
            <CountUp value={load.price} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.onPrimary} style={styles.ticketPrice} />
            <Text variant="caption" color={colors.onPrimary}>
              {t('simple.cashKm', { km: load.km })}
            </Text>
          </View>
          <View style={styles.facts}>
            <FactChip tone="blue" icon="weight-kilogram" label={t(`weight.${weightKey(load.tons)}`)} />
            <FactChip tone="green" icon={vehicleIcon(load.vehicle)} label={t(`vehicle.${load.vehicle}`)} />
            {load.rideAlong && <FactChip tone="violet" icon="seat-passenger" label={load.accompaniment ? t(`accompany.${load.accompaniment}`) : t('simple.rideAlongShort')} />}
            {load.allowSharing && <FactChip tone="blue" icon="account-multiple-outline" label={t('route.sharedTag')} />}
            <FactChip
              tone="gold"
              icon={scheduled ? 'calendar-clock' : 'lightning-bolt'}
              label={scheduled ? dates.pickupShort(load.scheduledAt!) : t('simple.now')}
            />
            {load.helpers > 0 && <FactChip tone="blue" icon="account-hard-hat" label={t('request.helpers')} value={load.helpers} />}
            {extras > 0 && (
              <PressableScale accessibilityRole="button" scaleTo={0.95} onPress={() => setExtrasOpen(true)}>
                <FactChip tone="violet" icon={load.media?.length ? 'image-multiple' : 'message-text-outline'} label={t('simple.seeExtras', { count: extras })} />
              </PressableScale>
            )}
          </View>

          {blocker === 'closed' && liveOffer?.status === 'accepted' && load.jobId ? (
            <>
              <Notice icon="checkmark-circle" tone={colors.success} title={t('live.offerAccepted')} body={t('driver.acceptedBody')} />
              <Button title={t('driver.openJob')} variant="accent" icon="navigate-outline" onPress={() => router.replace({ pathname: '/job/[id]', params: { id: load.jobId as string } })} />
            </>
          ) : blocker === 'closed' ? (
            <Notice icon="lock-closed-outline" tone={colors.textMuted} title={t('driver.closedTitle')} body={t('driver.closedBody')} />
          ) : null}
          {!example && liveOffer?.status === 'declined' && load.status === 'open' && (
            <Notice icon="close-circle-outline" tone={colors.accent} title={t('live.offerDeclined')} body={t('driver.declinedBody')} />
          )}
          {blocker === 'verify' && (
            <>
              <Notice icon="lock-closed-outline" tone={colors.primary} title={t('driver.lockedTitle')} body={t('driver.lockedBody', { price: formatMoney(t, load.price), keep: formatMoney(t, commissionSplit(load.price, rate).driverKeeps) })} />
              <Button title={t('driver.lockedCta')} onPress={() => router.replace('/driver')} />
            </>
          )}
          {blocker === 'signIn' && (
            <>
              <Notice icon="person-circle-outline" tone={colors.primary} title={t('driver.signInTitle')} body={t('driver.signInToOffer')} />
              <Button title={t('driver.signIn')} icon="log-in-outline" onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
            </>
          )}
          {blocker === 'heavy' && <Notice icon="alert-circle-outline" tone={colors.accent} title={t('driver.tooHeavy')} />}
          {blocker === 'invoice' && (
            <>
              <Notice icon="pause-circle-outline" tone={colors.accent} title={t('invoice.pausedTitle')} body={t('invoice.pausedBody')} />
              <Button title={t('invoice.openInvoices')} icon="receipt-outline" onPress={() => router.push('/invoices')} />
            </>
          )}
          {!blocker && sent && (
            <>
              <Notice icon="checkmark-circle" tone={colors.success} title={t('simple.sentTitle', { price: formatMoney(t, sent.price) })} body={example ? t('driver.sentBodyExample') : t('driver.sentBody')} />
              <View style={styles.tags}>
                <Chip label={t('driver.withdraw')} selected={false} onPress={withdraw} />
              </View>
            </>
          )}
          {canOffer && (
            <>
              {/* Or ask for more in one tap; "Other" opens the exact amount. */}
              <Text variant="caption" muted>
                {t('simple.orAskMore')}
              </Text>
              {custom === null ? (
                <View style={styles.tags}>
                  {raises.map((value) => (
                    <Chip key={value} label={formatMoney(t, value)} selected={false} onPress={() => offer(value)} />
                  ))}
                  <Chip label={t('simple.otherPrice')} selected={false} onPress={() => setCustom(raises[0])} />
                </View>
              ) : (
                <Stepper value={custom} step={step} min={10} max={MAX_PRICE} onChange={setCustom} format={(value) => formatMoney(t, value)} editable unit={currencyUnit(t)} />
              )}
              <Text variant="caption" muted>
                {scheduled ? `${t('simple.commitLine', { at: dates.pickupAt(load.scheduledAt!) })} · ` : ''}
                {t('simple.keepLine', { keep: formatMoney(t, driverKeeps), share: formatMoney(t, commission) })}
              </Text>
            </>
          )}
        </View>
      </QuestScreen>
      <Sheet visible={extrasOpen} onClose={() => setExtrasOpen(false)} title={t('simple.extrasFromClient')} drag="handle" overMap>
        <View style={{ gap: Spacing.sm }}>
          {!!load.notes.trim() && <ClientNote text={load.notes} name={example ? undefined : load.clientName} />}
          <LoadAttachments request={load} />
        </View>
      </Sheet>
      {won.shown ? (
        <Celebration
          overMap
          title={t('celebrate.wonTitle')}
          body={t('celebrate.wonBody', { route: names.shortRoute(load.from, load.to), amount: formatMoney(t, liveOffer?.price ?? load.price) })}
          onDone={won.close}
        />
      ) : sentMoment ? (
        <Celebration overMap title={t('celebrate.offerSentTitle')} body={t('celebrate.offerSentBody')} onDone={() => setSentMoment(false)} duration={2200} />
      ) : null}
    </>
  );
}

function Notice({
  icon,
  tone,
  title,
  body,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={styles.row}>
        <Ionicons name={icon} size={22} color={tone} />
        <Text variant="label" color={tone} style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      {body && <Text muted>{body}</Text>}
    </View>
  );
}

/**
 * What the client wrote, in a speech bubble with a header, so it is clearly their words. The
 * text sits on its own language's side: Arabic on the right, French and English on the left.
 */
function ClientNote({ text, name }: { text: string; name?: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.note, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
      <View style={styles.noteHead}>
        <View style={[styles.noteIcon, { backgroundColor: colors.primaryFill }]}>
          <MaterialCommunityIcons name="format-quote-open" size={16} color={colors.onPrimary} />
        </View>
        <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
          {name ? t('driver.clientNoteFrom', { name }) : t('driver.clientNote')}
        </Text>
      </View>
      <Text userText style={styles.noteText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  note: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.md, gap: Spacing.sm },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  noteIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteText: { fontSize: 17, lineHeight: 26 },
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: Radius.pill },
  ticket: { borderRadius: Radius.lg, borderWidth: 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, overflow: 'hidden', alignItems: 'center' },
  ticketPrice: { fontSize: 28, lineHeight: 38 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
