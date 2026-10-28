import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { addTestCredit } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { DriverRecord, Job } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { Callout, CalloutSlot } from '@/components/callout';
import { LoadCard } from '@/components/driver/load-card';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { FitPanel, QuestProgress, Rise } from '@/components/motion/quest';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { Glass } from '@/components/glass';
import { getCity } from '@/constants/cities';
import { Celebration } from '@/components/motion/celebration';
import { CountUp, Float, PulseDot, Shimmer } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { Button, ForwardChevron } from '@/components/ui';
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
  const { height: screenHeight } = useWindowDimensions();
  // Same split as the client's screens: the map keeps the top 40–45%.
  const panelHeight = screenHeight - Math.round(screenHeight * (screenHeight < 700 ? 0.4 : 0.45)) + Radius.xl;
  const [page, setPage] = useState(0);
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
  // Back to the first page when the cards at the top change (signed in, approved, a new job).
  const statusKey = `${!!account}|${profile.status}|${activeJob?.id ?? ''}`;
  const [shownStatus, setShownStatus] = useState(statusKey);
  if (shownStatus !== statusKey) {
    setShownStatus(statusKey);
    setPage(0);
  }
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
      onPress={() => setPage(0)}
    />
  ) : undefined;

  // Same layout as the client's home: the map on top (the open requests as pins around the
  // driver), and under it a panel with one page of requests at a time.
  type Block = { key: string; units: number; node: ReactNode };
  const blocks: Block[] = [];
  if (!account)
    blocks.push({
      key: 'signIn',
      units: 1.4,
      node: (
        <View style={[styles.notice, { backgroundColor: colors.surface }, rim(colors)]}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-circle-outline" size={26} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {t('driver.signInTitle')}
            </Text>
          </View>
          <Button title={t('driver.signIn')} icon="log-in-outline" onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
        </View>
      ),
    });
  if (profile.status === 'draft')
    blocks.push({
      key: 'verify',
      units: 2.2,
      node: (
        <View style={[styles.notice, { backgroundColor: colors.surface }, rim(colors)]}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="shield-check-outline" size={26} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {t('driver.verifyTitle')}
            </Text>
            <Text variant="label" color={colors.primary}>
              {doneCount}/{steps.length}
            </Text>
          </View>
          <QuestProgress value={doneCount / steps.length} />
          <Button title={nextAction.title} variant="accent" onPress={nextAction.go} />
          <TestLink label={t('driver.skipChecks')} onPress={skipChecks} />
        </View>
      ),
    });
  if (profile.status === 'pending')
    blocks.push({
      key: 'pending',
      units: 1.4,
      node: (
        <View style={[styles.notice, { backgroundColor: colors.surface }, rim(colors)]}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={26} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {t('driver.pendingTitle')}
            </Text>
          </View>
          <TestLink label={t('driver.testApprove')} onPress={skipChecks} />
        </View>
      ),
    });
  if (activeJob) blocks.push({ key: 'active', units: 1.3, node: <LiveJobTile job={activeJob} onPress={() => openJob(activeJob)} /> });
  else if (next && next.scheduledAt)
    blocks.push({
      key: 'next',
      units: 1,
      node: (
        <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => openJob(next)} style={[styles.booking, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="calendar-check" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.primary}>
              {dates.pickupAt(next.scheduledAt)}
            </Text>
            <Text variant="caption" color={colors.primary}>
              {names.shortRoute(next.from, next.to)} · {formatMoney(t, next.price)}
            </Text>
          </View>
          <ForwardChevron color={colors.primary} />
        </PressableScale>
      ),
    });
  const card = (load: (typeof live)[number]) => (
    <LoadCard load={load} fits={load.weightKnown === false || load.tons <= capacity} otherVehicle={!!profile.vehicle && profile.vehicle.type !== load.vehicle} offered={offered.has(load.id)} />
  );
  live.forEach((load) => blocks.push({ key: load.id, units: 1.7, node: card(load) }));
  if (!live.length)
    blocks.push({
      key: 'empty',
      units: 1,
      node: (
        <Text variant="body" muted center>
          {t('driver.liveEmpty')}
        </Text>
      ),
    });
  blocks.push({ key: 'practice', units: 0.5, node: <Text variant="label">{t('driver.practiceTitle')}</Text> });
  examples.forEach((load) => blocks.push({ key: load.id, units: 1.7, node: card(load) }));
  blocks.push({
    key: 'reset',
    units: 0.5,
    node: (
      <Pressable accessibilityRole="button" onPress={reset} style={[styles.reset, { borderColor: colors.border }]}>
        <Ionicons name="refresh" size={16} color={colors.textMuted} />
        <Text variant="caption" muted>
          {t('driver.resetTest')}
        </Text>
      </Pressable>
    ),
  });

  // Pages of blocks that fit the panel (no scrolling); arrows move between them.
  const capacityUnits = Math.max(2, (panelHeight - 140) / ROW);
  const pages: Block[][] = [[]];
  let used = 0;
  for (const block of blocks) {
    if (used + block.units > capacityUnits && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block);
    used += block.units;
  }
  const shown = pages[Math.min(page, pages.length - 1)];
  const pins = live.slice(0, 30).map((load) => ({ id: load.id, kind: 'load' as const, lat: load.from.lat, lng: load.from.lng, label: formatMoney(t, load.price) }));
  const home = profile.vehicle?.homeCity ? getCity(profile.vehicle.homeCity) : getCity('casablanca');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <FreightMap
          bare
          fill
          style={StyleSheet.absoluteFill}
          inset={{ top: 80, bottom: 40 }}
          markers={pins}
          focus={pins.length ? pins : [home]}
          focusKey={`${pins.length}|${home.lat}`}
        />
        <View style={styles.mapTop} pointerEvents="box-none">
          <MenuButton badge={openJobs.length} />
          <View style={{ flex: 1 }} />
          {record && <WalletChip record={record} />}
        </View>
      </View>

      <View style={[styles.panel, { height: panelHeight, backgroundColor: colors.surfaceRaised }, rim(colors)]}>
        <View style={styles.feedTitle}>
          <PulseDot color={live.length ? colors.success : colors.textMuted} />
          <Text variant="title" style={{ flex: 1, fontSize: 20, lineHeight: 28 }}>
            {account ? t('driver.hello', { name: account.name.split(' ')[0] }) : t('driver.liveTitle')}
          </Text>
          {live.length > 0 && <CountUp value={live.length} variant="title" color={colors.primary} />}
        </View>
        <FitPanel>
          <View key={page} style={{ gap: Spacing.sm }}>
            {shown.map((block, index) => (
              <Rise key={block.key} index={index}>
                {block.node}
              </Rise>
            ))}
          </View>
        </FitPanel>
        {pages.length > 1 && (
          <View style={styles.pager}>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('common.back')} scaleTo={0.9} disabled={page === 0} onPress={() => setPage(page - 1)} style={[styles.pageButton, { backgroundColor: colors.primarySoft, opacity: page === 0 ? 0.4 : 1 }]}>
              <ForwardChevron color={colors.primary} flip />
            </PressableScale>
            <Text variant="label" color={colors.primary}>
              {page + 1} / {pages.length}
            </Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('quest.next')} scaleTo={0.9} disabled={page >= pages.length - 1} onPress={() => { play('whoosh'); setPage(page + 1); }} style={[styles.pageButton, { backgroundColor: colors.primaryFill, opacity: page >= pages.length - 1 ? 0.4 : 1 }]}>
              <ForwardChevron color={colors.onPrimary} />
            </PressableScale>
          </View>
        )}
      </View>

      <CalloutSlot>{callout}</CalloutSlot>
      {won && (
        <Celebration
          overMap
          title={t('celebrate.wonTitle')}
          body={t('celebrate.wonBody', { route: names.shortRoute(won.from, won.to), amount: formatMoney(t, won.price) })}
          onDone={() => setWon(null)}
        />
      )}
    </View>
  );
}

