import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '../models/booking';
import { host } from '../lib/hostCapabilities';
import { canSpeak, listen, speak, stopSpeaking, voiceCaps, type Listening } from './voice';
import type { OrbState } from '../components/Orb';

/**
 * Voice conversation controller. Tap the mic → listening → the transcript is sent → thinking →
 * the reply is spoken → listening again (hands-free, where the browser allows it).
 * Tapping the orb while it speaks interrupts it.
 */
export function useVoice(opts: { lang: Lang; send: (text: string) => Promise<{ text: string; lang?: Lang } | null>; onError: (key: 'noMic' | 'micError' | 'noVoiceOut') => void }) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<OrbState>('idle');
  const [partial, setPartial] = useState('');
  const [listenLang, setListenLang] = useState<Lang>(opts.lang);
  const cur = useRef<Listening | null>(null);
  const activeRef = useRef(false);
  const o = useRef(opts);
  o.current = opts;
  useEffect(() => setListenLang(opts.lang), [opts.lang]);

  const startListening = useCallback(async (lang?: Lang) => {
    if (!voiceCaps().stt) {
      o.current.onError('noMic');
      return;
    }
    stopSpeaking();
    cur.current?.cancel();
    activeRef.current = true;
    setActive(true);
    setPartial('');
    setState('listening');
    const l = listen(lang ?? listenLangRef.current, (p) => setPartial(p));
    cur.current = l;
    const res = await l.done;
    if (cur.current !== l) return;
    cur.current = null;
    if (!res.text) {
      setState('idle');
      if (res.error && res.error !== 'cancelled' && res.error !== 'no-speech' && res.error !== 'aborted') o.current.onError('micError');
      return;
    }
    setState('thinking');
    const reply = await o.current.send(res.text);
    setPartial('');
    if (!activeRef.current) return;
    if (!reply) {
      setState('idle');
      return;
    }
    const rl = reply.lang ?? o.current.lang;
    if (canSpeak(rl)) {
      setState('speaking');
      await speak(reply.text, rl);
    } else o.current.onError('noVoiceOut');
    if (!activeRef.current || stateRef.current !== 'speaking') return;
    // hands-free: keep the conversation going (browser speech only; page dictation needs a tap)
    if (!host.dictation) startListening(rl);
    else setState('idle');
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const listenLangRef = useRef(listenLang);
  listenLangRef.current = listenLang;

  /** The orb (or the main voice button) was tapped. */
  const tapOrb = useCallback(() => {
    const st = stateRef.current;
    if (st === 'listening') cur.current?.stop();
    else if (st === 'speaking') {
      stopSpeaking();
      setState('idle');
      startListening();
    } else if (st === 'idle') startListening();
  }, [startListening]);

  const end = useCallback(() => {
    activeRef.current = false;
    cur.current?.cancel();
    cur.current = null;
    stopSpeaking();
    setActive(false);
    setPartial('');
    setState('idle');
  }, []);

  useEffect(() => () => end(), [end]);

  return { active, state, partial, listenLang, setListenLang, startListening, tapOrb, end };
}
