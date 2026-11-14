import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Camera, ImagePlus, Plus, Sparkles, X as XIcon } from 'lucide-react';
import heroPhoto from '../assets/photos/movers.jpg';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import { SAMPLE_PHOTOS, sampleToImage } from '../images/images';
import { CameraSheet, usePhotoInput } from './PhotoInput';
import { LangSwitch, Wordmark } from './chrome';
import { ModeBadge } from './ui';

/** Screen 1 — full-screen photograph, one clear action. */
export function Welcome() {
  const { s, d, ui, enterChat } = useX();
  const photos = s.photos;
  const add = (imgs: typeof photos) => d({ t: 'set', patch: { photos: [...photos, ...imgs].slice(0, 6) } });
  const pi = usePhotoInput(add);
  const demo = s.ai === 'demo';

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <img src={heroPhoto} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" style={{ filter: 'saturate(.8) contrast(1.1) brightness(.9)', objectPosition: '35% 50%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,4,10,.55) 0%, rgba(5,4,10,.05) 30%, rgba(5,4,10,.35) 55%, rgba(5,4,10,.94) 82%, #05040a 100%)' }} />
      <div className="absolute inset-0 mix-blend-soft-light" style={{ background: 'radial-gradient(120% 80% at 80% 10%, rgba(34,211,238,.35), transparent 60%), radial-gradient(120% 90% at 0% 60%, rgba(124,58,237,.55), transparent 65%)' }} />
      <div className="grain absolute inset-0 opacity-60" />

      <div className="relative mx-auto flex h-full max-w-xl flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <Wordmark line={tr(ui, 'brandLine')} />
          <div className="flex-1" />
          {s.ai && <ModeBadge demo={demo} label={demo ? tr(ui, 'aiDemo') : tr(ui, 'aiReal')} />}
          <LangSwitch />
        </header>

        <div className="flex-1" />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
          <h1 className="font-display text-[clamp(38px,10vw,58px)] font-semibold leading-[1.02] tracking-[-0.02em] text-white">{tr(ui, 'heroTitle')}</h1>
          <p className="mt-3 max-w-sm text-[17px] leading-relaxed text-mist-200">{tr(ui, 'heroSub')}</p>
        </motion.div>

        <AnimatePresence>
          {photos.length > 0 && (
            <motion.div className="mt-6 flex gap-2.5 overflow-x-auto pb-1 pt-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} data-testid="selected-photos">
              {photos.map((p) => (
                <motion.div key={p.id} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative shrink-0">
                  <img src={p.dataUrl} alt="" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/20" />
                  {p.sample && <span className="tag absolute bottom-1 start-1 bg-black/60 text-[10px] text-white">{tr(ui, 'sample')}</span>}
                  <button aria-label="remove photo" onClick={() => d({ t: 'set', patch: { photos: photos.filter((x) => x.id !== p.id) } })} className="absolute -end-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink-800 text-mist-100 ring-1 ring-white/20">
                    <XIcon size={14} />
                  </button>
                </motion.div>
              ))}
              <button onClick={pi.openGallery} className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-dashed border-white/25 text-mist-200 hover:bg-white/5" aria-label={tr(ui, 'addMore')}>
                <Plus size={22} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="mt-6 space-y-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}>
          {photos.length ? (
            <button className="btn-primary w-full text-[16px]" onClick={enterChat} data-testid="continue">
              {tr(ui, 'continueN', { n: photos.length })} <ArrowRight size={18} className="rtl:rotate-180" />
            </button>
          ) : (
            <button className="btn-primary w-full text-[16px]" onClick={pi.openCamera} data-testid="take-photo">
              <Camera size={20} /> {tr(ui, 'takePhoto')}
            </button>
          )}
          <div className="flex gap-3">
            {photos.length ? (
              <button className="btn-glass flex-1" onClick={pi.openCamera}>
                <Camera size={18} /> {tr(ui, 'takePhoto')}
              </button>
            ) : null}
            <button className="btn-glass flex-1" onClick={pi.openGallery} data-testid="gallery">
              <ImagePlus size={18} /> {photos.length ? tr(ui, 'galleryShort') : tr(ui, 'gallery')}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button className="text-[13.5px] text-mist-300 underline-offset-4 hover:text-white hover:underline" onClick={enterChat} data-testid="skip-photo">
              {tr(ui, 'noPhoto')}
            </button>
            <button className="inline-flex items-center gap-1.5 text-[13px] text-violet-300 hover:text-white" onClick={async () => add([await sampleToImage(SAMPLE_PHOTOS[photos.some((p) => p.sample === 'room') ? 1 : 0].id)])} data-testid="sample-photo">
              <Sparkles size={14} /> {tr(ui, 'samplePhotos')}
            </button>
          </div>
        </motion.div>
      </div>
      {pi.inputs}
      <CameraSheet open={pi.liveCam} onClose={pi.closeLiveCam} onPhotos={add} onPickFile={pi.pickFile} ui={ui} />
    </div>
  );
}
