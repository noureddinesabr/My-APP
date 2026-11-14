import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw } from 'lucide-react';
import type { ChatImage } from '../ai/types';
import { fileToImage, videoFrameToImage } from '../images/images';
import { tr } from '../i18n/ui';
import type { UiLang } from '../models/booking';
import { Sheet } from './ui';

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Photo inputs. Phones: the native camera via a file input with `capture`. Desktop: a live camera
 * window (getUserMedia) when available, otherwise the file picker. The gallery accepts several files.
 */
export function usePhotoInput(onPhotos: (imgs: ChatImage[]) => void) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [liveCam, setLiveCam] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = await Promise.all([...files].slice(0, 6).map(fileToImage));
    onPhotos(imgs);
  };
  const inputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (handle(e.target.files), (e.target.value = ''))} data-testid="camera-input" />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (handle(e.target.files), (e.target.value = ''))} data-testid="gallery-input" />
    </>
  );
  return {
    inputs,
    openCamera: () => {
      if (!coarse() && typeof navigator.mediaDevices?.getUserMedia === 'function') setLiveCam(true);
      else camRef.current?.click();
    },
    openGallery: () => galRef.current?.click(),
    liveCam,
    closeLiveCam: () => setLiveCam(false),
    pickFile: () => galRef.current?.click(),
  };
}

export function CameraSheet({ open, onClose, onPhotos, onPickFile, ui }: { open: boolean; onClose: () => void; onPhotos: (imgs: ChatImage[]) => void; onPickFile: () => void; ui: UiLang }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  const [shots, setShots] = useState<ChatImage[]>([]);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    setErr(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      })
      .catch(() => setErr(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [open, facing]);
  const close = () => {
    if (shots.length) onPhotos(shots);
    setShots([]);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={tr(ui, 'camTitle')} label="camera">
      <div className="space-y-3 px-5 pb-5">
        {err ? (
          <div className="space-y-3 rounded-2xl bg-white/5 p-4 text-[14px] text-mist-200">
            <p>{tr(ui, 'camDenied')}</p>
            <button className="btn-glass w-full" onClick={() => (onClose(), onPickFile())}>
              <ImagePlus size={18} /> {tr(ui, 'camChoose')}
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <button className="icon-btn glass absolute end-2 top-2" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="switch camera">
              <RefreshCw size={18} />
            </button>
          </div>
        )}
        {shots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {shots.map((s) => (
              <img key={s.id} src={s.dataUrl} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/15" />
            ))}
          </div>
        )}
        {!err && (
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={async () => video.current && video.current.videoWidth && setShots([...shots, await videoFrameToImage(video.current)])}>
              <Camera size={18} /> {tr(ui, 'camCapture')}
            </button>
            <button className="btn-glass" onClick={close} disabled={!shots.length}>
              {tr(ui, 'camDone')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
