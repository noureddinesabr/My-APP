import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useQuery } from '@/backend';
import type { Job } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { Callout, CalloutSlot } from '@/components/callout';
import { LoadCard } from '@/components/driver/load-card';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { FitPanel, QuestProgress, Rise } from '@/components/motion/quest';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { Glass } from '@/components/glass';
import { getCity } from '@/constants/cities';
import { useLanguage } from '@/i18n/language-provider';
import { Celebration } from '@/components/motion/celebration';
import { CountUp, PulseDot, Shimmer } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { Button, ForwardChevron } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { maxTons } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { useDriver, verificationSteps } from '@/state/driver';
import { Fonts, Gradients, Radius, rim, softShadow, Spacing, useColors } from '@/theme';

/** A booking this close is the predicted next step. */
const SOON_MS = 3 * 3_600_000;

export default function DriverHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { profile, update, reset } = useDriver();
  const { account, record } = useDriverRecord();
  const invoices = useDriverInvoices(account);
  const dueInvoice = invoices.unpaid.find((invoice) => invoice.status === 'open');
  const examples = useMemo(() => sampleLoads(), []);
  const openRequests = useQuery('requests', [['status', 'open']]);
  const myOffers = useQuery('offers', account ? [['driverId', account.id]] : null);
  const myJobs = useQuery('jobs', account ? [['driverId', account.id]] : null);
  const { height: screenHeight } = useWindowDimensions();
  // Same split as the client's screens: the map keeps the top 40–45%.
  const panelHeight = screenHeight - Math.round(screenHeight * (screenHeight < 700 ? 0.4 : 0.45)) + Radius.xl;
  const [page, setPage] = useState(0);
  const { rtl } = useLanguage();
  const drag = useSharedValue(0);
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
  ) : invoices.paused ? (
    <Callout icon="pause-circle" tone="accent" title={t('invoice.pausedTitle')} body={t('invoice.pausedShort')} onPress={() => router.push('/invoices')} />
  ) : dueInvoice ? (
    <Callout
      icon="receipt"
      title={t('invoice.newTitle', { amount: formatMoney(t, dueInvoice.totalShare) })}
      body={t('invoice.newBody', { date: dates.dayMonth(dueInvoice.dueAt) })}
      onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: dueInvoice.id } })}
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
  if (activeJob) blocks.push({ key: 'active', units: 1.9, node: <LiveJobTile job={activeJob} onPress={() => openJob(activeJob)} /> });
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
  const turn = (delta: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, page + delta));
    if (next === page) return;
    play('whoosh');
    setPage(next);
  };
  // Swipe the panel to turn pages: towards the reading direction's end for the next page
  // (right to left in Arabic, left to right in French and English). The buttons still work.
  const pan = usePanGesture({
    activeOffsetX: [-18, 18],
    failOffsetY: [-14, 14],
    onUpdate: (event) => {
      drag.set(event.translationX * 0.35);
    },
    onDeactivate: (event) => {
      const far = Math.abs(event.translationX) > 50 || Math.abs(event.velocityX) > 600;
      if (far) scheduleOnRN(turn, (event.translationX < 0) !== rtl ? 1 : -1);
      drag.set(withSpring(0, { damping: 16, stiffness: 180 }));
    },
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }] }));
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
          {record && <WeekChip share={invoices.thisWeek.share} owed={invoices.owed} />}
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
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, dragStyle]}>
            <FitPanel>
              <View key={page} style={{ gap: Spacing.sm }}>
                {shown.map((block, index) => (
                  <Rise key={block.key} index={index}>
                    {block.node}
                  </Rise>
                ))}
              </View>
            </FitPanel>
          </Animated.View>
        </GestureDetector>
        {pages.length > 1 && (
          <View style={styles.pager}>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('common.back')} scaleTo={0.9} disabled={page === 0} onPress={() => turn(-1)} style={[styles.pageButton, { backgroundColor: colors.primarySoft, opacity: page === 0 ? 0.4 : 1 }]}>
              <ForwardChevron color={colors.primary} flip />
            </PressableScale>
            <Text variant="label" color={colors.primary}>
              {page + 1} / {pages.length}
            </Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('quest.next')} scaleTo={0.9} disabled={page >= pages.length - 1} onPress={() => turn(1)} style={[styles.pageButton, { backgroundColor: colors.primaryFill, opacity: page >= pages.length - 1 ? 0.4 : 1 }]}>
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

