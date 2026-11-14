import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, ImagePlus, Mic, MicOff, Paperclip, Sparkles, X as XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatImage } from '../ai/types';
import { tr } from '../i18n/ui';
import type { UiLang } from '../models/booking';
import { SAMPLE_PHOTOS, sampleToImage } from '../images/images';
import { voiceCaps } from '../voice/voice';
import { CameraSheet, usePhotoInput } from './PhotoInput';
import { Sheet } from './ui';

/** Message bar: photo button · text · microphone (or send when there is something to send). */
export function Composer({ ui, onSend, onMic, disabled, draft, setDraft, allowPhotos = true, placeholder, testid = 'composer' }: {
  ui: UiLang;
  onSend: (text: string, images: ChatImage[]) => void;
  onMic?: () => void;
  disabled?: boolean;
  draft: string;
  setDraft: (s: string) => void;
  allowPhotos?: boolean;
  placeholder?: string;
  testid?: string;
}) {
  const [pending, setPending] = useState<ChatImage[]>([]);
  const [menu, setMenu] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const pi = usePhotoInput((imgs) => setPending((p) => [...p, ...imgs].slice(0, 6)));
  const sttOk = !!voiceCaps().stt;
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [draft]);
  useEffect(() => {
    if (draft.endsWith(': ') || draft.endsWith(' ')) ta.current?.focus();
  }, [draft]);
  const canSend = !!draft.trim() || pending.length > 0;
  const submit = () => {
    if (!canSend || disabled) return;
    onSend(draft, pending);
    setDraft('');
    setPending([]);
  };
  return (
    <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.div className="mb-2 flex gap-2 overflow-x-auto px-1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {pending.map((p) => (
              <div key={p.id} className="relative shrink-0">
                <img src={p.dataUrl} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/15" />
                <button className="absolute -end-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink-800 ring-1 ring-white/20" onClick={() => setPending(pending.filter((x) => x.id !== p.id))} aria-label="remove">
                  <XIcon size={12} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="glass flex items-end gap-1.5 rounded-[26px] p-1.5 shadow-card transition focus-within:border-violet-300/40" data-testid={testid}>
        {allowPhotos && (
          <button className="icon-btn text-violet-200 hover:text-white" onClick={() => setMenu(true)} aria-label={tr(ui, 'attach')} data-testid="attach">
            <Camera size={21} />
          </button>
        )}
        <textarea
          ref={ta}
          rows={1}
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? tr(ui, 'placeholder')}
          className="max-h-[140px] min-h-[44px] flex-1 resize-none bg-transparent px-2 focus-visible:outline-none py-[11px] text-[15.5px] leading-[22px] text-white outline-none placeholder:text-mist-400"
          data-testid="input"
        />
        {canSend || !onMic ? (
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }} onClick={submit} disabled={!canSend || disabled} aria-label={tr(ui, 'send')} data-testid="send">
            <ArrowUp size={20} />
          </button>
        ) : (
          <button className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 ${sttOk ? 'text-white' : 'bg-white/5 text-mist-400'}`} style={sttOk ? { background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)' } : undefined} onClick={onMic} aria-label={tr(ui, 'mic')} title={sttOk ? tr(ui, 'mic') : tr(ui, 'noMic')} data-testid="mic">
            {sttOk ? <Mic size={20} /> : <MicOff size={19} />}
          </button>
        )}
      </div>
      {pi.inputs}
      <CameraSheet open={pi.liveCam} onClose={pi.closeLiveCam} onPhotos={(imgs) => setPending((p) => [...p, ...imgs])} onPickFile={pi.pickFile} ui={ui} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={tr(ui, 'attach')}>
        <div className="grid gap-2 px-5 pb-6">
          <button className="btn-glass justify-start" onClick={() => (setMenu(false), pi.openCamera())}>
            <Camera size={18} /> {tr(ui, 'takePhoto')}
          </button>
          <button className="btn-glass justify-start" onClick={() => (setMenu(false), pi.openGallery())}>
            <ImagePlus size={18} /> {tr(ui, 'gallery')}
          </button>
          <div className="label mt-2">{tr(ui, 'samplePhotos')}</div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_PHOTOS.map((p) => (
              <button key={p.id} className="overflow-hidden rounded-2xl bg-white/5 text-start ring-1 ring-white/10 hover:ring-violet-300/40" onClick={async () => {
                  setMenu(false);
                  const img = await sampleToImage(p.id);
                  setPending((x) => [...x, img]);
                }} data-testid={`sample-${p.id}`}>
                <img src={p.src} alt="" className="h-24 w-full object-cover" />
                <div className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] text-mist-200">
                  <Sparkles size={12} className="text-violet-300" /> {p.label[ui]}
                </div>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 pt-1 text-[12px] text-mist-400">
            <Paperclip size={12} /> JPG · PNG · HEIC
          </p>
        </div>
      </Sheet>
    </div>
  );
}
