import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCityName } from '@/components/city-picker';
import { LoadCard } from '@/components/driver/load-card';
import { STEP_LABELS } from '@/components/driver/verification';
import { HomeHeader } from '@/components/home-header';
import { ProgressSteps } from '@/components/progress-steps';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, Gradient, Screen } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { maxTons } from '@/lib/pricing';
import { useDriver, verificationSteps } from '@/state/driver';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

export default function DriverHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const { profile, update, reset } = useDriver();
  const loads = useMemo(() => sampleLoads(), []);
  const steps = verificationSteps(profile);
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const capacity = profile.vehicle ? maxTons(profile.vehicle.type) : Infinity;

  // Loads the driver's vehicle can carry first.
  const sorted = [...loads].sort((a, b) => Number(b.tons <= capacity) - Number(a.tons <= capacity));

  const nextAction = !profile.vehicle
    ? { title: t('driver.ctaVehicle'), go: () => router.push('/driver-vehicle') }
    : !allDone
      ? { title: t('driver.ctaDocuments'), go: () => router.push('/driver-documents') }
      : { title: t('driver.ctaSubmit'), go: () => update({ status: 'pending' }) };

  return (
    <Screen>
      <HomeHeader title={t('driver.greeting')} />

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
              <View
                style={[
                  styles.check,
                  { backgroundColor: step.done ? colors.success : colors.surfaceMuted },
                ]}>
                {step.done && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
              </View>
              <Text style={{ flex: 1 }} color={step.done ? colors.textMuted : colors.text}>
                {t(STEP_LABELS[step.id])}
              </Text>
              {step.id !== 'account' && <ForwardChevron color={colors.textMuted} />}
            </Pressable>
          ))}
          <Button title={nextAction.title} variant={allDone ? 'accent' : 'primary'} onPress={nextAction.go} />
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
          <View style={[styles.testBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="flask-outline" size={20} color={colors.accent} />
              <Text variant="label" color={colors.accent}>
                {t('driver.testMode')}
              </Text>
            </View>
            <Button
              title={t('driver.testApprove')}
              variant="accent"
              icon="checkmark-done-outline"
              onPress={() => update({ status: 'approved' })}
            />
          </View>
        </Card>
      )}

      {profile.status === 'approved' && profile.vehicle && (
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
        </Gradient>
      )}

      <View style={{ gap: Spacing.xs }}>
        <Text variant="subtitle">{t('driver.requestsTitle')}</Text>
        <Text variant="caption" muted>
          {t('driver.examplesNote')}
        </Text>
      </View>
      {sorted.map((load) => (
        <LoadCard key={load.id} load={load} fits={load.tons <= capacity} offered={!!profile.offers[load.id]} />
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  testBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  verified: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
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
