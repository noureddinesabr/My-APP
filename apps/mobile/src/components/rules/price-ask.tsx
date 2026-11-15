import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { agreePrice, askPrice, counterPrice, keepMyPrice, keepPrice } from '@/backend/actions';
import { useStore } from '@/backend';
import type { Job } from '@/backend/types';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/ui';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

const stepFor = (price: number) => (price < 1000 ? 10 : price < 5000 ? 50 : 100);

/**
 * «Update the price» (driver): only after taking the trip and before loading, with the reason in
 * his own words (it goes to the chat). The customer decides freely.
 */
export function PriceAskSheet({ job, visible, onClose }: { job: Job; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const [price, setPrice] = useState(job.price);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const send = async () => {
    if (!reason.trim()) {
      setTried(true);
      play('error');
      return;
    }
    play('send');
    await askPrice(store, job, price, reason);
    setReason('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} drag="handle">
      <ScrollView contentContainerStyle={{ gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
        <Text variant="title" center>
          {t('pa.title')}
        </Text>
        <Text muted center>
          {t('pa.now', { price: formatMoney(t, job.price) })}
        </Text>
        <Text variant="label">{t('pa.whyTitle')}</Text>
        <Text variant="caption" muted>
          {t('pa.whyHint')}
        </Text>
        <TextInput value={reason} onChangeText={setReason} placeholder={t('pa.whyBox')} multiline style={{ minHeight: 72 }} />
        {tried && !reason.trim() && (
          <Text variant="caption" color={colors.accent}>
            {t('pa.whyNeeded')}
          </Text>
        )}
        <Text variant="label">{t('pa.newPrice')}</Text>
        <Stepper bright value={price} step={stepFor(price)} min={10} max={200_000} onChange={setPrice} format={(value) => formatMoney(t, value)} editable unit={currencyUnit(t)} />
        <Text variant="caption" muted center>
          {t('pa.rule')}
        </Text>
        <Button title={t('pa.send', { price: formatMoney(t, price) })} variant="accent" icon="paper-plane" sound={null} disabled={price === job.price} onPress={send} />
      </ScrollView>
    </Sheet>
  );
}

/** The client's other price. */
function CounterSheet({ job, visible, onClose }: { job: Job; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const store = useStore();
  const ask = job.priceAsk;
  const [price, setPrice] = useState(ask ? Math.round((ask.price + ask.agreed) / 20) * 10 : job.price);
  if (!ask) return null;
  return (
    <Sheet visible={visible} onClose={onClose} drag="handle">
      <View style={{ gap: Spacing.sm }}>
        <Text variant="title" center>
          {t('pa.counterTitle')}
        </Text>
        <Text muted center>
          {t('pa.counterSub', { name: job.driverName, price: formatMoney(t, ask.price), old: formatMoney(t, ask.agreed) })}
        </Text>
        <Stepper bright value={price} step={stepFor(price)} min={10} max={200_000} onChange={setPrice} format={(value) => formatMoney(t, value)} editable unit={currencyUnit(t)} />
        <Button
          title={t('pa.counterSend', { price: formatMoney(t, price) })}
          variant="accent"
          icon="paper-plane"
          sound="send"
          onPress={() => {
            counterPrice(store, job, price);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

/**
 * The open price question on the trip page, for whoever must answer now. The customer: accept,
 * suggest another price, keep the agreed price, or cancel for free. The driver, after a counter:
 * accept, keep his price, go back to the agreed price, or cancel (never counted against him).
 */
export function PriceAskCard({ job, me, onCancel }: { job: Job; me: 'client' | 'driver'; onCancel: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const [counter, setCounter] = useState(false);
  const ask = job.priceAsk;
  if (!ask) return null;
  const myTurn = ask.by !== me;
  const price = formatMoney(t, ask.price);
  const old = formatMoney(t, ask.agreed);
  const title = !myTurn
    ? me === 'driver'
      ? t('pa.youAsked')
      : t('pa.youCountered')
    : me === 'client'
      ? t('pa.cardTitleC', { name: job.driverName })
      : t('pa.cardTitleD');

  return (
    <View style={[styles.card, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="cash-sync" size={24} color={colors.primary} />
        <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="title" color={colors.primary}>
          {price}
        </Text>
        <Text variant="caption" muted style={{ flex: 1 }}>
          {t('pa.agreedBefore', { price: old })}
        </Text>
      </View>
      {!myTurn ? (
        <Text variant="caption" muted>
          {me === 'driver' ? t('pa.waitCustomer') : t('pa.waitDriver', { name: job.driverName })}
        </Text>
      ) : (
        <>
          {me === 'client' && (
            <Text variant="caption" muted>
              {t('pa.seeChat')}
            </Text>
          )}
          <Button title={t('pa.accept', { price })} variant="accent" icon="checkmark-circle" sound="success" onPress={() => agreePrice(store, job)} />
          {me === 'client' ? (
            <>
              <Button title={t('pa.counter')} variant="primary" onPress={() => setCounter(true)} />
              <Button title={t('pa.keep', { price: old })} variant="ghost" onPress={() => keepPrice(store, job)} />
            </>
          ) : (
            <>
              <Button title={t('pa.keepMine', { price: formatMoney(t, ask.driverPrice) })} variant="primary" onPress={() => keepMyPrice(store, job)} />
              <Button title={t('pa.backTo', { price: old })} variant="ghost" onPress={() => keepPrice(store, job)} />
            </>
          )}
          <PressableScale accessibilityRole="button" scaleTo={0.97} onPress={onCancel} style={styles.link}>
            <Text variant="label" color={colors.accent} center>
              {me === 'client' ? t('pa.cancelFree') : t('pa.cancelJob')}
            </Text>
          </PressableScale>
        </>
      )}
      {me === 'client' && <CounterSheet key={ask.at} job={job} visible={counter} onClose={() => setCounter(false)} />}
    </View>
  );
}

/** The chip that opens «Update the price» (driver, before loading). */
export function PriceAskChip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.96}
      onPress={() => {
        play('tap');
        onPress();
      }}
      style={[styles.chip, { borderColor: colors.primary }]}>
      <MaterialCommunityIcons name="cash-sync" size={18} color={colors.primary} />
      <Text variant="label" color={colors.primary}>
        {t('pa.btn')}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  link: { minHeight: 44, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1.5 },
});