/** The wallet as a chip over the map: what's left to pay commission with, and (test) a top-up. */
function WalletChip({ record }: { record: DriverRecord }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const low = record.wallet < LOW_WALLET;
  return (
    <Glass style={[styles.walletChip, low && { borderWidth: 1.5, borderColor: colors.accent }]} thickness="thick">
      <Ionicons name="wallet" size={18} color={low ? colors.accent : colors.primary} />
      <CountUp value={record.wallet} from={0} format={(value) => formatMoney(t, value)} variant="label" color={low ? colors.accent : colors.text} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('home.topUp')}
        feedback={null}
        scaleTo={0.9}
        onPress={() => {
          play('success');
          addTestCredit(store, record, TEST_TOP_UP);
        }}
        style={[styles.topUp, { backgroundColor: colors.primaryFill }]}>
        <Ionicons name="add" size={16} color={colors.onPrimary} />
      </PressableScale>
    </Glass>
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
          <Text variant="subtitle" color={colors.onHero}>
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

/** Height of one row of the request list in the panel. */
const ROW = 76;

const styles = StyleSheet.create({
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  panel: { marginTop: -Radius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderBottomWidth: 0 },
  notice: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  walletChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingStart: Spacing.md, paddingEnd: 4, height: 44, borderRadius: 22 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  pageButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  booking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  walletIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topUp: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
