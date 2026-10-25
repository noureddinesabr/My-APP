import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { ProgressSteps } from '@/components/progress-steps';
import { LoadStep } from '@/components/request/load-step';
import { PriceStep } from '@/components/request/price-step';
import { RouteStep } from '@/components/request/route-step';
import { VehicleStep } from '@/components/request/vehicle-step';
import { Text } from '@/components/text';
import { Button, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { suitableVehicles } from '@/lib/pricing';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Spacing, useColors } from '@/theme';

const STEP_COUNT = 4;

export default function RequestWizard() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update, discard } = useRequestDraft();
  const [step, setStep] = useState(() => Math.min(draft.step, STEP_COUNT - 1));
  const [confirmExit, setConfirmExit] = useState(false);
  const { km } = tripEstimate(draft);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/client'));
  const goTo = (next: number) => {
    setStep(next);
    update({ step: Math.max(draft.step, next) });
  };

  const isLast = step === STEP_COUNT - 1;
  const cta = [
    t('request.ctaRoute', { km }),
    t('request.ctaLoad', { count: suitableVehicles(draft.tons).length }),
    t('request.ctaVehicle'),
    t('request.ctaSend'),
  ][step];

  // "Account type" was already chosen before the wizard, so progress starts at 1 of 5 (20%).
  const progressLabels = [
    t('request.progressAccount'),
    t('request.progressRoute'),
    t('request.progressLoad'),
    t('request.progressVehicle'),
    t('request.progressPrice'),
  ];

  return (
    <Screen
      footer={
        <View style={{ gap: Spacing.xs }}>
          <Button
            title={cta}
            variant={isLast ? 'accent' : 'primary'}
            icon={isLast ? 'paper-plane-outline' : undefined}
            onPress={() => (isLast ? router.push('/signup') : goTo(step + 1))}
          />
          {isLast && (
            <Text variant="caption" muted center>
              {t('request.noAccountNeeded')}
            </Text>
          )}
        </View>
      }>
      <View style={styles.header}>
        <IconButton
          label={t('common.back')}
          icon={<ForwardChevron color={colors.text} flip />}
          onPress={() => (step > 0 ? setStep(step - 1) : setConfirmExit(true))}
        />
        <Text variant="subtitle" style={{ flex: 1 }} center>
          {t('request.title')}
        </Text>
        <IconButton
          label="close"
          icon={<Ionicons name="close" size={22} color={colors.text} />}
          onPress={() => setConfirmExit(true)}
        />
      </View>

      <ProgressSteps labels={progressLabels} completed={step + 1} />

      {step === 0 && <RouteStep km={km} />}
      {step === 1 && <LoadStep />}
      {step === 2 && <VehicleStep />}
      {step === 3 && <PriceStep />}

      <DraftExitPrompt
        visible={confirmExit}
        onClose={() => setConfirmExit(false)}
        onKeep={() => {
          setConfirmExit(false);
          leave();
        }}
        onDiscard={() => {
          setConfirmExit(false);
          discard();
          leave();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
