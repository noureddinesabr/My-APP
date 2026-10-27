import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { QuestScreen, useAutoAdvance } from '@/components/motion/quest';
import {
  ExtrasQuestion,
  HelpersQuestion,
  PriceQuestion,
  RouteQuestion,
  SizeQuestion,
  VehicleQuestion,
  WhatQuestion,
  WhenQuestion,
} from '@/components/request/questions';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { QUESTIONS, requestProgress, useRequestDraft } from '@/state/request-draft';
import { Spacing } from '@/theme';

/**
 * The request as a short game: one question per screen, big answers, tap and it moves on.
 * Answers are pre-filled (smart defaults), so a client can tap through in seconds.
 */
export default function RequestFlow() {
  const { t } = useTranslation();
  const { draft, update, discard } = useRequestDraft();
  const [step, setStep] = useState(() => Math.min(draft.step, QUESTIONS.length - 1));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmExit, setConfirmExit] = useState(false);
  const [sending, setSending] = useState(false);
  const store = useStore();
  const { client } = useAccount();
  const question = QUESTIONS[step];

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/client'));
  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    if (next > draft.step) update({ step: next });
  };
  const next = () => goTo(Math.min(step + 1, QUESTIONS.length - 1));
  const advance = useAutoAdvance(next);
  const back = () => (step > 0 ? goTo(step - 1) : setConfirmExit(true));

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
      router.replace({ pathname: '/track/[id]', params: { id, sent: '1' } });
    } catch {
      play('error');
      setSending(false);
    }
  };

  const extrasAdded = !!(draft.voiceNote || draft.media.length || draft.notes.trim() || draft.rideAlong);
  const footer =
    question === 'route' ? (
      <Button variant="accent" title={t('quest.routeOk')} sound="whoosh" onPress={next} />
    ) : question === 'extras' ? (
      <Button variant={extrasAdded ? 'accent' : 'ghost'} title={extrasAdded ? t('quest.continue') : t('quest.skip')} sound="whoosh" onPress={next} />
    ) : question === 'price' ? (
      <View style={{ gap: Spacing.xs }}>
        <Button variant="accent" icon="paper-plane" title={t('quest.send')} sound={null} disabled={sending} onPress={send} />
        {!client && (
          <Text variant="caption" muted center>
            {t('quest.signInLater')}
          </Text>
        )}
      </View>
    ) : undefined;

  return (
    <>
      <QuestScreen
        stepKey={question}
        direction={direction}
        progress={requestProgress(step)}
        title={t(`quest.${question}Q`)}
        hint={question === 'vehicle' ? t('quest.vehicleHint') : question === 'extras' ? t('quest.extrasHint') : undefined}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={back}
        onClose={() => setConfirmExit(true)}
        footer={footer}>
        {question === 'route' && <RouteQuestion />}
        {question === 'what' && <WhatQuestion onDone={advance} />}
        {question === 'size' && <SizeQuestion onDone={advance} />}
        {question === 'vehicle' && <VehicleQuestion onDone={advance} />}
        {question === 'when' && <WhenQuestion onDone={advance} />}
        {question === 'helpers' && <HelpersQuestion onDone={advance} />}
        {question === 'extras' && <ExtrasQuestion />}
        {question === 'price' && <PriceQuestion />}
      </QuestScreen>
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
    </>
  );
}
