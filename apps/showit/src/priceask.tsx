import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BitBubble, Composer, type Bit } from './composer';
import { PriceEditor } from './customer';
import { useT } from './i18n';
import { dh } from './shared';
import { play } from './sounds';
import { agreePrice, askPrice, canAskPrice, counterPrice, keepMyPrice, keepPrice, sendMessage, type Request } from './store';
import { CancelSheet, Sheet } from './trip';
import { Btn, T, tap, useColors } from './ui';

/**
 * Round 10, «تحديث الثمن»: after booking and before loading, the driver can suggest a new price
 * (he found more to carry, a high floor without elevator…). He says why in his own words (text,
 * voice or photo: no ready-made reasons, he knows his case), then picks the price. The customer
 * accepts, suggests another price, keeps the agreed price, or cancels for free; the driver answers
 * a counter the same way. As many rounds as needed; nobody is blamed for not agreeing.
 */

/** The driver's button (job page, chat, «My trips»). */
export function PriceAskButton({ req, small = true }: { req: Request; small?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!canAskPrice(req) || req.priceAsk) return null;
  return (
    <>
      <Btn title={t('pa_btn')} icon="pricetag-outline" kind="ghost" small={small} onPress={() => setOpen(true)} />
      <PriceAskSheet req={req} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The driver writes why and picks the new price. */
export function PriceAskSheet({ req, visible, onClose }: { req: Request; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [price, setPrice] = useState(req.price);
  const [why, setWhy] = useState<Bit[]>([]);
  useEffect(() => {
    if (visible) {
      setPrice(req.price);
      setWhy([]);
    }
  }, [visible, req.price]);
  const send = () => {
    if (!why.length || price === req.price) return;
    play('send');
    // The reason goes into the conversation first, in his own words, then the price.
    for (const b of why) {
      if (b.kind === 'text') sendMessage(req.id, 'driver', b.text ?? '');
      else if (b.uri) sendMessage(req.id, 'driver', '', { kind: b.kind, uri: b.uri, ms: b.ms, name: b.name });
    }
    askPrice(req.id, price);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('pa_title')}>
      <T size={14} muted>
        {t('pa_now', { price: dh(req.price, lang) })}
      </T>
      <View style={{ gap: 8 }}>
        <T weight="heavy">{t('pa_whyTitle')}</T>
        <T size={13} muted>
          {t('pa_whyHint')}
        </T>
        {why.map((b) => (
          <BitBubble key={b.id} bit={b} mine side="right" onRemove={() => setWhy(why.filter((x) => x.id !== b.id))} />
        ))}
        <Composer hint={t('pa_whyBox')} camera onSend={(b) => setWhy([...why, b])} />
      </View>
      <View style={{ gap: 6 }}>
        <T weight="heavy">{t('pa_newPrice')}</T>
        <PriceEditor price={price} onChange={setPrice} />
      </View>
      <T size={12} muted>
        {t('pa_rule')}
      </T>
      {!why.length ? (
        <T size={13} color={c.warn}>
          {t('pa_whyNeeded')}
        </T>
      ) : null}
      <Btn title={t('pa_send', { price: dh(price, lang) })} icon="send" disabled={!why.length || price === req.price} onPress={send} />
    </Sheet>
  );
}

/**
 * The open suggestion, where each side sees the trip (trip page, chat, «My trips»): the one whose turn
 * it is gets the choices; the other side sees that an answer is awaited.
 */
export function PriceAskCard({ req, role }: { req: Request; role: 'customer' | 'driver' }) {
  const c = useColors();
  const { t, lang } = useT();
  const [counter, setCounter] = useState(false);
  const [cp, setCp] = useState(req.price);
  const [cancel, setCancel] = useState(false);
  const ask = req.priceAsk;
  if (!ask || !canAskPrice(req)) return null;
  const myTurn = ask.by !== role;
  const choice = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, strong?: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: strong ? c.accent : c.surface, borderWidth: strong ? 0 : 1, borderColor: c.line, opacity: pressed ? 0.85 : 1 })}>
      <Ionicons name={icon} size={19} color={strong ? c.onAccent : c.accent} />
      <T weight="bold" color={strong ? c.onAccent : c.fg} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
  const title = ask.by === 'driver' ? (role === 'customer' ? t('pa_cardTitleC', { name: req.driverName ?? '' }) : t('pa_youAsked')) : role === 'driver' ? t('pa_cardTitleD') : t('pa_youCountered');
  return (
    <View style={{ borderRadius: 20, padding: 14, gap: 10, backgroundColor: c.warnSoft, borderWidth: 1, borderColor: c.warn }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="pricetag" size={18} color={c.warn} />
        <T weight="heavy" style={{ flex: 1 }}>
          {title}
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <T size={28} weight="heavy">
          {dh(ask.price, lang)}
        </T>
        <T size={13} muted>
          {t('pa_agreedBefore', { price: dh(req.price, lang) })}
        </T>
      </View>
      {!myTurn ? (
        <T size={13} muted>
          {role === 'driver' ? t('pa_waitCustomer') : t('pa_waitDriver', { name: req.driverName ?? '' })}
        </T>
      ) : role === 'customer' ? (
        <View style={{ gap: 8 }}>
          <T size={13} muted>
            {t('pa_seeChat')}
          </T>
          {choice(t('pa_accept', { price: dh(ask.price, lang) }), 'checkmark-circle', () => {
            play('success');
            agreePrice(req.id, 'customer');
          }, true)}
          {choice(t('pa_counter'), 'swap-horizontal', () => {
            setCp(Math.round((req.price + ask.price) / 20) * 10);
            setCounter(true);
          })}
          {choice(t('pa_keep', { price: dh(req.price, lang) }), 'arrow-undo', () => keepPrice(req.id, 'customer'))}
          {choice(t('pa_cancelFree'), 'close-circle-outline', () => setCancel(true))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {choice(t('pa_accept', { price: dh(ask.price, lang) }), 'checkmark-circle', () => {
            play('success');
            agreePrice(req.id, 'driver');
          }, true)}
          {choice(t('pa_keepMine', { price: dh(ask.driverPrice, lang) }), 'repeat', () => keepMyPrice(req.id))}
          {choice(t('pa_backTo', { price: dh(req.price, lang) }), 'arrow-undo', () => keepPrice(req.id, 'driver'))}
          {choice(t('pa_cancelJob'), 'close-circle-outline', () => setCancel(true))}
        </View>
      )}
      <Sheet visible={counter} onClose={() => setCounter(false)} title={t('pa_counterTitle')}>
        <T size={14} muted>
          {t('pa_counterSub', { name: req.driverName ?? '', price: dh(ask.price, lang), old: dh(req.price, lang) })}
        </T>
        <PriceEditor price={cp} onChange={setCp} />
        <Btn
          title={t('pa_counterSend', { price: dh(cp, lang) })}
          icon="send"
          disabled={cp === ask.price}
          onPress={() => {
            play('send');
            counterPrice(req.id, cp);
            setCounter(false);
          }}
        />
      </Sheet>
      <CancelSheet req={req} side={role} visible={cancel} onClose={() => setCancel(false)} preset={role === 'customer' ? 'cr_priceNoDeal' : 'dr_priceNoDeal'} />
    </View>
  );
}
