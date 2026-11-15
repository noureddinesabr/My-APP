import { useState } from 'react';
import { Check, Globe, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import type { UiLang } from '../models/booking';
import { Sheet } from './ui';

export function Wordmark({ small = false, line }: { small?: boolean; line?: string }) {
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <svg width={small ? 22 : 28} height={small ? 22 : 28} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="xg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#D4D4D4" />
          </linearGradient>
        </defs>
        <path d="M6 5h6.2l3.8 6.1L19.8 5H26l-6.9 10.6L26.4 27h-6.2l-4.2-6.6-4.2 6.6H5.6l7.3-11.4z" fill="url(#xg)" />
      </svg>
      {!small && line && <span className="text-[12.5px] font-medium tracking-wide text-snow/80">{line}</span>}
    </div>
  );
}

const LANGS: [UiLang | 'auto', string][] = [
  ['auto', 'Auto'],
  ['en', 'English'],
  ['fr', 'Français'],
  ['ar', 'العربية'],
];

/** Small language switch (the conversation language is still detected automatically). */
export function LangSwitch() {
  const { s, setPrefs, ui } = useX();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn glass h-10 w-auto gap-1.5 px-3 text-[12.5px] font-semibold" onClick={() => setOpen(true)} aria-label={tr(ui, 'language')} data-testid="lang">
        <Globe size={15} /> {ui === 'ar' ? 'ع' : ui.toUpperCase()}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr(ui, 'language')}>
        <div className="space-y-1 px-3 pb-5">
          {LANGS.map(([v, l]) => (
            <button key={v} onClick={() => (setPrefs({ ui: v }), setOpen(false))} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-start hover:bg-white/5">
              <span>{v === 'auto' ? tr(ui, 'auto') : l}</span>
              {s.prefs.ui === v && <Check size={18} className="text-cyan-300" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, setPrefs, ui, reset } = useX();
  const demo = s.ai === 'demo';
  return (
    <Sheet open={open} onClose={onClose} title={tr(ui, 'menu')}>
      <div className="space-y-4 px-5 pb-6">
        <div className={`rounded-2xl p-3.5 text-[13.5px] leading-relaxed ${demo ? 'bg-amber-400/10 text-amber-100 ring-1 ring-amber-300/20' : 'bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-300/20'}`}>{demo ? tr(ui, 'aiDemoLong') : tr(ui, 'aiRealLong')}</div>
        <div>
          <div className="label mb-2">{tr(ui, 'language')}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {LANGS.map(([v, l]) => (
              <button key={v} onClick={() => setPrefs({ ui: v })} className={`rounded-xl px-2 py-2.5 text-[13px] font-medium ${s.prefs.ui === v ? 'bg-violet-500/30 text-white ring-1 ring-violet-300/40' : 'bg-white/5 text-mist-200'}`}>
                {v === 'auto' ? tr(ui, 'auto') : l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setPrefs({ speak: !s.prefs.speak })} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3.5 text-start" role="switch" aria-checked={s.prefs.speak}>
          {s.prefs.speak ? <Volume2 size={20} className="text-cyan-300" /> : <VolumeX size={20} className="text-mist-400" />}
          <span className="flex-1">{tr(ui, 'speakReplies')}</span>
          <span className={`relative h-6 w-11 rounded-full transition ${s.prefs.speak ? 'bg-violet-500' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.prefs.speak ? 'start-[22px]' : 'start-0.5'}`} />
          </span>
        </button>
        <button onClick={() => (reset(), onClose())} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3.5 text-start text-rose-200 hover:bg-rose-500/10" data-testid="start-over">
          <RotateCcw size={18} /> {tr(ui, 'startOver')}
        </button>
      </div>
    </Sheet>
  );
}
