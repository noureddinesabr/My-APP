import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { MapPreviewProvider, useMapPreview } from '@/components/map/preview';
import type { FreightMapProps } from '@/components/map/types';
import { vehicleIcon } from '@/constants/vehicles';
import { QuestScreen, useAutoAdvance } from '@/components/motion/quest';
import { SendPage, SizeQuestion } from '@/components/request/simple';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { QUESTIONS, requestProgress, useRequestDraft } from '@/state/request-draft';
import { Spacing } from '@/theme';

/**
 * The request in two pages after the route: how big (one tap), then the price with Now /
 * no helpers / nothing extra already set, and "Find a driver". Like inDrive: route, price, go.
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
  const { height: screen } = useWindowDimensions();
  // One trip map for the whole flow: it stays on top while the questions change below.
  const vehicleChosen = draft.vehicleChosen;
  const map = (
    <View style={{ flex: 1 }}>
    <FreightMap
      fill
      bare
      style={{ flex: 1, borderRadius: 0 }}
      // Keep the pins clear of the ☰ button above and the panel below.
      inset={{ top: 96, bottom: 48 }}
      markers={[
        { id: 'from', kind: 'pickup', lat: draft.from.lat, lng: draft.from.lng, label: t('map.pickup') },
        { id: 'to', kind: 'dropoff', lat: draft.to.lat, lng: draft.to.lng, label: t('map.dropoff') },
        ...(preview ? [{ id: 'preview', kind: 'pick' as const, lat: preview.lat, lng: preview.lng }] : []),
      ]}
      route={[draft.from, draft.to]}
      // Once a vehicle is chosen, it drives the trip on the map.
      traveller={vehicleChosen ? (vehicleIcon(draft.vehicle) as FreightMapProps['traveller']) : undefined}
      // While an end is being changed, the map flies to what is being typed.
      focus={preview ? [preview] : [draft.from, draft.to]}
      focusKey={preview ? `p${preview.lat},${preview.lng}` : `${draft.from.lat},${draft.from.lng},${draft.to.lat},${draft.to.lng}`}
    />
      {/* Over the map: the ☰ menu in the top start corner. The trip itself shows in the summary at the end. */}
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
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
  const footer =
    question === 'send' ? (
      <View style={{ gap: Spacing.xs }}>
        <Button variant="accent" icon="search" title={t('simple.find')} sound={null} disabled={sending} onPress={send} />
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
        title={t(`simple.${question}Q`)}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={back}
        onClose={() => setConfirmExit(true)}
        footer={footer}>
        {question === 'size' && <SizeQuestion onDone={advance} />}
        {question === 'send' && <SendPage />}
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
});
