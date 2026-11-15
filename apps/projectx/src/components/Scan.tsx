import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import { scanPhotos, type SeenItem } from '../ai/vision';
import { categoryOf, estimateKg } from '../models/catalog';
import type { CargoItem } from '../models/booking';
import { sfx } from '../lib/sfx';
import { Orb } from './Orb';
import { iconOf, nameOf, PICKS, Stepper } from './items';
import { Sheet, spring } from './ui';

type Phase = 'scanning' | 'done' | 'pick';

/** Screen 2 — the AI reads the photo (the only AI step), then you fix the counts with taps. */
export function Scan() {
  const { s, ui, go, setBooking } = useX();
  const photos = s.photos;
  // keep earlier results only if the photos haven't changed since
  const had = photos.map((p) => p.id).join() === s.booking.cargo.images.join() ? s.booking.cargo.items : [];
  const [phase, setPhase] = useState<Phase>(had.length ? 'done' : photos.length ? 'scanning' : 'pick');
  const [seen, setSeen] = useState<SeenItem[]>([]);
  const [shown, setShown] = useState(0);
  const [source, setSource] = useState<'ai' | 'sample' | 'none' | null>(null);
  const [items, setItems] = useState<CargoItem[]>(had);
  const [picker, setPicker] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (phase !== 'scanning' || started.current) return;
    started.current = true;
    sfx.scan();
    const t0 = Date.now();
    scanPhotos(photos).then(async (r) => {
      await new Promise((ok) => setTimeout(ok, Math.max(0, 2300 - (Date.now() - t0))));
      setSource(r.source);
      setSeen(r.items);
      setItems(r.items.map(({ key, qty, label }) => ({ key, qty, label })));
      for (let i = 1; i <= r.items.length; i++) {
        await new Promise((ok) => setTimeout(ok, 380));
        setShown(i);
        sfx.ping(i - 1);
      }
      setPhase(r.items.length ? 'done' : 'pick');
      if (r.items.length) setTimeout(() => sfx.success(), 250);
    });
  }, [phase, photos]);

  const add = (key: string) => {
    sfx.select();
    setItems((cur) => (cur.some((i) => i.key === key) ? cur.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)) : [...cur, { key, qty: 1 }]));
  };
  const setQty = (key: string, qty: number) => {
    sfx.tap();
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.key !== key) : cur.map((i) => (i.key === key ? { ...i, qty } : i))));
  };
  const kg = estimateKg(items);
  const next = () => {
    sfx.select();
    setBooking((b) => ({
      ...b,
      cargo: { ...b.cargo, items, items_confirmed: true, category: categoryOf(items.map((i) => i.key)) ?? 'other', description: items.map((i) => `${i.qty}× ${i.label ?? i.key}`).join(', '), estimated_weight_kg: kg, weight_source: 'estimate', images: photos.map((p) => p.id) },
    }));
    go('card');
  };

  const photo = photos[photoIdx];
  return (
    <div className="aurora relative flex h-full flex-col overflow-hidden bg-ink-950">
      <header className="relative z-10 flex items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
        <button className="icon-btn" onClick={() => (sfx.tap(), go('welcome'))} aria-label={tr(ui, 'back')}>
          <ChevronLeft size={22} className="rtl:rotate-180" />
        </button>
        <h1 className="flex-1 font-display text-[18px] font-semibold">{tr(ui, 'scanTitle')}</h1>
        {phase === 'scanning' && <Orb size={30} state="thinking" />}
      </header>

      <div className="scroll-thin relative z-0 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-4 px-4 pb-6">
          {photo && (
            <div className="relative overflow-hidden rounded-[26px] ring-1 ring-white/10" data-testid="scan-photo">
              <img src={photo.dataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
              {/* scanning layer */}
              <AnimatePresence>
                {phase === 'scanning' && shown === 0 && (
                  <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="absolute inset-0 bg-[#000]/30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                    <motion.div className="absolute inset-x-0 h-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,.3) 80%, rgba(255,255,255,.95))' }} animate={{ top: ['-25%', '100%'] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} />
                    {['start-3 top-3 border-s-2 border-t-2', 'end-3 top-3 border-e-2 border-t-2', 'start-3 bottom-3 border-s-2 border-b-2', 'end-3 bottom-3 border-e-2 border-b-2'].map((c) => (
                      <span key={c} className={`absolute h-7 w-7 rounded-sm border-snow ${c}`} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* detected objects */}
              {photoIdx === 0 &&
                seen.slice(0, shown).map((it, i) => {
                  const Icon = iconOf(it.key);
                  return (
                    <motion.div key={it.key + i} className="absolute" style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%` }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
                      <span className="absolute -left-3 -top-3 h-6 w-6 animate-ping rounded-full bg-snow/60" />
                      <div className="relative -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-snow px-2.5 py-1.5 text-[12.5px] font-semibold text-[#000] shadow-glow" dir="auto">
                        <Icon size={13} className="me-1 inline -translate-y-px text-cyan-300" />
                        {it.qty > 1 ? `${it.qty} × ` : ''}
                        {nameOf(it, ui)}
                      </div>
                    </motion.div>
                  );
                })}
              {phase === 'scanning' && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000]/70 to-transparent px-4 pb-3 pt-8 text-[14px] font-medium text-snow">
                  <Sparkles size={14} className="me-1.5 inline" /> {tr(ui, 'scanning')}
                </div>
              )}
              {photos.length > 1 && (
                <div className="absolute end-2 top-2 flex gap-1.5">
                  {photos.map((p, i) => (
                    <button key={p.id} onClick={() => setPhotoIdx(i)} className={`h-10 w-10 overflow-hidden rounded-xl ring-2 ${i === photoIdx ? 'ring-cyan-300' : 'ring-white/20'}`}>
                      <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'scanning' && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="h-[60px] rounded-2xl bg-white/[.04] ring-1 ring-white/[.06]" animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          )}
          {phase !== 'scanning' && (
            <motion.div className="space-y-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
              {photo && source === 'none' && phase === 'pick' && <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-[13.5px] text-amber-100 ring-1 ring-amber-300/20">{tr(ui, 'cantRead')}</p>}
              {phase === 'done' && items.length > 0 && (
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="font-display text-[20px] font-semibold">{tr(ui, 'foundN', { n: items.length })}</h2>
                  {source && source !== 'none' && <span className="text-[12px] text-mist-400">{tr(ui, source === 'ai' ? 'readByAi' : 'readSample')}</span>}
                </div>
              )}
              {phase === 'pick' && !items.length && <h2 className="px-1 font-display text-[22px] font-semibold">{tr(ui, 'whatMoving')}</h2>}

              <div className="space-y-2" data-testid="items">
                <AnimatePresence initial={false}>
                  {items.map((it) => {
                    const Icon = iconOf(it.key);
                    return (
                      <motion.div key={it.key} layout className="flex items-center gap-3 rounded-2xl bg-white/[.05] p-2.5 ps-3 ring-1 ring-white/10" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -30 }} transition={spring}>
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1 truncate text-[15px] font-medium" dir="auto">
                          {nameOf(it, ui)}
                        </div>
                        <Stepper value={it.qty} onChange={(n) => setQty(it.key, n)} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {phase === 'pick' || picker ? (
                <PickGrid ui={ui} items={items} onAdd={add} />
              ) : (
                <button className="btn-ghost w-full border border-dashed border-white/15" onClick={() => (sfx.tap(), setPicker(true))} data-testid="add-item">
                  <Plus size={17} /> {tr(ui, 'addItem')}
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <div className="relative z-10 border-t border-white/[.06] bg-ink-950/80 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1 text-[13px] text-mist-300">{items.length ? tr(ui, 'weightEst', { w: kg }) : tr(ui, 'tapItems')}</div>
          <button className="btn-primary px-6" disabled={!items.length || phase === 'scanning'} onClick={next} data-testid="scan-next">
            {tr(ui, 'next')} <ArrowRight size={18} className="rtl:rotate-180" />
          </button>
        </div>
      </div>
      <Sheet open={picker && phase === 'done'} onClose={() => setPicker(false)} title={tr(ui, 'addItem')}>
        <div className="px-4 pb-6">
          <PickGrid ui={ui} items={items} onAdd={(k) => (add(k), setPicker(false))} />
        </div>
      </Sheet>
    </div>
  );
}

function PickGrid({ ui, items, onAdd }: { ui: Parameters<typeof nameOf>[1]; items: CargoItem[]; onAdd: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="pick-grid">
      {PICKS.map((k) => {
        const Icon = iconOf(k);
        const q = items.find((i) => i.key === k)?.qty ?? 0;
        return (
          <motion.button key={k} whileTap={{ scale: 0.93 }} onClick={() => onAdd(k)} className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-center text-[12.5px] font-medium ring-1 transition ${q ? 'bg-violet-500/20 text-white ring-violet-300/50' : 'bg-white/[.04] text-mist-200 ring-white/10 hover:bg-white/[.08]'}`} dir="auto">
            <Icon size={24} className={q ? 'text-cyan-300' : 'text-violet-200'} />
            <span className="leading-tight">{nameOf({ key: k, qty: 1 }, ui)}</span>
            {q > 0 && (
              <span className="absolute end-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#000] px-1 text-[11px] font-bold text-snow">
                {q > 1 ? q : <Check size={12} strokeWidth={3} />}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
