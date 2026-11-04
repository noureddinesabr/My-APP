import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { addTestCredit, sendOffer, setOfferStatus } from '@/backend/actions';
import { useDoc, useStore } from '@/backend';
import type { FreightRequest } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { currencyUnit, formatMoney } from '@/components/money';
import { describePlace, ITEM_OPTIONS } from '@/components/request/access-options';
import { formatWeight } from '@/components/request/format';
import { kindsOf } from '@/constants/freight';
import { Stepper } from '@/components/stepper';
import { LoadAttachments } from '@/components/media/load-attachments';
import { Text } from '@/components/text';
import { Celebration, useBecameTrue } from '@/components/motion/celebration';
import { CountUp, Shimmer } from '@/components/motion/effects';
import { Button, Chip, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { MenuButton } from '@/components/menu-drawer';
import { QuestScreen } from '@/components/motion/quest';
import { isExample, sampleLoads } from '@/constants/sample-loads';
import { COMMISSION_RATE, commissionSplit, maxTons } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { useDriver, type Eta } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const PRICE_STEP = 10;
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
  const liveOffer = useDoc('offers', !example && account ? `${load.id}_${account.id}` : null);
  const localOffer = example ? profile.offers[load.id] : undefined;
  const sent = example ? localOffer : liveOffer && liveOffer.status === 'pending' ? liveOffer : undefined;

  // Edits on top of the sent offer (or the client's price); cleared after sending or withdrawing.
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [draftEta, setDraftEta] = useState<Eta | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentMoment, setSentMoment] = useState(false);
  // The client accepted while the driver was looking at this load.
  const won = useBecameTrue(liveOffer?.status === 'accepted');
  // Scheduled requests: the driver commits to the pickup time before offering.
  const [committed, setCommitted] = useState(false);
  const needsCommitment = !!load.scheduledAt;
  const price = draftPrice ?? sent?.price ?? load.price;
  const eta = draftEta ?? sent?.eta ?? (load.scheduledAt ? 'scheduled' : 60);
  const editing = !sent || changing;
  const setPrice = setDraftPrice;
  const setEta = setDraftEta;
  const resetEdits = () => {
    setDraftPrice(null);
    setDraftEta(null);
    setChanging(false);
  };

  // A weight the client didn't know never blocks an offer; the driver judges from the photos.
  const fits = !profile.vehicle || load.weightKnown === false || load.tons <= maxTons(profile.vehicle.type);
  const otherVehicle = !!profile.vehicle && profile.vehicle.type !== load.vehicle;
  const { commission, driverKeeps } = commissionSplit(price);
  const lowWallet = !example && !!record && record.wallet < commission;
  const closed = !example && load.status !== 'open';
  const etaOptions: { value: Eta; key: string }[] = load.scheduledAt
    ? [{ value: 'scheduled', key: 'driver.etaScheduled' }]
    : [
        { value: 30, key: 'driver.eta30' },
        { value: 60, key: 'driver.eta60' },
        { value: 120, key: 'driver.eta120' },
      ];

  const submit = async () => {
    if (example) {
      play('send');
      setSentMoment(true);
      setOffer(load.id, { price, eta });
      resetEdits();
      return;
    }
    if (!record) return;
    setBusy(true);
    try {
      await sendOffer(store, record, load, price, eta, needsCommitment);
      play('send');
      setSentMoment(true);
      resetEdits();
    } catch {
      play('error');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (example) setOffer(load.id, null);
    else if (liveOffer) await setOfferStatus(store, liveOffer.id, 'withdrawn');
    resetEdits();
  };

  // What blocks sending an offer, in the order the driver can fix it.
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
            : lowWallet
              ? 'wallet'
              : null;

  // The details as pages under the map, like the client's questions: whatever doesn't fit on
  // one page goes on the next, and the last page is the offer.
  const hasAccess = load.pickup.floor > 0 || load.dropoff.floor > 0 || load.itemOptions.length > 0 || load.helpers > 0 || load.rideAlong;
  const hasMedia = !!load.notes || !!load.voiceNote || (load.media?.length ?? 0) > 0;
  const pages = ['trip', 'load', ...(hasAccess ? ['access'] : []), ...(hasMedia ? ['media'] : []), 'offer'] as const;
  const [page, setPage] = useState(0);
  const current = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/driver'));
  const kinds = kindsOf(load);

  const map = (
    <View style={{ flex: 1 }}>
      <FreightMap
        fill
        bare
        style={{ flex: 1, borderRadius: 0 }}
        inset={{ top: 96, bottom: 48 }}
        markers={[
          { id: 'from', kind: 'pickup', lat: load.from.lat, lng: load.from.lng, label: t('map.pickup') },
          { id: 'to', kind: 'dropoff', lat: load.to.lat, lng: load.to.lng, label: t('map.dropoff') },
        ]}
        route={[load.from, load.to]}
        focus={[load.from, load.to]}
        focusKey={load.id}
      />
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
        <View style={{ flex: 1 }} />
        <View style={[styles.badge, { backgroundColor: example ? colors.accentFill : colors.successFill }]}>
          <Text variant="caption" color={colors.onPrimary}>
            {example ? t('driver.example') : t('driver.live')}
          </Text>
        </View>
      </View>
    </View>
  );

  const footer = !last ? (
    <Button title={t('quest.next')} variant="primary" sound="whoosh" onPress={() => setPage(page + 1)} />
  ) : !blocker && editing ? (
    <Button
      title={busy ? t('login.sending') : t('driver.sendOffer', { price: formatMoney(t, price) })}
      variant="accent"
      icon="paper-plane-outline"
      sound={null}
      disabled={busy || (needsCommitment && !committed)}
      onPress={submit}
    />
  ) : undefined;

  return (
    <>
      <QuestScreen
        top={map}
        topHeight={Math.round(screen * (screen < 700 ? 0.4 : 0.45))}
        stepKey={current}
        progress={(page + 1) / pages.length}
        title={t(`driver.page_${current}`)}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={() => (page > 0 ? setPage(page - 1) : leave())}
        onClose={leave}
        footer={footer}>
        {current === 'trip' && (
          <View style={{ gap: Spacing.sm }}>
            <View style={[styles.ends, { backgroundColor: colors.surface }]}>
              <End icon="package-variant-closed" fill={colors.primaryFill} tint={colors.primary} label={t('map.pickup')} value={names.label(load.from)} />
              <End icon="flag-checkered" fill={colors.accentFill} tint={colors.accent} label={t('map.dropoff')} value={names.label(load.to)} />
            </View>
            <View style={[styles.ticket, { backgroundColor: colors.successFill, borderColor: colors.success }]}>
              <Shimmer every={3200} color="rgba(255,255,255,0.3)" />
              <Text variant="caption" color={colors.onPrimary}>
                {example ? t('driver.clientOffers') : t('driver.clientOffersName', { name: load.clientName })}
              </Text>
              <CountUp value={load.price} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.onPrimary} style={styles.ticketPrice} />
              <Text variant="caption" color={colors.onPrimary}>
                {t('request.distance', { km: load.km })}
              </Text>
            </View>
          </View>
        )}
        {current === 'load' && (
          <View style={styles.tags}>
            {kinds.map((kind) => (
              <Fact key={kind} icon="cube-outline" value={t(`freight.${kind}`)} />
            ))}
            <Fact icon="barbell-outline" value={formatWeight(t, load.tons, load.weightKnown !== false)} />
            <Fact
              icon={load.scheduledAt ? 'calendar-outline' : 'flash-outline'}
              value={load.scheduledAt ? dates.pickupAt(load.scheduledAt) : load.pickupWindow === '1h' ? t('request.whenHour') : t('request.whenAsap')}
            />
            <Fact icon="car-outline" value={t('driver.prefersVehicle', { vehicle: t(`vehicle.${load.vehicle}`) })} />
            {otherVehicle && fits && (
              <View style={[styles.tag, { backgroundColor: colors.successSoft }]}>
                <Text variant="caption" color={colors.success}>
                  {t('driver.anyVehicleOk', { vehicle: t(`vehicle.${load.vehicle}`) })}
                </Text>
              </View>
            )}
            {!fits && (
              <View style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                <Text variant="caption" color={colors.accent}>
                  {t('driver.tooHeavy')}
                </Text>
              </View>
            )}
          </View>
        )}
        {current === 'access' && (
          <View style={styles.tags}>
            {load.helpers > 0 && <Fact icon="people-outline" value={t('driver.helpers', { count: load.helpers })} />}
            {load.rideAlong && <Fact icon="person-add-outline" value={t('driver.rideAlong')} />}
            {load.pickup.floor > 0 && <Fact icon="arrow-up-circle-outline" value={`${t('request.atPickup')}: ${describePlace(t, load.pickup)}`} />}
            {load.dropoff.floor > 0 && <Fact icon="arrow-down-circle-outline" value={`${t('request.atDropoff')}: ${describePlace(t, load.dropoff)}`} />}
            {ITEM_OPTIONS.filter((option) => load.itemOptions.includes(option.id)).map((option) => (
              <View key={option.id} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name={option.icon} size={14} color={colors.accent} />
                <Text variant="caption" color={colors.accent}>
                  {t(option.key)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {current === 'media' && (
          <View style={{ gap: Spacing.sm }}>
            {!!load.notes && <Detail icon="chatbubble-ellipses-outline" value={load.notes} />}
            <LoadAttachments request={load} />
          </View>
        )}
        {current === 'offer' && (
          <View style={{ gap: Spacing.sm }}>
            {blocker === 'closed' && liveOffer?.status === 'accepted' && load.jobId ? (
              <>
                <Notice icon="checkmark-circle" tone={colors.success} title={t('live.offerAccepted')} body={t('driver.acceptedBody')} />
                <Button
                  title={t('driver.openJob')}
                  variant="accent"
                  icon="navigate-outline"
                  onPress={() => router.replace({ pathname: '/job/[id]', params: { id: load.jobId as string } })}
                />
              </>
            ) : blocker === 'closed' ? (
              <Notice icon="lock-closed-outline" tone={colors.textMuted} title={t('driver.closedTitle')} body={t('driver.closedBody')} />
            ) : null}
            {!example && liveOffer?.status === 'declined' && load.status === 'open' && (
              <Notice icon="close-circle-outline" tone={colors.accent} title={t('live.offerDeclined')} body={t('driver.declinedBody')} />
            )}
            {blocker === 'verify' && (
              <>
                <Notice
                  icon="lock-closed-outline"
                  tone={colors.primary}
                  title={t('driver.lockedTitle')}
                  body={t('driver.lockedBody', { price: formatMoney(t, load.price), keep: formatMoney(t, commissionSplit(load.price).driverKeeps) })}
                />
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
            {blocker === 'wallet' && record && (
              <>
                <Notice
                  icon="wallet-outline"
                  tone={colors.accent}
                  title={t('wallet.lowTitle')}
                  body={t('wallet.lowBody', { commission: formatMoney(t, commission), balance: formatMoney(t, record.wallet) })}
                />
                <Button title={t('wallet.testTopUp', { amount: formatMoney(t, 200) })} sound="success" onPress={() => addTestCredit(store, record, 200)} />
              </>
            )}
            {!blocker && !editing && sent && (
              <>
                <Notice
                  icon="checkmark-circle"
                  tone={colors.success}
                  title={`${t('driver.sentTitle')}: ${formatMoney(t, sent.price)}`}
                  body={example ? t('driver.sentBodyExample') : t('driver.sentBody')}
                />
                <View style={styles.tags}>
                  <Chip label={t('driver.updateOffer')} selected={false} onPress={() => setChanging(true)} />
                  <Chip label={t('driver.withdraw')} selected={false} onPress={withdraw} />
                </View>
              </>
            )}
            {!blocker && editing && (
              <>
                <Stepper bright value={price} step={PRICE_STEP} min={PRICE_STEP} max={MAX_PRICE} onChange={setPrice} format={(value) => formatMoney(t, value)} editable unit={currencyUnit(t)} />
                <Text variant="caption" center color={colors.success}>
                  {t('driver.keepLine', { amount: formatMoney(t, driverKeeps) })} ·{' '}
                  {t('driver.commissionLine', { rate: Math.round(COMMISSION_RATE * 100), commission: formatMoney(t, commission), price: formatMoney(t, price) })}
                </Text>
                <View style={[styles.tags, { justifyContent: 'center' }]}>
                  {etaOptions.map((option) => (
                    <Chip key={option.value} label={t(option.key)} selected={eta === option.value} onPress={() => setEta(option.value)} />
                  ))}
                </View>
                {needsCommitment && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: committed }}
                    onPress={() => {
                      play('tap');
                      setCommitted(!committed);
                    }}
                    style={[styles.commit, { borderColor: committed ? colors.primary : colors.border, backgroundColor: committed ? colors.primarySoft : colors.surface }]}>
                    <Ionicons name={committed ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                    <Text variant="label" style={{ flex: 1 }}>
                      {t('driver.commitLabel', { at: dates.pickupAt(load.scheduledAt!) })}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
      </QuestScreen>
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

/** One end of the trip: its pin (violet box / red flag), what it is, and the full place name. */
function End({ icon, fill, tint, label, value }: { icon: 'package-variant-closed' | 'flag-checkered'; fill: string; tint: string; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.end}>
      <View style={[styles.endIcon, { backgroundColor: fill }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={tint}>
          {label}
        </Text>
        <Text variant="label">{value}</Text>
      </View>
    </View>
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

function Fact({ icon, value }: { icon: ComponentProps<typeof Ionicons>['name']; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text variant="caption">{value}</Text>
    </View>
  );
}

function Detail({ icon, value }: { icon: ComponentProps<typeof Ionicons>['name']; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ flex: 1 }} userText>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: Radius.pill },
  ends: { borderRadius: Radius.lg, padding: Spacing.sm, gap: Spacing.sm },
  end: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  endIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ticket: { borderRadius: Radius.lg, borderWidth: 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, overflow: 'hidden', alignItems: 'center' },
  ticketPrice: { fontSize: 28, lineHeight: 38 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  commit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5 },
});
