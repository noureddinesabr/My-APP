type Still = { uri: string; base64: string | null };

/**
 * Browser version: draws a few frames of the video (near the start, middle and end) on a canvas,
 * so the AI sees more of the load. Phone browsers can be slow to decode a fresh recording, so
 * each frame is tried by seeking and, if that never answers, by playing the video muted.
 */
export async function stillsFromVideo(uri: string, count = 3): Promise<Still[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = uri;
  const wait = (event: string, ms: number) =>
    new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        video.removeEventListener(event, onOk);
        video.removeEventListener('error', onErr);
        resolve(ok);
      };
      const onOk = () => done(true);
      const onErr = () => done(false);
      const timer = setTimeout(() => done(false), ms);
      video.addEventListener(event, onOk, { once: true });
      video.addEventListener('error', onErr, { once: true });
    });
  try {
    video.load();
    if (video.readyState < 1 && !(await wait('loadedmetadata', 8000))) return [];
    if (video.readyState < 2) {
      // Some phones only decode after playback starts.
      await video.play().catch(() => {});
      await wait('loadeddata', 5000);
      video.pause();
    }
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const times = duration ? Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count) : [0];
    const out: Still[] = [];
    for (const time of times) {
      if (Math.abs(video.currentTime - time) > 0.05) {
        video.currentTime = time;
        if (!(await wait('seeked', 4000))) {
          await video.play().catch(() => {});
          await new Promise((r) => setTimeout(r, 400));
          video.pause();
        }
      }
      const frame = draw(video);
      if (frame) out.push(frame);
    }
    return out;
  } catch {
    return [];
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

function draw(video: HTMLVideoElement): Still | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, 1024 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  try {
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.7);
    const base64 = url.split(',')[1] ?? null;
    // A blank frame (nothing decoded yet) is tiny; skip it.
    return base64 && base64.length > 3000 ? { uri: url, base64 } : null;
  } catch {
    return null;
  }
}
