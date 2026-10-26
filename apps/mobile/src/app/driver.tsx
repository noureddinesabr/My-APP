import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAnimatedRef } from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';

import { addTestCredit } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { DriverRecord, Job } from '@/backend/types';
import { BentoGrid, BentoRow, BentoStack, BentoTile } from '@/components/bento';
import { useCityName } from '@/components/city-picker';
import { useDateFormat } from '@/components/date-format';
import { Callout, Dock } from '@/components/dock';
import { LoadCard } from '@/components/driver/load-card';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { STEP_LABELS } from '@/components/driver/verification';
import { HomeHeader } from '@/components/home-header';
import { LevelBadge } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { ProgressSteps } from '@/components/progress-steps';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, RoundAction, Screen } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { maxTons } from '@/lib/pricing';
import { fromLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { levelFor, reliability } from '@/lib/trip';
import { useDriver, verificationSteps } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

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
  const { account, record, approved } = useDriverRecord();
  const examples = useMemo(() => sampleLoads(), []);
  const openRequests = useQuery('requests', [['status', 'open']]);
  const myOffers = useQuery('offers', account ? [['driverId', account.id]] : null);
  const myJobs = useQuery('jobs', account ? [['driverId', account.id]] : null);
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const [liveY, setLiveY] = useState(0);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
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
  const toLoads = () => scroll.current?.scrollTo({ y: Math.max(0, liveY - 96), animated: true });

  // The predicted next step, by urgency.
  const callout = activeJob ? (
    <Callout
      icon="navigate"
      tone="success"
      title={t('home.continueTrip')}
      body={`${t(`status.${activeJob.status}`)} · ${names.cityRoute(activeJob.from, activeJob.to)}`}
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
        <Dock
          callout={callout}
          items={[
            {
              key: 'home',
              icon: 'home',
              label: t('home.tabHome'),
              active: true,
              onPress: () => scroll.current?.scrollTo({ y: 0, animated: true }),
            },
            {
              key: 'upcoming',
              icon: 'calendar',
              label: t('home.tabUpcoming'),
              badge: upcoming.length,
              onPress: () => setUpcomingOpen(true),
            },
            { key: 'loads', icon: 'search', label: t('home.tabLoads'), main: true, onPress: toLoads },
            { key: 'profile', icon: 'person', label: t('home.tabProfile'), onPress: () => router.push('/profile') },
            { key: 'settings', icon: 'settings', label: t('home.tabSettings'), onPress: () => router.push('/settings') },
          ]}
        />
      }>
      <BentoGrid>
        {record ? <WalletHero record={record} /> : null}

        {record && (
          <BentoRow>
            <BentoTile size="1x2" onPress={() => router.push('/profile')} label={t('profile.title')}>
              <Ionicons name="star" size={22} color={colors.star} />
              <Text variant="display">{record.ratingCount ? record.rating.toFixed(1) : '–'}</Text>
              <Text variant="caption" muted>
                {t('profile.ratings', { count: record.ratingCount })}
              </Text>
              <View style={{ flex: 1 }} />
              <LevelBadge level={levelFor(record.trips, record.rating)} />
            </BentoTile>
            <BentoStack>
              <BentoTile size="1x1">
                <MaterialCommunityIcons name="truck-check-outline" size={22} color={colors.primary} />
                <Text variant="hero">{record.trips}</Text>
                <Text variant="caption" muted>
                  {t('profile.trips')}
                </Text>
              </BentoTile>
              <BentoTile size="1x1">
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.success} />
                <Text variant="hero">{reliability(record.stats)}%</Text>
                <Text variant="caption" muted>
                  {t('home.reliability')}
                </Text>
              </BentoTile>
            </BentoStack>
          </BentoRow>
        )}

        {/* 2x1 live control: the trip in progress, or the next booking, or the live feed. */}
        {activeJob ? (
          <LiveJobTile job={activeJob} onPress={() => openJob(activeJob)} />
        ) : next && next.scheduledAt ? (
          <BentoTile size="2x1" tone="soft" onPress={() => openJob(next)} label={t('driver.upcoming')}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="calendar-check" size={26} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.primary}>
                  {t('home.nextBooking')}
                </Text>
                <Text variant="subtitle" color={colors.primary}>
                  {dates.pickupAt(next.scheduledAt)}
                </Text>
                <Text variant="caption" color={colors.primary} numberOfLines={1}>
                  {names.cityRoute(next.from, next.to)} · {formatMoney(t, next.price)}
                </Text>
              </View>
              <ForwardChevron color={colors.primary} />
            </View>
          </BentoTile>
        ) : (
          <BentoTile size="2x1" tone="soft" onPress={toLoads} label={t('driver.liveTitle')}>
            <View style={styles.row}>
              <View style={[styles.pulse, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text variant="hero" color={colors.primary}>
                  {live.length}
                </Text>
                <Text variant="caption" color={colors.primary}>
                  {t('home.liveNow')}
                </Text>
              </View>
              <ForwardChevron color={colors.primary} />
            </View>
          </BentoTile>
        )}
      </BentoGrid>

      {!account && (
        <Card>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-circle-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('driver.signInTitle')}</Text>
              <Text variant="caption" muted>
                {live.length ? t('driver.signInWaiting', { count: live.length }) : t('driver.signInBody')}
              </Text>
            </View>
          </View>
          <Button
            title={t('driver.signIn')}
            icon="log-in-outline"
            onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })}
          />
        </Card>
      )}

      {profile.status === 'draft' && (
        <Card>
          <View style={styles.row}>
            <MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">{t('driver.verifyTitle')}</Text>
              <Text variant="caption" muted>
                {t('driver.verifyBody')}
              </Text>
            </View>
          </View>
          <ProgressSteps labels={steps.map((step) => t(STEP_LABELS[step.id]))} completed={doneCount} />
          {steps.map((step) => (
            <Pressable
              key={step.id}
              accessibilityRole="button"
              disabled={step.id === 'account'}
              onPress={() => router.push(step.id === 'vehicle' ? '/driver-vehicle' : '/driver-documents')}
              style={styles.checkRow}>
              <View style={[styles.check, { backgroundColor: step.done ? colors.successFill : colors.surfaceMuted }]}>
                {step.done && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
              </View>
              <Text style={{ flex: 1 }} color={step.done ? colors.textMuted : colors.text}>
                {t(STEP_LABELS[step.id])}
              </Text>
              {step.id !== 'account' && <ForwardChevron color={colors.textMuted} />}
            </Pressable>
          ))}
          <Button title={nextAction.title} variant={allDone ? 'accent' : 'primary'} onPress={nextAction.go} />
          <TestBox label={t('driver.skipChecks')} onPress={skipChecks} />
        </Card>
      )}

      {profile.status === 'pending' && (
        <Card>
          <View style={styles.row}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color={colors.primary} />
            <Text variant="subtitle" style={{ flex: 1 }}>
              {t('driver.pendingTitle')}
            </Text>
          </View>
          <Text muted>{t('driver.pendingBody')}</Text>
          <TestBox label={t('driver.testApprove')} onPress={skipChecks} />
        </Card>
      )}

      {approved && profile.vehicle && <VerifiedRow vehicle={profile.vehicle} />}

      <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }} onLayout={(event) => setLiveY(event.nativeEvent.layout.y)}>
        <Text variant="title">{t('driver.liveTitle')}</Text>
        <Text variant="caption" muted>
          {live.length ? t('driver.liveNote') : t('driver.liveEmpty')}
        </Text>
      </View>
      {live.map((load) => (
        <LoadCard key={load.id} load={load} fits={load.tons <= capacity} offered={offered.has(load.id)} />
      ))}

      <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
        <Text variant="title">{t('driver.practiceTitle')}</Text>
        <Text variant="caption" muted>
          {t('driver.examplesNote')}
        </Text>
      </View>
      {examples.map((load) => (
        <LoadCard key={load.id} load={load} fits={load.tons <= capacity} offered={offered.has(load.id)} />
      ))}

      <Pressable accessibilityRole="button" onPress={reset} style={[styles.reset, { borderColor: colors.border }]}>
        <Ionicons name="refresh" size={16} color={colors.textMuted} />
        <Text variant="caption" muted>
          {t('driver.resetTest')}
        </Text>
      </Pressable>

      <Sheet visible={upcomingOpen} onClose={() => setUpcomingOpen(false)} title={t('driver.upcoming')}>
        {upcoming.length === 0 ? (
          <Text muted center>
            {t('home.noUpcoming')}
          </Text>
        ) : (
          upcoming.map((job) => (
            <UpcomingRow
              key={job.id}
              job={job}
              onPress={() => {
                setUpcomingOpen(false);
                openJob(job);
              }}
            />
          ))
        )}
      </Sheet>
    </Screen>
  );
}

