import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAnimatedRef } from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';

import { addTestCredit } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { DriverRecord, Job } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { Callout, CalloutSlot } from '@/components/callout';
import { LoadCard } from '@/components/driver/load-card';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { HomeHeader } from '@/components/home-header';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { QuestProgress, Rise } from '@/components/motion/quest';
import { TruckScene } from '@/components/motion/scenes';
import { Celebration } from '@/components/motion/celebration';
import { CountUp, Float, PulseDot, Shimmer } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, Screen } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { maxTons } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { useDriver, verificationSteps } from '@/state/driver';
import { Radius, rim, Spacing, useColors } from '@/theme';

const TEST_TOP_UP = 200;
/** Below this balance the driver soon can't pay commission on a new job. */
const LOW_WALLET = 50;
/** A booking this close is the predicted next step. */
const SOON_MS = 3 * 3_600_000;

export default function DriverHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { profile, update, reset } = useDriver();
  const { account, record } = useDriverRecord();
  const examples = useMemo(() => sampleLoads(), []);
  const openRequests = useQuery('requests', [['status', 'open']]);
  const myOffers = useQuery('offers', account ? [['driverId', account.id]] : null);
  const myJobs = useQuery('jobs', account ? [['driverId', account.id]] : null);
  const scroll = useAnimatedRef<Animated.ScrollView>();
  // Read once per render for the "soon" check; refreshed by the live data updates.
  const [now] = useState(() => Date.now());

  const steps = verificationSteps(profile);
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const capacity = profile.vehicle ? maxTons(profile.vehicle.type) : Infinity;
  const offered = new Set([
    ...(myOffers ?? []).filter((offer) => offer.status === 'pending').map((offer) => offer.requestId),
    ...Object.keys(profile.offers),
  ]);
  const live = [...(openRequests ?? [])].filter((request) => request.clientId !== account?.id).sort((a, b) => b.createdAt - a.createdAt);
  const openJobs = (myJobs ?? []).filter((job) => job.status !== 'completed' && job.status !== 'cancelled');
  const activeJob = openJobs.find((job) => job.status !== 'scheduled');
  const upcoming = openJobs
    .filter((job) => job.status === 'scheduled')
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  const next = upcoming[0];

  // A new job appearing while the driver is here means a client just accepted their offer.
  const jobCount = myJobs === undefined ? null : openJobs.length;
  const [knownJobs, setKnownJobs] = useState(jobCount);
  const [won, setWon] = useState<Job | null>(null);
  if (jobCount !== knownJobs) {
    if (knownJobs !== null && jobCount !== null && jobCount > knownJobs) {
      setWon([...openJobs].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null);
    }
    setKnownJobs(jobCount);
  }
  const nextSoon = next?.scheduledAt ? fromLocalString(next.scheduledAt).getTime() - now < SOON_MS : false;

  const nextAction = !profile.vehicle
    ? { title: t('driver.ctaVehicle'), go: () => router.push('/driver-vehicle') }
    : !allDone
      ? { title: t('driver.ctaDocuments'), go: () => router.push('/driver-documents') }
      : { title: t('driver.ctaSubmit'), go: () => update({ status: 'pending' }) };

  // Test mode: skip document checks with a default vehicle, to test what happens next.
  const skipChecks = () => {
    play('success');
    update({
      status: 'approved',
      vehicle: profile.vehicle ?? { type: 'truck35', plate: '12345-A-6', homeCity: 'casablanca' },
    });
  };

  const openJob = (job: Job) => router.push({ pathname: '/job/[id]', params: { id: job.id } });

  // The predicted next step, by urgency.
  const callout = activeJob ? (
    <Callout
      icon="navigate"
      tone="success"
      title={t('home.continueTrip')}
      body={`${t(`status.${activeJob.status}`)} · ${names.shortRoute(activeJob.from, activeJob.to)}`}
      onPress={() => openJob(activeJob)}
    />
  ) : next && nextSoon && next.scheduledAt ? (
    <Callout icon="alarm" title={t('home.pickupSoon')} body={dates.pickupAt(next.scheduledAt)} onPress={() => openJob(next)} />
  ) : record && record.wallet < LOW_WALLET ? (
    <Callout
      icon="wallet"
      tone="accent"
      title={t('home.lowWallet')}
      body={t('home.lowWalletBody')}
      onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })}
    />
  ) : undefined;

  return (
    <Screen
      glow
      scrollRef={scroll}
      header={<HomeHeader title={account ? t('driver.hello', { name: account.name.split(' ')[0] }) : t('driver.greeting')} />}
      overlay={
        <>
          <CalloutSlot top={88}>{callout}</CalloutSlot>
          {won && (
            <Celebration
              title={t('celebrate.wonTitle')}
              body={t('celebrate.wonBody', { route: names.shortRoute(won.from, won.to), amount: formatMoney(t, won.price) })}
              onDone={() => setWon(null)}
            />
          )}
        </>
      }>
      {!account && (
        <Rise index={0}>
          <Card>
            <View style={styles.row}>
              <MaterialCommunityIcons name="account-circle-outline" size={28} color={colors.primary} />
              <Text variant="subtitle" style={{ flex: 1 }}>
                {t('driver.signInTitle')}
              </Text>
            </View>
            <Button title={t('driver.signIn')} icon="log-in-outline" onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
          </Card>
        </Rise>
      )}

      {profile.status === 'draft' && (
        <Rise index={1}>
          <Card>
            <View style={styles.row}>
              <MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.primary} />
              <Text variant="subtitle" style={{ flex: 1 }}>
                {t('driver.verifyTitle')}
              </Text>
              <Text variant="label" color={colors.primary}>
                {doneCount}/{steps.length}
              </Text>
            </View>
            <QuestProgress value={doneCount / steps.length} />
            <Button title={nextAction.title} variant="accent" onPress={nextAction.go} />
            <TestLink label={t('driver.skipChecks')} onPress={skipChecks} />
          </Card>
        </Rise>
      )}
      {profile.status === 'pending' && (
        <Rise index={1}>
          <Card>
            <View style={styles.row}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color={colors.primary} />
              <Text variant="subtitle" style={{ flex: 1 }}>
                {t('driver.pendingTitle')}
              </Text>
            </View>
            <TestLink label={t('driver.testApprove')} onPress={skipChecks} />
          </Card>
        </Rise>
      )}

      {activeJob ? (
        <Rise index={2}>
          <LiveJobTile job={activeJob} onPress={() => openJob(activeJob)} />
        </Rise>
      ) : next && next.scheduledAt ? (
        <Rise index={2}>
          <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => openJob(next)} style={[styles.booking, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="calendar-check" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="subtitle" color={colors.primary}>
                {dates.pickupAt(next.scheduledAt)}
              </Text>
              <Text variant="caption" color={colors.primary} numberOfLines={1}>
                {names.shortRoute(next.from, next.to)} · {formatMoney(t, next.price)}
              </Text>
            </View>
            <ForwardChevron color={colors.primary} />
          </PressableScale>
        </Rise>
      ) : null}

      {record && (
        <Rise index={3}>
          <WalletRow record={record} />
        </Rise>
      )}

      <Rise index={4} style={styles.feedTitle}>
        <PulseDot color={live.length ? colors.success : colors.textMuted} />
        <Text variant="title" style={{ flex: 1 }}>
          {t('driver.liveTitle')}
        </Text>
        {live.length > 0 && <CountUp value={live.length} variant="title" color={colors.primary} />}
      </Rise>
      {live.map((load, index) => (
        <Rise key={load.id} index={5 + Math.min(index, 4)}>
          <LoadCard load={load} fits={load.tons <= capacity} offered={offered.has(load.id)} />
        </Rise>
      ))}
      {live.length === 0 && (
        <Rise index={5}>
          <TruckScene height={110} style={styles.scene} />
          <Text variant="body" muted center>
            {t('driver.liveEmpty')}
          </Text>
        </Rise>
      )}

      <Text variant="subtitle" style={{ marginTop: Spacing.md }}>
        {t('driver.practiceTitle')}
      </Text>
      {examples.map((load) => (
        <LoadCard key={load.id} load={load} fits={load.tons <= capacity} offered={offered.has(load.id)} />
      ))}

      <Pressable accessibilityRole="button" onPress={reset} style={[styles.reset, { borderColor: colors.border }]}>
        <Ionicons name="refresh" size={16} color={colors.textMuted} />
        <Text variant="caption" muted>
          {t('driver.resetTest')}
        </Text>
      </Pressable>
    </Screen>
  );
}

