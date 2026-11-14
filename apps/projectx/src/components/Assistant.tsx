import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ClipboardList, Keyboard, MoreHorizontal, Square, X as XIcon } from 'lucide-react';
import { useX } from '../booking/store';
import { tr, type UiKey } from '../i18n/ui';
import type { ChatMsg } from '../ai/types';
import type { Lang } from '../models/booking';
import { useVoice } from '../voice/useVoice';
import { Orb } from './Orb';
import { Composer } from './Composer';
import { BookingSummary, MissingLine, progressOf } from './Review';
import { MenuSheet } from './chrome';
import { ModeBadge, Sheet, Toast, spring } from './ui';

const EDIT_PROMPT: Partial<Record<UiKey, [string, string, string]>> = {
  rCargo: ['Change the cargo: ', 'Modifier le chargement : ', 'بدّل السلعة: '],
  rRoute: ['Change the address: ', 'Modifier l’adresse : ', 'بدّل العنوان: '],
  rWhen: ['Change the time: ', 'Modifier l’horaire : ', 'بدّل الوقت: '],
  rHelp: ['Change the help: ', 'Modifier l’aide : ', 'بدّل المساعدة: '],
  rNotes: ['Change the notes: ', 'Modifier les notes : ', 'بدّل الملاحظات: '],
};