/** 2x2 focus module, like a bank balance: the wallet that pays commission, with quick actions. */
function WalletHero({ record }: { record: DriverRecord }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const low = record.wallet < LOW_WALLET;
  return (
    <BentoTile size="2xauto" tone="hero">
      <Text variant="caption" color={colors.onHeroMuted} center>
        {t('wallet.balance')}
      </Text>
      <Text variant="display" color={colors.onHero} center>
        {formatMoney(t, record.wallet)}
      </Text>
      <Text variant="caption" color={low ? colors.onHero : colors.onHeroMuted} center>
        {low ? `⚠ ${t('home.lowWallet')}` : t('wallet.explain', { trips: record.trips })}
      </Text>
      <View style={styles.actions}>
        <HeroAction
          icon="add"
          label={t('home.topUp')}
          onPress={() => {
            play('success');
            addTestCredit(store, record, TEST_TOP_UP);
          }}
        />
        <HeroAction icon="car-outline" label={t('home.vehicle')} onPress={() => router.push('/driver-vehicle')} />
        <HeroAction icon="document-text-outline" label={t('home.documents')} onPress={() => router.push('/driver-documents')} />
        <HeroAction icon="ellipsis-horizontal" label={t('home.more')} onPress={() => router.push('/settings')} />
      </View>
    </BentoTile>
  );
}

