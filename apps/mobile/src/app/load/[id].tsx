import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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
import { Stepper } from '@/components/stepper';
import { LoadAttachments } from '@/components/media/load-attachments';
import { Text } from '@/components/text';
import { Celebration, useBecameTrue } from '@/components/motion/celebration';
import { CountUp, Shimmer } from '@/components/motion/effects';
import { Button, Card, Chip, ForwardChevron, Gradient, IconButton, Screen } from '@/components/ui';
import { isExample, sampleLoads } from '@/constants/sample-loads';
import { COMMISSION_RATE, commissionSplit, maxTons } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { useDriver, type Eta } from '@/state/driver';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

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

  const fits = !profile.vehicle || load.tons <= maxTons(profile.vehicle.type);
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

  return (
    <Screen
      overlay={
        won.shown ? (
          <Celebration
            title={t('celebrate.wonTitle')}
            body={t('celebrate.wonBody', { route: names.shortRoute(load.from, load.to), amount: formatMoney(t, liveOffer?.price ?? load.price) })}
            onDone={won.close}
          />
        ) : sentMoment ? (
          <Celebration title={t('celebrate.offerSentTitle')} body={t('celebrate.offerSentBody')} onDone={() => setSentMoment(false)} duration={2000} />
        ) : undefined
      }
      footer={
        !blocker && editing ? (
          <Button
            title={busy ? t('login.sending') : t('driver.sendOffer', { price: formatMoney(t, price) })}
            variant="accent"
            icon="paper-plane-outline"
            sound={null}
            disabled={busy || (needsCommitment && !committed)}
            onPress={submit}
          />
        ) : undefined
      }
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="subtitle" style={{ flex: 1 }}>
            {t('driver.loadTitle')}
          </Text>
          <View style={[styles.badge, { backgroundColor: example ? colors.accentSoft : colors.successSoft }]}>
            <Text variant="caption" color={example ? colors.accent : colors.success}>
              {example ? t('driver.example') : t('driver.live')}
            </Text>
          </View>
        </View>
      }>
      <FreightMap
        height={170}
        markers={[
          { id: 'from', kind: 'pickup', lat: load.from.lat, lng: load.from.lng },
          { id: 'to', kind: 'dropoff', lat: load.to.lat, lng: load.to.lng },
        ]}
        route={[load.from, load.to]}
        focus={[load.from, load.to]}
        focusKey={load.id}
      />

      <Gradient colors={Gradients.primary} style={styles.hero}>
        <Text variant="title" color={colors.onPrimary}>
          {names.shortRoute(load.from, load.to)}
        </Text>
        <Text variant="caption" color={colors.onPrimary} style={{ opacity: 0.9 }}>
          {example ? t('driver.clientOffers') : t('driver.clientOffersName', { name: load.clientName })}
        </Text>
        <CountUp value={load.price} from={0} format={(value) => formatMoney(t, value)} variant="hero" color={colors.onPrimary} />
        <Shimmer every={3600} />
      </Gradient>

      <View style={styles.tags}>
        <Fact icon="cube-outline" value={`${t(`freight.${load.freightType}`)} · ${formatWeight(t, load.tons, load.weightKnown !== false)}`} />
        <Fact
          icon={load.scheduledAt ? 'calendar-outline' : 'flash-outline'}
          value={load.scheduledAt ? dates.pickupAt(load.scheduledAt) : load.pickupWindow === '1h' ? t('request.whenHour') : t('request.whenAsap')}
        />
        <Fact icon="navigate-outline" value={t('request.distance', { km: load.km })} />
        <Fact icon="car-outline" value={t(`vehicle.${load.vehicle}`)} />
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
      {(!!load.notes || !!load.voiceNote || (load.media?.length ?? 0) > 0) && (
        <Card>
          {!!load.notes && <Detail icon="chatbubble-ellipses-outline" value={load.notes} />}
          <LoadAttachments request={load} />
        </Card>
      )}

      {blocker === 'closed' && liveOffer?.status === 'accepted' && load.jobId ? (
        <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
          <Notice icon="checkmark-circle" tone={colors.success} title={t('live.offerAccepted')} body={t('driver.acceptedBody')} />
          <Button
            title={t('driver.openJob')}
            variant="accent"
            icon="navigate-outline"
            onPress={() => router.replace({ pathname: '/job/[id]', params: { id: load.jobId as string } })}
          />
        </Card>
      ) : blocker === 'closed' ? (
        <Notice icon="lock-closed-outline" tone={colors.textMuted} title={t('driver.closedTitle')} body={t('driver.closedBody')} />
      ) : null}
      {!example && liveOffer?.status === 'declined' && load.status === 'open' && (
        <Notice icon="close-circle-outline" tone={colors.accent} title={t('live.offerDeclined')} body={t('driver.declinedBody')} />
      )}
      {blocker === 'verify' && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
          <Notice
            icon="lock-closed-outline"
            tone={colors.primary}
            title={t('driver.lockedTitle')}
            body={t('driver.lockedBody', {
              price: formatMoney(t, load.price),
              keep: formatMoney(t, commissionSplit(load.price).driverKeeps),
            })}
          />
          <Button title={t('driver.lockedCta')} onPress={() => router.replace('/driver')} />
        </Card>
      )}
      {blocker === 'signIn' && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
          <Notice icon="person-circle-outline" tone={colors.primary} title={t('driver.signInTitle')} body={t('driver.signInToOffer')} />
          <Button
            title={t('driver.signIn')}
            icon="log-in-outline"
            onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })}
          />
        </Card>
      )}
      {blocker === 'heavy' && <Notice icon="alert-circle-outline" tone={colors.accent} title={t('driver.tooHeavy')} />}
      {blocker === 'wallet' && record && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.accent }}>
          <Notice
            icon="wallet-outline"
            tone={colors.accent}
            title={t('wallet.lowTitle')}
            body={t('wallet.lowBody', { commission: formatMoney(t, commission), balance: formatMoney(t, record.wallet) })}
          />
          <Button
            title={t('wallet.testTopUp', { amount: formatMoney(t, 200) })}
            sound="success"
            onPress={() => addTestCredit(store, record, 200)}
          />
        </Card>
      )}

      {!blocker && !editing && sent && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
          <Notice
            icon="checkmark-circle"
            tone={colors.success}
            title={`${t('driver.sentTitle')}: ${formatMoney(t, sent.price)}`}
            body={example ? t('driver.sentBodyExample') : t('driver.sentBody')}
          />
          <Button title={t('driver.updateOffer')} variant="ghost" onPress={() => setChanging(true)} />
          <Button title={t('driver.withdraw')} variant="ghost" onPress={withdraw} />
        </Card>
      )}

      {!blocker && editing && (
        <Card>
          <Text variant="label">{t('driver.yourOffer')}</Text>
          <Stepper
            value={price}
            step={PRICE_STEP}
            min={PRICE_STEP}
            max={MAX_PRICE}
            onChange={setPrice}
            format={(value) => formatMoney(t, value)}
            editable
            unit={currencyUnit(t)}
          />
          <View style={[styles.split, { backgroundColor: colors.successSoft }]}>
            <Text variant="subtitle" color={colors.success}>
              {t('driver.keepLine', { amount: formatMoney(t, driverKeeps) })}
            </Text>
            <Text variant="caption" muted>
              {t('driver.commissionLine', {
                rate: Math.round(COMMISSION_RATE * 100),
                commission: formatMoney(t, commission),
                price: formatMoney(t, price),
              })}
            </Text>
          </View>
          <View style={styles.tags}>
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
              style={[
                styles.commit,
                {
                  borderColor: committed ? colors.primary : colors.border,
                  backgroundColor: committed ? colors.primarySoft : colors.surface,
                },
              ]}>
              <Ionicons name={committed ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{t('driver.commitLabel', { at: dates.pickupAt(load.scheduledAt!) })}</Text>
                <Text variant="caption" muted>
                  {t('driver.commitHint')}
                </Text>
              </View>
            </Pressable>
          )}
        </Card>
      )}
    </Screen>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.xs, overflow: 'hidden' },
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
  split: { padding: Spacing.md, borderRadius: Radius.sm, gap: 2 },
  commit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5 },
});