/** The wallet in one line: what's left to pay commission with, and (test) a top-up. */
function WalletRow({ record }: { record: DriverRecord }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const low = record.wallet < LOW_WALLET;
  return (
    <View style={[styles.wallet, { backgroundColor: colors.surface }, rim(colors), low && { borderColor: colors.accent }]}>
      <View style={[styles.walletIcon, { backgroundColor: low ? colors.accentSoft : colors.primarySoft }]}>
        <Ionicons name="wallet" size={22} color={low ? colors.accent : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {t('wallet.balance')}
        </Text>
        <CountUp value={record.wallet} from={0} format={(value) => formatMoney(t, value)} variant="title" />
      </View>
      <PressableScale
        accessibilityRole="button"
        feedback={null}
        scaleTo={0.92}
        onPress={() => {
          play('success');
          addTestCredit(store, record, TEST_TOP_UP);
        }}
        style={[styles.topUp, { backgroundColor: colors.primaryFill }]}>
        <Ionicons name="add" size={18} color={colors.onPrimary} />
        <Text variant="caption" color={colors.onPrimary}>
          {t('home.topUp')}
        </Text>
      </PressableScale>
    </View>
  );
}

function LiveJobTile({ job, onPress }: { job: Job; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={t('driver.activeJob')} scaleTo={0.98} onPress={onPress} style={[styles.booking, { backgroundColor: colors.primaryFill }]}>
      <Shimmer />
      <View style={styles.row}>
        <Float>
          <MaterialCommunityIcons name="truck-fast" size={30} color={colors.onHero} />
        </Float>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('driver.activeJob')}
          </Text>
          <Text variant="subtitle" color={colors.onHero} numberOfLines={1}>
            {names.shortRoute(job.from, job.to)}
          </Text>
          <Text variant="caption" color={colors.onHero}>
            {t(`status.${job.status}`)} · {formatMoney(t, job.price)}
          </Text>
        </View>
        <ForwardChevron color={colors.onHero} />
      </View>
    </PressableScale>
  );
}

function TestLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.testLink}>
      <MaterialCommunityIcons name="flask-outline" size={16} color={colors.accent} />
      <Text variant="caption" color={colors.accent}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  booking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  walletIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topUp: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: Radius.pill },
  feedTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  scene: { borderRadius: Radius.lg, marginBottom: Spacing.sm },
  testLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minHeight: 40 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  testBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  verified: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
  upcomingIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