/** Round actions on the navy hero keep white labels (RoundAction uses the screen's text colour). */
function HeroAction(props: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <RoundAction {...props} onHero />
    </View>
  );
}

function LiveJobTile({ job, onPress }: { job: Job; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  return (
    <BentoTile size="2x1" tone="hero" onPress={onPress} label={t('driver.activeJob')}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="truck-fast" size={30} color={colors.onHero} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('driver.activeJob')}
          </Text>
          <Text variant="subtitle" color={colors.onHero} numberOfLines={1}>
            {names.cityRoute(job.from, job.to)}
          </Text>
          <Text variant="caption" color={colors.onHero}>
            {t(`status.${job.status}`)} · {formatMoney(t, job.price)}
          </Text>
        </View>
        <ForwardChevron color={colors.onHero} />
      </View>
    </BentoTile>
  );
}

function VerifiedRow({ vehicle }: { vehicle: NonNullable<ReturnType<typeof useDriver>['profile']['vehicle']> }) {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  return (
    <View style={[styles.verified, { backgroundColor: colors.successSoft }]}>
      <MaterialCommunityIcons name="check-decagram" size={24} color={colors.success} />
      <View style={{ flex: 1 }}>
        <Text variant="label" color={colors.success}>
          {t('driver.approvedTitle')}
        </Text>
        <Text variant="caption" color={colors.success}>
          {t('driver.approvedBody', { vehicle: t(`vehicle.${vehicle.type}`), plate: vehicle.plate, city: cityName(vehicle.homeCity) })}
        </Text>
      </View>
    </View>
  );
}

function UpcomingRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.upcoming, { backgroundColor: colors.surface }]}>
      <View style={[styles.upcomingIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name="calendar-check" size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{job.scheduledAt ? dates.pickupAt(job.scheduledAt) : ''}</Text>
        <Text variant="caption" muted numberOfLines={1}>
          {names.cityRoute(job.from, job.to)} · {formatMoney(t, job.price)}
        </Text>
      </View>
      <ForwardChevron color={colors.textMuted} />
    </Pressable>
  );
}

function TestBox({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.testBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="flask-outline" size={20} color={colors.accent} />
        <Text variant="label" color={colors.accent}>
          {t('driver.testMode')}
        </Text>
      </View>
      <Button title={label} variant="accent" icon="checkmark-done-outline" sound={null} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  pulse: { width: 12, height: 12, borderRadius: 6 },
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