/**
 * Over the map: the app's share of this week's cash trips so far (or what's owed on an
 * invoice). No wallet and nothing to top up; tapping opens the invoices.
 */
function WeekChip({ share, owed }: { share: number; owed: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const due = owed > 0;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={t('invoice.listTitle')} scaleTo={0.94} onPress={() => router.push('/invoices')}>
      <Glass style={[styles.walletChip, due && { borderWidth: 1.5, borderColor: colors.star }]} thickness="thick">
        <MaterialCommunityIcons name="receipt" size={18} color={due ? colors.star : colors.primary} />
        <View>
          <Text variant="caption" muted style={styles.weekLabel}>
            {due ? t('invoice.chipDue') : t('invoice.chipWeek')}
          </Text>
          <CountUp value={due ? owed : share} from={0} format={(value) => formatMoney(t, value)} variant="label" color={colors.text} />
        </View>
      </Glass>
    </PressableScale>
  );
}

/**
 * The job under way, as an announcement that can't be missed: a glowing green banner with a
 * LIVE badge, a megaphone that keeps ringing, the trip in big letters, where it is now and the
 * price on a gold tag. Tapping it opens the job.
 */
function LiveJobTile({ job, onPress }: { job: Job; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const still = useReducedMotion();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    ring.set(withRepeat(withSequence(withTiming(1, { duration: 120 }), withTiming(-1, { duration: 120 }), withTiming(1, { duration: 120 }), withTiming(0, { duration: 120 }), withTiming(0, { duration: 1400 })), -1, false));
  }, [ring, still]);
  const shake = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.get() * 14}deg` }, { scale: 1 + Math.abs(ring.get()) * 0.08 }] }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('driver.activeJob')}: ${names.shortRoute(job.from, job.to)}`}
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.announce, { borderColor: colors.success }, softShadow(colors.successFill, 1.4)]}>
      <LinearGradient colors={[...Gradients.success]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Shimmer every={2600} color="rgba(255,255,255,0.28)" />
      <View style={styles.announceTop}>
        <View style={[styles.liveBadge, { backgroundColor: colors.onPrimary }]}>
          <PulseDot color={colors.successFill} size={8} />
          <Text variant="caption" color={colors.successFill} style={styles.liveText}>
            {t('driver.activeJob')}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[styles.priceTag, { backgroundColor: colors.star }]}>
          <Text variant="label" color={colors.background} style={styles.priceText}>
            {formatMoney(t, job.price)}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <Animated.View style={[styles.horn, { backgroundColor: 'rgba(255,255,255,0.2)' }, shake]}>
          <MaterialCommunityIcons name="bullhorn" size={24} color={colors.onPrimary} />
        </Animated.View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subtitle" color={colors.onPrimary} style={styles.announceRoute}>
            {names.shortRoute(job.from, job.to)}
          </Text>
          <Text variant="label" color={colors.onPrimary} style={{ opacity: 0.92 }}>
            {t(`status.${job.status}`)}
          </Text>
        </View>
        <View style={[styles.openCircle, { backgroundColor: colors.onPrimary }]}>
          <ForwardChevron color={colors.successFill} />
        </View>
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
  walletChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 22 },
  weekLabel: { fontSize: 12, lineHeight: 15 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  pageButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  announce: { borderRadius: Radius.lg, borderWidth: 2, padding: Spacing.md, gap: Spacing.sm, overflow: 'hidden' },
  announceTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm + 2, paddingVertical: 2, borderRadius: Radius.pill },
  liveText: { fontFamily: Fonts.extrabold, fontSize: 13, lineHeight: 18 },
  priceTag: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  priceText: { fontFamily: Fonts.extrabold },
  horn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  announceRoute: { fontSize: 20, lineHeight: 28 },
  openCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  booking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  walletIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