/** Screen 2 — the AI transport assistant (voice, text and photos). */
export function Assistant() {
  const { s, ui, send, search, go } = useX();
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const [req, setReq] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);
  const lang: Lang = s.lang ?? (ui === 'ar' ? 'darija' : ui);
  const voice = useVoice({
    lang,
    send: async (text) => {
      const r = await send(text);
      return r ? { text: r.text, lang: r.lang } : null;
    },
    onError: (k) => setToast(tr(ui, k)),
  });
  const orbState = voice.active ? voice.state : s.thinking ? 'thinking' : 'idle';
  const hero = voice.active || (s.messages.length <= 1 && !s.thinking);
  const prog = progressOf(s.booking);

  useEffect(() => {
    if (s.notice === 'fallback') setToast(tr(ui, 'aiFallback'));
  }, [s.notice, ui]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [s.messages.length, s.thinking, voice.partial, s.quick.length]);

  const status = orbState === 'listening' ? tr(ui, 'statusListening') : orbState === 'thinking' ? tr(ui, 'statusThinking') : orbState === 'speaking' ? tr(ui, 'statusSpeaking') : tr(ui, 'statusIdle');
  const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant');
  const demo = s.ai === 'demo';

  return (
    <div className="aurora relative flex h-full flex-col overflow-hidden bg-ink-950">
      {/* header */}
      <header className="relative z-10 flex items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
        <button className="icon-btn" onClick={() => go('welcome')} aria-label={tr(ui, 'back')}>
          <ChevronLeft size={22} className="rtl:rotate-180" />
        </button>
        <AnimatePresence>
          {!hero && (
            <motion.div layoutId="orb" transition={spring} className="shrink-0">
              <Orb size={34} state={orbState} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-display text-[16px] font-semibold">X</span>
            {s.ai && <ModeBadge demo={demo} label={demo ? tr(ui, 'aiDemo') : tr(ui, 'aiReal')} onClick={() => setMenu(true)} />}
          </div>
          <div className="text-[12.5px] text-mist-400" aria-live="polite" data-testid="status">
            {status}
          </div>
        </div>
        <button onClick={() => setReq(true)} className="glass flex h-10 items-center gap-2 rounded-full ps-2 pe-3 text-[12.5px] font-semibold text-mist-100" data-testid="request-pill" aria-label={tr(ui, 'request')}>
          <Ring done={prog.done} total={prog.total} />
          <span className="hidden sm:inline">{tr(ui, 'request')}</span>
          <span dir="ltr">
            {prog.done}/{prog.total}
          </span>
        </button>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label={tr(ui, 'menu')} data-testid="menu">
          <MoreHorizontal size={22} />
        </button>
      </header>

      {/* hero orb */}
      <AnimatePresence>
        {hero && (
          <motion.div className="relative z-0 flex flex-col items-center pt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
            <motion.button layoutId="orb" transition={spring} onClick={voice.active ? voice.tapOrb : () => voice.startListening()} aria-label={voice.state === 'speaking' ? tr(ui, 'tapToInterrupt') : tr(ui, 'mic')} data-testid="hero-orb">
              <Orb size={voice.active ? 168 : 132} state={orbState} level={voice.partial ? 0.6 : 0.1} />
            </motion.button>
            <div className="mt-3 h-5 text-[13px] font-medium text-violet-200/90">{voice.active ? (voice.state === 'speaking' ? tr(ui, 'tapToInterrupt') : voice.state === 'listening' ? tr(ui, 'tapToStop') : status) : ''}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* conversation */}
      <div ref={scroller} className="scroll-thin relative z-0 min-h-0 flex-1 overflow-y-auto" data-testid="thread">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-4 pt-2">
          {s.messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
          {s.thinking && (
            <motion.div className="flex items-center gap-2.5 ps-1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} data-testid="typing">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
            </motion.div>
          )}
          {lastAssistant?.card === 'review' && s.ready && !s.thinking && (
            <motion.section className="glass rounded-3xl p-4 shadow-glow" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} data-testid="review-card">
              <div className="mb-1 flex items-center gap-2">
                <ClipboardList size={17} className="text-cyan-300" />
                <h2 className="font-display text-[16px] font-semibold">{tr(ui, 'reviewTitle')}</h2>
              </div>
              <BookingSummary b={s.booking} ui={ui} now={now} onEdit={(k) => setDraft(EDIT_PROMPT[k]?.[ui === 'en' ? 0 : ui === 'fr' ? 1 : 2] ?? '')} />
              <button className="btn-primary mt-3 w-full text-[16px]" onClick={search} data-testid="find-transport">
                {tr(ui, 'findTransport')} <ArrowRight size={18} className="rtl:rotate-180" />
              </button>
              <p className="mt-2.5 text-center text-[12.5px] text-mist-400">{tr(ui, 'reviewHint')}</p>
            </motion.section>
          )}
          {!s.thinking && s.quick.length > 0 && !voice.active && (
            <motion.div className="flex flex-wrap gap-2 ps-1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} data-testid="chips">
              {s.quick.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} dir="auto">
                  {q}
                </button>
              ))}
            </motion.div>
          )}
          {voice.active && voice.partial && (
            <div className="self-end rounded-3xl rounded-ee-md bg-white/5 px-4 py-2.5 text-[15px] italic text-mist-200 ring-1 ring-white/10" dir="auto">
              {voice.partial}
            </div>
          )}
        </div>
      </div>

      {/* bottom: voice controls or composer */}
      {voice.active ? (
        <motion.div className="relative z-10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-1.5" aria-label={tr(ui, 'listenIn')}>
              {(['darija', 'ar', 'fr', 'en'] as Lang[]).map((l) => (
                <button key={l} onClick={() => voice.setListenLang(l)} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ${voice.listenLang === l ? 'bg-violet-500/30 text-white ring-1 ring-violet-300/40' : 'bg-white/5 text-mist-300'}`}>
                  {l === 'darija' ? 'الدارجة' : l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}
                </button>
              ))}
            </div>
            <div className="flex w-full items-center gap-3">
              <button className="btn-glass flex-1" onClick={voice.end} data-testid="type-instead">
                <Keyboard size={18} /> {tr(ui, 'typeInstead')}
              </button>
              <button className="btn-primary flex-1" onClick={voice.tapOrb} data-testid="voice-main">
                {voice.state === 'listening' ? <Square size={16} /> : null}
                {voice.state === 'listening' ? tr(ui, 'stop') : voice.state === 'speaking' ? tr(ui, 'tapToInterrupt') : tr(ui, 'mic')}
              </button>
              <button className="icon-btn glass" onClick={voice.end} aria-label={tr(ui, 'endVoice')}>
                <XIcon size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="relative z-10 mx-auto w-full max-w-2xl">
          <Composer ui={ui} draft={draft} setDraft={setDraft} disabled={s.thinking} onSend={(t, imgs) => send(t, imgs)} onMic={() => voice.startListening()} />
        </div>
      )}

      <Sheet open={req} onClose={() => setReq(false)} title={tr(ui, 'request')}>
        <div className="space-y-3 px-5 pb-6">
          <MissingLine b={s.booking} ui={ui} />
          <BookingSummary b={s.booking} ui={ui} now={now} onEdit={(k) => (setReq(false), setDraft(EDIT_PROMPT[k]?.[ui === 'en' ? 0 : ui === 'fr' ? 1 : 2] ?? ''))} />
          {s.ready && (
            <button className="btn-primary w-full" onClick={() => (setReq(false), search())}>
              {tr(ui, 'findTransport')} <ArrowRight size={18} className="rtl:rotate-180" />
            </button>
          )}
          <details className="rounded-xl bg-black/30 p-3 text-[11.5px] text-mist-400" dir="ltr">
            <summary className="cursor-pointer select-none">booking.json</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({ ...s.booking, meta: undefined }, null, 1)}</pre>
          </details>
        </div>
      </Sheet>
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Ring({ done, total }: { done: number; total: number }) {
  const p = done / total;
  const C = 2 * Math.PI * 9;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
      <motion.circle cx="12" cy="12" r="9" fill="none" stroke="url(#rg)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - p) }} transition={{ duration: 0.6 }} />
      <defs>
        <linearGradient id="rg" x1="0" x2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Message({ m }: { m: ChatMsg }) {
  if (m.role === 'user')
    return (
      <motion.div className="flex flex-col items-end gap-1.5" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} data-testid="msg-user">
        {m.images?.length ? (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {m.images.map((i) => (i.dataUrl ? <img key={i.id} src={i.dataUrl} alt="" className="h-28 w-28 rounded-2xl object-cover ring-1 ring-white/15 sm:h-36 sm:w-36" /> : null))}
          </div>
        ) : null}
        {m.text && (
          <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-ee-md px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-glow" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,.85), rgba(99,102,241,.8))' }} dir="auto">
            {m.text}
          </div>
        )}
      </motion.div>
    );
  return (
    <motion.div className="flex items-start gap-2.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} data-testid="msg-ai">
      <div className="mt-1 h-6 w-6 shrink-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #e0f7ff, #8b5cf6 45%, #1e1b4b 80%)', boxShadow: '0 0 14px rgba(139,92,246,.6)' }} />
      <div className="min-w-0 max-w-[88%]">
        <div className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-mist-100" dir="auto">
          {m.text}
        </div>
      </div>
    </motion.div>
  );
}
