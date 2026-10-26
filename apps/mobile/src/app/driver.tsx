import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { addTestCredit } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { Job } from '@/backend/types';
import { useCityName } from '@/components/city-picker';
import { LoadCard } from '@/components/driver/load-card';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { STEP_LABELS } from '@/components/driver/verification';
import { HomeHeader } from '@/components/home-header';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { ProgressSteps } from '@/components/progress-steps';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, Gradient, Screen } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { maxTons } from '@/lib/pricing';
import { play } from '@/lib/sounds';
import { useDriver, verificationSteps } from '@/state/driver';
import { Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

const TEST_TOP_UP = 200;

export default function DriverHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const store = useStore();
  const { profile, update, reset } = useDriver();
  const { account, record, approved } = useDriverRecord();
  const examples = useMemo(() => sampleLoads(), []);
  const openRequests = useQuery('requests', [['status', 'open']]);
  const myOffers = useQuery('offers', account ? [['driverId', account.id]] : null);
  const myJobs = useQuery('jobs', account ? [['driverId', account.id]] : null);

  const steps = verificationSteps(profile);
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const capacity = profile.vehicle ? maxTons(profile.vehicle.type) : Infinity;
  const offered = new Set([
    ...(myOffers ?? []).filter((offer) => offer.status === 'pending').map((offer) => offer.requestId),
    ...Object.keys(profile.offers),
  ]);
  const live = [...(openRequests ?? [])]
    .filter((request) => request.clientId !== account?.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const openJobs = (myJobs ?? []).filter((job) => job.status !== 'completed' && job.status !== 'cancelled');
  const activeJob = openJobs.find((job) => job.status !== 'scheduled');
  const upcoming = openJobs
    .filter((job) => job.status === 'scheduled')
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));

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

  return (
    <Screen>
      <HomeHeader title={account ? t('driver.hello', { name: account.name.split(' ')[0] }) : t('driver.greeting')} />

      {activeJob && <ActiveJobCard job={activeJob} />}
      {upcoming.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="subtitle">{t('driver.upcoming')}</Text>
          {upcoming.map((job) => (
            <UpcomingRow key={job.id} job={job} />
          ))}
        </View>
      )}

      {!account && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-circle-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('driver.signInTitle')}</Text>
              <Text variant="caption" muted>
                {live.length ? t('driver.signInWaiting', { count: live.length }) : t('driver.signInBody')}
              </Text>
            </View>
          </View>
          <Button title={t('driver.signIn')} icon="log-in-outline" onPress={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
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
              <View style={[styles.check, { backgroundColor: step.done ? colors.success : colors.surfaceMuted }]}>
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

      {approved && profile.vehicle && (
        <Gradient colors={Gradients.success} style={styles.verified}>
          <MaterialCommunityIcons name="check-decagram" size={32} color={colors.onPrimary} />
          <View style={{ flex: 1 }}>
            <Text variant="subtitle" color={colors.onPrimary}>
              {t('driver.approvedTitle')}
            </Text>
            <Text variant="caption" color={colors.onPrimary}>
              {t('driver.approvedBody', {
                vehicle: t(`vehicle.${profile.vehicle.type}`),
                plate: profile.vehicle.plate,
                city: cityName(profile.vehicle.homeCity),
              })}
            </Text>
          </View>
          {record && (
            <Text variant="label" color={colors.onPrimary}>
              ★ {record.rating.toFixed(1)}
            </Text>
          )}
        </Gradient>
      )}

      {record && (
        <Card>
          <View style={styles.row}>
            <MaterialCommunityIcons name="wallet-outline" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" muted>
                {t('wallet.balance')}
              </Text>
              <Text variant="title" color={record.wallet < 50 ? colors.accent : colors.text}>
                {formatMoney(t, record.wallet)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                play('success');
                addTestCredit(store, record, TEST_TOP_UP);
              }}
              style={[styles.topUp, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text variant="caption" color={colors.primary}>
                {t('wallet.testTopUp', { amount: formatMoney(t, TEST_TOP_UP) })}
              </Text>
            </Pressable>
          </View>
          <Text variant="caption" muted>
            {t('wallet.explain', { trips: record.trips })}
          </Text>
        </Card>
      )}

      <View style={{ gap: Spacing.xs }}>
        <Text variant="subtitle">{t('driver.liveTitle')}</Text>
        <Text variant="caption" muted>
          {live.length ? t('driver.liveNote') : t('driver.liveEmpty')}
        </Text>
      </View>
      {live.map((load) => (
        <LoadCard key={load.id} load={load} fits={load.tons <= capacity} offered={offered.has(load.id)} />
      ))}

      <View style={{ gap: Spacing.xs }}>
        <Text variant="subtitle">{t('driver.practiceTitle')}</Text>
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
    </Screen>
  );
}

function ActiveJobCard({ job }: { job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
      style={softShadow(colors.primary, 1.2)}>
      <Gradient colors={Gradients.accent} style={styles.activeJob}>
        <MaterialCommunityIcons name="truck-fast" size={32} color={colors.onPrimary} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.onPrimary}>
            {t('driver.activeJob')}
          </Text>
          <Text variant="subtitle" color={colors.onPrimary} numberOfLines={1}>
            {names.cityRoute(job.from, job.to)}
          </Text>
          <Text variant="caption" color={colors.onPrimary}>
            {t(`status.${job.status}`)} · {formatMoney(t, job.price)}
          </Text>
        </View>
        <ForwardChevron color={colors.onPrimary} />
      </Gradient>
    </Pressable>
  );
}

function UpcomingRow({ job }: { job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
      style={[styles.upcoming, { backgroundColor: colors.surface, borderColor: colors.primary }, softShadow(colors.shadow, 0.5)]}>
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  testBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  verified: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  upcomingIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  activeJob: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  topUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
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
