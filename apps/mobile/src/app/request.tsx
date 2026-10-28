import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { useDateFormat } from '@/components/date-format';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { MapPreviewProvider, useMapPreview } from '@/components/map/preview';
import { QuestScreen, useAutoAdvance, usePanelHeight } from '@/components/motion/quest';
import {
  HelpersQuestion,
  MediaQuestion,
  NoteQuestion,
  PriceQuestion,
  RouteQuestion,
  useTripTime,
  WeightQuestion,
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
export default function RequestScreen() {
  return (
    <MapPreviewProvider>
      <RequestFlow />
    </MapPreviewProvider>
  );
}

function RequestFlow() {
  const { t } = useTranslation();
  const preview = useMapPreview().location;
  const { draft, update, discard } = useRequestDraft();
  const [step, setStep] = useState(() => Math.min(draft.step, QUESTIONS.length - 1));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmExit, setConfirmExit] = useState(false);
  const [sending, setSending] = useState(false);
  const store = useStore();
  const { client } = useAccount();
  const question = QUESTIONS[step];
  const panelHeight = usePanelHeight();
  // One trip map for the whole flow: it stays on top while the questions change below.
  const names = useLocationLabel();
  const { km } = tripEstimate(draft);
  const time = useTripTime(km);
  const dates = useDateFormat();
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
        ...(preview ? [{ id: 'preview', kind: 'pick' as const, lat: preview.lat, lng: preview.lng }] : []),
      ]}
      route={[draft.from, draft.to]}
      // While an end is being changed, the map flies to what is being typed.
      focus={preview ? [preview] : [draft.from, draft.to]}
      focusKey={preview ? `p${preview.lat},${preview.lng}` : `${draft.from.lat},${draft.from.lng},${draft.to.lat},${draft.to.lng}`}
    />
      {/* Over the map: the ☰ menu in the top start corner and the trip at a glance. */}
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
      </View>
      <View style={styles.tripChip} pointerEvents="none">
        <Glass style={styles.tripGlass} thickness="thick">
          <Text variant="label" numberOfLines={1}>
            {question === 'price'
              ? `${t('request.payCash')} · ${draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t(draft.pickupWindow === '1h' ? 'request.whenHour' : 'quest.whenNow')}`
              : `${names.shortRoute(draft.from, draft.to)} · ${t('quest.tripLine', { km, time })}`}
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

  const mediaAdded = !!(draft.voiceNote || draft.media.length);
  const noteAdded = !!(draft.notes.trim() || draft.rideAlong);
  const optional = (added: boolean) => (
    <Button compact variant={added ? 'accent' : 'ghost'} title={added ? t('quest.continue') : t('quest.skip')} sound="whoosh" onPress={next} />
  );
  const footer =
    question === 'route' ? (
      <Button compact variant="accent" title={t('quest.routeOk')} sound="whoosh" onPress={next} />
    ) : question === 'media' ? (
      optional(mediaAdded)
    ) : question === 'note' ? (
      optional(noteAdded)
    ) : question === 'price' ? (
      <Button compact variant="accent" icon="paper-plane" title={t('quest.send')} sound={null} disabled={sending} onPress={send} />
    ) : undefined;

  return (
    <>
      <QuestScreen
        top={map}
        // The map keeps two thirds of the screen; the question is squeezed into the last third.
        panelHeight={panelHeight}
        stepKey={question}
        direction={direction}
        progress={requestProgress(step)}
        title={t(`quest.${question}Q`)}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={back}
        onClose={() => setConfirmExit(true)}
        footer={footer}>
        {question === 'route' && <RouteQuestion />}
        {question === 'what' && <WhatQuestion onDone={advance} />}
        {question === 'weight' && <WeightQuestion onDone={advance} />}
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
  tripGlass: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, maxWidth: '94%' },
});
