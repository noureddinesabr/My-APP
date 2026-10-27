import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { FreightRequest, Job, Offer, WalletEntry } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { ForwardChevron, IconButton, Screen } from '@/components/ui';
import { useColors, Radius, rim, Spacing } from '@/theme';

type Tab = 'requests' | 'trips' | 'offers' | 'bookings' | 'wallet';
type IconName = ComponentProps<typeof Ionicons>['name'];

/** Everything that happened: requests and trips for clients; offers, trips, bookings and wallet for drivers. */
export default function History() {
  const { t } = useTranslation();
  const colors = useColors();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { side, account, driverRecord } = useMyRecord();
  const driver = side === 'driver';
  const tabs: Tab[] = driver ? ['offers', 'trips', 'bookings', 'wallet'] : ['requests', 'trips'];
  const [tab, setTab] = useState<Tab>(params.tab && tabs.includes(params.tab) ? params.tab : tabs[0]);

  const requests = useQuery('requests', !driver && account ? [['clientId', account.id]] : null);
  const offers = useQuery('offers', driver && account ? [['driverId', account.id]] : null);
  const jobs = useQuery('jobs', account ? [[driver ? 'driverId' : 'clientId', account.id]] : null);
  const newestFirst = <T extends { createdAt: number }>(list: T[] | undefined) => [...(list ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  const trips = newestFirst(jobs).filter((job) => job.status !== 'scheduled');
  const bookings = newestFirst(jobs).filter((job) => job.status === 'scheduled');
  const wallet = [...(driverRecord?.walletHistory ?? [])].sort((a, b) => b.at - a.at);

  return (
    <Screen
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="title">{t('history.title')}</Text>
        </View>
      }>
      <Segmented label={t('history.title')} value={tab} onChange={setTab} options={tabs.map((value) => ({ value, label: t(`history.tab_${value}`) }))} />

      {!account && <Empty icon="log-in-outline" text={t('history.signIn')} />}

      {account && tab === 'requests' && (newestFirst(requests).length ? newestFirst(requests).map((r) => <RequestRow key={r.id} request={r} />) : <Empty icon="document-text-outline" text={t('history.emptyRequests')} />)}
      {account && tab === 'offers' && (newestFirst(offers).length ? newestFirst(offers).map((o) => <OfferRow key={o.id} offer={o} />) : <Empty icon="pricetag-outline" text={t('history.emptyOffers')} />)}
      {account && tab === 'trips' && (trips.length ? trips.map((job) => <JobRow key={job.id} job={job} driver={driver} />) : <Empty icon="car-outline" text={t('history.emptyTrips')} />)}
      {account && tab === 'bookings' && (bookings.length ? bookings.map((job) => <JobRow key={job.id} job={job} driver={driver} />) : <Empty icon="calendar-outline" text={t('history.emptyBookings')} />)}
      {account && tab === 'wallet' && (
        <>
          {driverRecord && (
            <View style={[styles.balance, { backgroundColor: colors.primarySoft }]}>
              <Text variant="caption" color={colors.primary}>
                {t('wallet.balance')}
              </Text>
              <Text variant="display" color={colors.primary}>
                {formatMoney(t, driverRecord.wallet)}
              </Text>
            </View>
          )}
          {wallet.length ? wallet.map((entry, index) => <WalletRow key={`${entry.at}-${index}`} entry={entry} />) : <Empty icon="wallet-outline" text={t('history.emptyWallet')} />}
        </>
      )}
    </Screen>
  );
}

function Row({
  icon,
  tone,
  title,
  subtitle,
  amount,
  status,
  onPress,
}: {
  icon: IconName;
  tone: string;
  title: string;
  subtitle: string;
  amount?: string;
  status?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {amount && <Text variant="label">{amount}</Text>}
        {status && (
          <Text variant="caption" color={tone}>
            {status}
          </Text>
        )}
      </View>
    </>
  );
  const style = [styles.row, { backgroundColor: colors.surface }, rim(colors)];
  return onPress ? (
    <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View style={style}>{body}</View>
  );
}

function useTone() {
  const colors = useColors();
  return (state: string) =>
    state === 'completed' || state === 'accepted' || state === 'assigned' || state === 'delivered'
      ? colors.success
      : state === 'cancelled' || state === 'declined' || state === 'withdrawn'
        ? colors.accent
        : colors.primary;
}

function RequestRow({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const tone = useTone()(request.status);
  return (
    <Row
      icon="cube-outline"
      tone={tone}
      title={names.shortRoute(request.from, request.to)}
      subtitle={dates.dayTime(new Date(request.createdAt))}
      amount={formatMoney(t, request.price)}
      status={t(`requestStatus.${request.status}`)}
      onPress={() => router.push({ pathname: '/track/[id]', params: { id: request.id } })}
    />
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const tone = useTone()(offer.status);
  return (
    <Row
      icon="pricetag-outline"
      tone={tone}
      title={t(`vehicle.${offer.vehicle}`)}
      subtitle={dates.dayTime(new Date(offer.createdAt))}
      amount={formatMoney(t, offer.price)}
      status={t(`history.offer_${offer.status}`)}
      onPress={() => router.push({ pathname: '/load/[id]', params: { id: offer.requestId } })}
    />
  );
}

function JobRow({ job, driver }: { job: Job; driver: boolean }) {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const tone = useTone()(job.status);
  return (
    <Row
      icon={job.status === 'scheduled' ? 'calendar-outline' : 'car-outline'}
      tone={tone}
      title={names.shortRoute(job.from, job.to)}
      subtitle={`${driver ? job.clientName : job.driverName} · ${job.scheduledAt ? dates.pickupAt(job.scheduledAt) : dates.dayTime(new Date(job.createdAt))}`}
      amount={formatMoney(t, job.price)}
      status={t(`status.${job.status}`)}
      onPress={() =>
        driver ? router.push({ pathname: '/job/[id]', params: { id: job.id } }) : router.push({ pathname: '/track/[id]', params: { id: job.requestId } })
      }
    />
  );
}

function WalletRow({ entry }: { entry: WalletEntry }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const credit = entry.amount > 0;
  return (
    <Row
      icon={credit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
      tone={credit ? colors.success : colors.accent}
      title={t(`history.wallet_${entry.reason}`)}
      subtitle={dates.dayTime(new Date(entry.at))}
      amount={`${credit ? '+' : '−'}${formatMoney(t, Math.abs(entry.amount))}`}
    />
  );
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text muted center>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  balance: { borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
