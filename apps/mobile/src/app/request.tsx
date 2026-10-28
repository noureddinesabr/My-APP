import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { QuestScreen, useAutoAdvance } from '@/components/motion/quest';
import {
  HelpersQuestion,
  MediaQuestion,
  NoteQuestion,
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
import { QUESTIONS, requestProgress, tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing } from '@/theme';

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
  const { height: screen } = useWindowDimensions();
  // One trip map for the whole flow: it stays on top while the questions change below.
  const names = useLocationLabel();
  const { km } = tripEstimate(draft);
  const map = (
    <View style={{ flex: 1 }}>
    <FreightMap
      fill
      bare
      style={{ flex: 1, borderRadius: 0 }}
      // Keep the pins clear of the ☰ button above and the trip chip and panel below.
      inset={{ top: 56, bottom: 72 }}
      markers={[
        { id: 'from', kind: 'pickup', lat: draft.from.lat, lng: draft.from.lng },
        { id: 'to', kind: 'dropoff', lat: draft.to.lat, lng: draft.to.lng },
      ]}
      route={[draft.from, draft.to]}
      focus={[draft.from, draft.to]}
      focusKey={`${draft.from.lat},${draft.from.lng},${draft.to.lat},${draft.to.lng}`}
    />
      {/* Over the map: the ☰ menu in the top start corner and the trip at a glance. */}
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
      </View>
      <View style={styles.tripChip} pointerEvents="none">
        <Glass style={styles.tripGlass} thickness="thick">
          <Text variant="label" numberOfLines={1}>
            {names.shortRoute(draft.from, draft.to)} · {t('request.distance', { km })}
          </Text>
        </Glass>
      </View>
    </View>
  );

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

  const short = screen < 700;
  const mediaAdded = !!(draft.voiceNote || draft.media.length);
  const noteAdded = !!(draft.notes.trim() || draft.rideAlong);
  const optional = (added: boolean) => (
    <Button variant={added ? 'accent' : 'ghost'} title={added ? t('quest.continue') : t('quest.skip')} sound="whoosh" onPress={next} />
  );
  const footer =
    question === 'route' ? (
      <Button variant="accent" title={t('quest.routeOk')} sound="whoosh" onPress={next} />
    ) : question === 'media' ? (
      optional(mediaAdded)
    ) : question === 'note' ? (
      optional(noteAdded)
    ) : question === 'price' ? (
      <View style={{ gap: Spacing.xs }}>
        <Button variant="accent" icon="paper-plane" title={t('quest.send')} sound={null} disabled={sending} onPress={send} />
        {!client && !short && (
          <Text variant="caption" muted center>
            {t('quest.signInLater')}
          </Text>
        )}
      </View>
    ) : undefined;

  return (
    <>
      <QuestScreen
        top={map}
        // Close to half the screen for the map; the questions fit (or split) in the rest.
        topHeight={Math.round(screen * (short ? 0.4 : 0.45))}
        stepKey={question}
        direction={direction}
        progress={requestProgress(step)}
        title={t(`quest.${question}Q`)}
        // On short screens the extra hint lines go, so the answers fit without scrolling.
        hint={short ? undefined : question === 'media' ? t('quest.extrasHint') : undefined}
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
        {question === 'media' && <MediaQuestion />}
        {question === 'note' && <NoteQuestion />}
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

const styles = StyleSheet.create({
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row' },
  tripChip: { position: 'absolute', bottom: Radius.xl + Spacing.sm, start: 0, end: 0, alignItems: 'center' },
  tripGlass: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, maxWidth: '86%' },
});
