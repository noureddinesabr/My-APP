import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { ProgressSteps } from '@/components/progress-steps';
import { LoadStep } from '@/components/request/load-step';
import { PriceStep } from '@/components/request/price-step';
import { RouteStep } from '@/components/request/route-step';
import { VehicleStep } from '@/components/request/vehicle-step';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { Button, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { suitableVehicles } from '@/lib/pricing';
import { useRecentPlaces } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Spacing, useColors } from '@/theme';

const STEP_COUNT = 4;

export default function RequestWizard() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update, discard } = useRequestDraft();
  const [step, setStep] = useState(() => Math.min(draft.step, STEP_COUNT - 1));
  const [confirmExit, setConfirmExit] = useState(false);
  const [sending, setSending] = useState(false);
  const store = useStore();
  const { client } = useAccount();
  const { km } = tripEstimate(draft);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/client'));
  const goTo = (next: number) => {
    setStep(next);
    update({ step: Math.max(draft.step, next) });
  };

  // Repeat users (who already picked places before) start on the one-page form; first-timers get steps.
  // Decided once when the form opens, so it never switches while the user is filling it in.
  const recent = useRecentPlaces();
  const [autoLayout] = useState<'steps' | 'page'>(() => (recent.length > 1 ? 'page' : 'steps'));
  const layout = draft.layout ?? autoLayout;
  const onePage = layout === 'page';
  const isLast = onePage || step === STEP_COUNT - 1;

  // Signed-in clients send straight away; others sign in first (after seeing the estimate).
  const send = async () => {
    if (!client) {
      router.push({ pathname: '/login', params: { role: 'client', next: 'publish' } });
      return;
    }
    setSending(true);
    try {
      await ensureClient(store, client);
      const id = await publishRequest(store, client, draft);
      play('send');
      discard();
      router.replace({ pathname: '/track/[id]', params: { id } });
    } catch {
      play('error');
      setSending(false);
    }
  };
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
            sound={isLast ? null : 'tap'}
            disabled={sending}
            onPress={() => (isLast ? send() : goTo(step + 1))}
          />
          {isLast && (
            <Text variant="caption" muted center>
              {t('request.noAccountNeeded')}
            </Text>
          )}
        </View>
      }
      header={
        <View style={styles.header}>
          <IconButton
            label={t('common.back')}
            icon={<ForwardChevron color={colors.text} flip />}
            onPress={() => (step > 0 && !onePage ? setStep(step - 1) : setConfirmExit(true))}
          />
          <Text variant="subtitle" style={{ flex: 1 }} center>
            {t('request.title')}
          </Text>
          <IconButton label="close" icon={<Ionicons name="close" size={22} color={colors.text} />} onPress={() => setConfirmExit(true)} />
        </View>
      }>
      <Segmented
        label={t('request.layout')}
        value={layout}
        onChange={(next) => update({ layout: next })}
        options={[
          { value: 'steps', label: t('request.layoutSteps') },
          { value: 'page', label: t('request.layoutPage') },
        ]}
      />

      {onePage ? (
        <>
          <RouteStep km={km} />
          <Divider />
          <LoadStep />
          <Divider />
          <VehicleStep />
          <Divider />
          <PriceStep />
        </>
      ) : (
        <>
          <ProgressSteps labels={progressLabels} completed={step + 1} />
          {step === 0 && <RouteStep km={km} />}
          {step === 1 && <LoadStep />}
          {step === 2 && <VehicleStep />}
          {step === 3 && <PriceStep />}
        </>
      )}

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

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
