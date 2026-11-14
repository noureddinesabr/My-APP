import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askAi, previewAi } from '../ai';
import { pauseState, scheduleClash } from '../busy';
import { translate, type Key } from '../i18n';
import { play } from '../sounds';
import { addOffer, driverAutoMessage, getState, isLive, money, notify, patchRequest, setStage, update, useStore, type Request } from '../store';
import { layoutRtl, T, tap, useColors } from '../ui';
import { formatWhen } from '../wheels';
import { misfit, onWay } from '../work';
import { parseIntent, type Intent } from './intent';
import { canListen, canListenAlone, listenOnce, prepareVoice, speak, stopListening, stopSpeaking, type VoiceLang } from './speech';

/**
 * The driver's hands-free assistant (simple design preview, switched on in Settings › Voice
 * assistant). A round mic button on the driver's screens: tap and speak («شنو كاين؟», "what loads",
 * "zid 50", "next", "accept"…). New loads are read aloud as they come; on phones it then listens
 * by itself so he needn't touch the screen. During a trip: "I take it", "on my way", "arrived",
 * "loaded", "handed over". Every action is the same as the buttons (same checks: helpers, his
 * booked time, the gentle pauses), and everything said is also shown in a small bubble.
 */

type Bubble = { heard?: string; said?: string };

/** Loads the driver can take now, as on his loads page (fit, no clash, newest within 36 h). */
function openLoads(): Request[] {
  const s = getState();
  if (s.driver.online === false || pauseState(s.driver).until) return [];
  const day = Date.now() - 36 * 3600 * 1000;
  const plans = s.driver.plans ?? [];
  return s.requests
    .filter((r) => r.stage === 'open' && r.createdAt > day && !misfit(r, s.driver) && !scheduleClash(r, s.driver, s.requests))
    .sort((a, b) => (onWay(a, plans) ? 0 : 1) - (onWay(b, plans) ? 0 : 1));
}

/** His job in progress, if any. */
function myJob(): Request | undefined {
  const s = getState();
  return s.requests.find((r) => !r.driverIsExample && !!s.driver.name && r.driverName === s.driver.name && isLive(r.stage));
}

