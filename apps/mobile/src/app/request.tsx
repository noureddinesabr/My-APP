import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { DraftExitPrompt } from '@/components/draft-exit-prompt';
import { Glass } from '@/components/glass';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { MenuButton } from '@/components/menu-drawer';
import { MapPreviewProvider, useMapPreview } from '@/components/map/preview';
import type { FreightMapProps } from '@/components/map/types';
import { AnswersOnMap, CHIP_COLUMN, CHIP_ROW, useAnswerChips } from '@/components/request/answers-on-map';
import { useLanguage } from '@/i18n/language-provider';
import { vehicleIcon } from '@/constants/vehicles';
import { QuestScreen, useAutoAdvance } from '@/components/motion/quest';
import {
  HelpersQuestion,
  MediaQuestion,
  NoteQuestion,
  PriceQuestion,
  RouteQuestion,
  SizeQuestion,
  useTripTime,
  VehicleQuestion,
  WhatQuestion,
  WhenQuestion,
} from '@/components/request/questions';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { QUESTIONS, requestProgress, tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

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
  const { height: screen } = useWindowDimensions();
  // One trip map for the whole flow: it stays on top while the questions change below.
  const names = useLocationLabel();
  const { km } = tripEstimate(draft);
  const time = useTripTime(km);
  const vehicleChosen = QUESTIONS.indexOf('vehicle') < draft.step;
  const { rtl } = useLanguage();
  const colors = useColors();
  const chips = useAnswerChips(draft);
  const mapHeight = Math.round(screen * (screen < 700 ? 0.4 : 0.45));
  // Stickers fill the far side down to the trip chip, then carry on under the ☰ button.
  const perColumn = Math.max(2, Math.floor((mapHeight - Spacing.md - TRIP_CHIP_ZONE) / CHIP_ROW));
  const sides = { far: chips.length ? CHIP_COLUMN : 0, menu: chips.length > perColumn ? CHIP_COLUMN : 0 };
  const map = (
    <View style={{ flex: 1 }}>
    <FreightMap
      fill
      bare
      style={{ flex: 1, borderRadius: 0 }}
      // Keep the pins clear of the ☰ button above and the trip chip and panel below.
      inset={{ top: 96, bottom: 84, left: rtl ? sides.far : sides.menu, right: rtl ? sides.menu : sides.far }}
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
      <AnswersOnMap chips={chips} perColumn={perColumn} />
      {/* Over the map: the ☰ menu in the top start corner and the trip at a glance. */}
      <View style={styles.mapTop} pointerEvents="box-none">
        <MenuButton />
      </View>
      <View style={styles.tripChip} pointerEvents="none">
        <Glass style={styles.tripGlass} thickness="thick">
          {/* Two short lines, so neither the route nor the distance gets cut off. */}
          <Text variant="label" center>
            {names.shortRoute(draft.from, draft.to)}
          </Text>
          <Text variant="caption" color={colors.primary} center style={styles.tripLine}>
            {t('quest.tripLine', { km, time })}
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
    <Button
      // Skip is a clear violet button (not a faint one); Continue is the bright main action.
      variant={added ? 'accent' : 'primary'}
      icon={added ? undefined : 'play-skip-forward'}
      title={added ? t('quest.continue') : t('quest.skip')}
      sound="whoosh"
      onPress={() => {
        // The keyboard goes away, the panel settles back down, and the next page comes in.
        Keyboard.dismiss();
        next();
      }}
    />
  );
  const footer =
    question === 'what' ? (
      // Several kinds can be ticked, so this page moves on with a button.
      <Button variant="accent" title={t('quest.next')} sound="whoosh" disabled={!draft.freightTypes.length} onPress={next} />
    ) : question === 'route' ? (
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
        badge={question === 'media' || question === 'note' ? t('quest.optional') : undefined}
        // On short screens the extra hint lines go, so the answers fit without scrolling.
        hint={short ? undefined : question === 'media' ? t('quest.extrasHint') : undefined}
        backLabel={t('common.back')}
        closeLabel={t('common.close')}
        onBack={back}
        onClose={() => setConfirmExit(true)}
        footer={footer}>
        {question === 'route' && <RouteQuestion />}
        {question === 'what' && <WhatQuestion />}
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

/** The trip chip and the panel's rounded edge at the bottom of the map. */
const TRIP_CHIP_ZONE = 96;

const styles = StyleSheet.create({
  mapTop: { position: 'absolute', top: Spacing.md, start: Spacing.md, end: Spacing.md, flexDirection: 'row' },
  tripChip: { position: 'absolute', bottom: Radius.xl + Spacing.sm, start: 0, end: 0, alignItems: 'center' },
  tripLine: { fontSize: 13, lineHeight: 17 },
  tripGlass: { paddingHorizontal: Spacing.lg, paddingVertical: 4, borderRadius: Radius.xl, maxWidth: '92%', alignItems: 'center' },
});