export function VoiceAgent() {
  const c = useColors();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const lang: VoiceLang = store.voice?.lang ?? 'ar';
  const tv = (k: Key, v?: Record<string, string | number>) => translate(lang, k, v);
  const [mode, setMode] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const cursor = useRef(0);
  const skipped = useRef(new Set<string>());
  const pending = useRef<{ kind: 'helpers'; req: Request; price: number } | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => prepareVoice(), []);

  const show = (b: Bubble, stay = 7000) => {
    setBubble(b);
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => setBubble(null), stay);
  };

  /** Says it (and shows it). */
  const say = async (text: string, heard?: string) => {
    show({ heard, said: text }, 12000);
    setMode('speaking');
    await speak(text, lang);
    setMode('idle');
  };

  const short = (p: string) => p.split(/[,،]/)[0];
  const describe = (r: Request) => tv('va_load', { from: short(r.from), to: short(r.to), when: formatWhen(r.when, lang, tv as never), price: money(r.price, lang) });
  const visible = () => openLoads().filter((r) => !skipped.current.has(r.id));
  const currentLoad = () => {
    const list = visible();
    if (!list.length) return undefined;
    cursor.current = Math.min(cursor.current, list.length - 1);
    return list[cursor.current];
  };

  /** The same checks as the Accept button: paused, his booked time, then helpers. */
  const offer = async (req: Request, price: number, heard: string) => {
    const s = getState();
    if (pauseState(s.driver).until) return say(tv('va_paused'), heard);
    if (scheduleClash(req, s.driver, s.requests)) return say(tv('va_busy'), heard);
    if (req.helpers) {
      pending.current = { kind: 'helpers', req, price };
      return say(tv('va_helpersQ', { n: req.helpers }), heard);
    }
    send(req, price);
    return say(tv('va_sent', { price: money(price, lang) }), heard);
  };
  const send = (req: Request, price: number) => {
    const s = getState();
    play('send');
    addOffer({ id: `${req.id}_me`, requestId: req.id, driverName: s.driver.name, vehicle: s.driver.vehicle, price: Math.max(10, Math.round(price / 10) * 10), createdAt: Date.now(), example: false });
  };

  const handle = async (heard: string) => {
    if (!heard) {
      setMode('idle');
      return show({ said: tv('va_unknown') });
    }
    const job = myJob();
    let intent: Intent = parseIntent(heard, { awaitingYesNo: !!pending.current, onJob: !!job });
    // Not understood: the AI, when there is one (preview or a key), picks the command.
    if (intent.kind === 'unknown' && (previewAi() || getState().aiKey)) {
      setMode('thinking');
      try {
        const answer = await askAi(getState().aiKey, `A truck driver in Morocco spoke to his freight app (English, French, Arabic or Moroccan Darija). He said: "${heard}". Reply with JSON only: {"kind": one of "list","next","repeat","accept","decline","more","less","price","yes","no","take","onway","arrived","loaded","handed","online","offline","help","unknown", "n": a number of dirhams if he said one}.`, [], 'quick');
        const j = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)) as { kind?: string; n?: number };
        if (j.kind) intent = { kind: j.kind, n: typeof j.n === 'number' ? j.n : undefined } as Intent;
      } catch {
        // no AI: stays unknown
      }
    }
    // A question waiting for yes / no (helpers).
    if (pending.current) {
      const p = pending.current;
      if (intent.kind === 'yes') {
        pending.current = null;
        send(p.req, p.price);
        return say(tv('va_sent', { price: money(p.price, lang) }), heard);
      }
      if (intent.kind === 'no') {
        pending.current = null;
        return say(tv('va_noHelpers'), heard);
      }
    }
    const r = currentLoad();
    const mine = r ? getState().offers.find((o) => o.id === `${r.id}_me`) : undefined;
    switch (intent.kind) {
      case 'stop':
        stopSpeaking();
        setMode('idle');
        return show({ heard });
      case 'help':
        return say(tv('va_help'), heard);
      case 'online':
        update((s) => ({ ...s, driver: { ...s.driver, online: true } }));
        return say(tv('va_online'), heard);
      case 'offline':
        update((s) => ({ ...s, driver: { ...s.driver, online: false } }));
        return say(tv('va_offline'), heard);
      case 'list': {
        cursor.current = 0;
        const list = visible();
        if (!list.length) return say(tv(pauseState(getState().driver).until ? 'va_paused' : 'va_none'), heard);
        return say(`${list.length === 1 ? tv('va_one') : tv('va_count', { n: list.length })} ${describe(list[0])} ${tv('va_hint')}`, heard);
      }
      case 'next': {
        const list = visible();
        if (cursor.current + 1 >= list.length) return say(list.length ? tv('va_end') : tv('va_none'), heard);
        cursor.current += 1;
        return say(describe(list[cursor.current]), heard);
      }
      case 'repeat':
        return say(r ? `${describe(r)} ${tv('va_hint')}` : tv('va_none'), heard);
      case 'decline': {
        if (!r) return say(tv('va_none'), heard);
        skipped.current.add(r.id);
        const next = currentLoad();
        return say(`${tv('va_skipped')} ${next ? describe(next) : tv('va_end')}`, heard);
      }
      case 'accept':
        if (!r) return say(tv('va_noLoad'), heard);
        return offer(r, r.price, heard);
      case 'more':
      case 'less': {
        if (!r) return say(tv('va_noLoad'), heard);
        const step = intent.n ?? 20;
        const base = mine?.price ?? r.price;
        return offer(r, Math.max(10, base + (intent.kind === 'more' ? step : -step)), heard);
      }
      case 'price':
        if (!r) return say(tv('va_noLoad'), heard);
        return offer(r, intent.n, heard);
      // During a trip: the same steps as the job page's buttons.
      case 'take':
        if (job && job.stage === 'accepted' && !job.takenAt) {
          play('success');
          patchRequest(job.id, { takenAt: Date.now() });
          driverAutoMessage(job.id, 'drvAuto_taken');
          notify('customer', 'nt_taken', 'success', { name: job.driverName ?? '' }, undefined, job.id);
          return say(tv('va_taken'), heard);
        }
        return say(tv('va_notNow'), heard);
      case 'onway':
        if (job && job.stage === 'accepted' && job.takenAt) {
          setStage(job.id, 'enroute');
          return say(tv('va_onway'), heard);
        }
        return say(tv('va_notNow'), heard);
      case 'arrived':
        if (job && job.stage === 'enroute') {
          setStage(job.id, 'arrived');
          return say(tv('va_arrived'), heard);
        }
        if (job && job.stage === 'loaded') {
          setStage(job.id, 'dropoff');
          return say(tv('va_atDrop'), heard);
        }
        return say(tv('va_notNow'), heard);
      case 'loaded':
        if (job && job.stage === 'arrived') {
          setStage(job.id, 'loaded');
          return say(tv('va_loaded'), heard);
        }
        return say(tv('va_notNow'), heard);
      case 'handed':
        if (job && job.stage === 'dropoff') {
          play('celebrate');
          setStage(job.id, 'delivered');
          return say(tv('va_handed'), heard);
        }
        return say(tv('va_notNow'), heard);
      default:
        return say(tv('va_unknown'), heard);
    }
  };

  /** Tap: listen for one command (in the browser this must start straight from the tap). */
  const listen = () => {
    stopSpeaking();
    if (mode === 'listening') {
      stopListening();
      return;
    }
    setMode('listening');
    show({ heard: '' }, 15000);
    const p = listenOnce(lang, (text) => setBubble({ heard: text }));
    if (!canListen()) {
      // Nothing to listen with here (another browser): say so, once.
      p.then(() => {
        setMode('idle');
        show({ said: tv('va_noMic') });
      });
      return;
    }
    p.then((text) => {
      setMode('idle');
      handle(text);
    });
  };

  // New loads are read aloud as they arrive (not the ones already there when the assistant started).
  const seen = useRef<Set<string> | null>(null);
  const loadIds = openLoads()
    .map((r) => r.id)
    .join(',');
  useEffect(() => {
    const ids = loadIds ? loadIds.split(',') : [];
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.find((id) => !seen.current!.has(id));
    ids.forEach((id) => seen.current!.add(id));
    if (!fresh) return;
    const req = getState().requests.find((x) => x.id === fresh);
    if (!req) return;
    cursor.current = Math.max(0, visible().findIndex((x) => x.id === fresh));
    (async () => {
      await say(`${tv('va_new')} ${describe(req)} ${tv('va_hint')}`);
      // Phones: listen for the answer without a touch.
      if (canListenAlone && canListen()) {
        setMode('listening');
        const text = await listenOnce(lang, (h) => setBubble({ heard: h }));
        setMode('idle');
        if (text) handle(text);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIds]);

  // Booked: the price, said once.
  const job = myJob();
  const bookedId = job && job.stage === 'accepted' && !job.takenAt ? job.id : '';
  useEffect(() => {
    if (!bookedId) return;
    const j = getState().requests.find((x) => x.id === bookedId);
    if (j) say(tv('va_booked', { price: money(j.price, lang) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedId]);

  useEffect(
    () => () => {
      stopListening();
      stopSpeaking();
      if (hide.current) clearTimeout(hide.current);
    },
    [],
  );

  // The button breathes while listening, ripples while speaking.
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (mode === 'idle') {
      wave.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: mode === 'listening' ? 1100 : 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [mode, wave]);
  const busy = mode !== 'idle';
  const colour = mode === 'listening' ? '#DC2626' : c.accent;

  return (
    // Bottom corner on the reading side: right in Arabic, left in French and English (fixed, never jumping).
    <View pointerEvents="box-none" style={{ position: 'absolute', ...(layoutRtl() ? { right: 16, alignItems: 'flex-end' } : { left: 16, alignItems: 'flex-start' }), bottom: insets.bottom + 18, gap: 8, maxWidth: 300 }}>
      {bubble && (bubble.heard || bubble.said) ? (
        <Pressable accessibilityRole="button" onPress={() => setBubble(null)} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12, gap: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
          {bubble.heard !== undefined ? (
            <T size={13} muted style={{ fontStyle: 'italic' }}>
              {bubble.heard ? `“${bubble.heard}”` : tv('va_listening')}
            </T>
          ) : null}
          {bubble.said ? (
            <T size={14} weight="semibold">
              {bubble.said}
            </T>
          ) : null}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'listening' ? tv('va_listening') : tv('va_tap')}
        onPress={() => {
          tap();
          listen();
        }}
        style={({ pressed }) => ({ width: 62, height: 62, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
        {busy ? (
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', width: 62, height: 62, borderRadius: 31, backgroundColor: colour, opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }}
          />
        ) : null}
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colour, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8 }}>
          <Ionicons name={mode === 'listening' ? 'radio' : mode === 'speaking' ? 'volume-high' : mode === 'thinking' ? 'ellipsis-horizontal' : 'mic'} size={28} color={mode === 'listening' ? '#FFFFFF' : c.onAccent} />
        </View>
      </Pressable>
    </View>
  );
}
