/** Browser version: draws a frame of the video on a canvas. */
export function stillFromVideo(uri: string): Promise<{ uri: string; base64: string | null } | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = uri;
      const done = (v: { uri: string; base64: string | null } | null) => {
        video.removeAttribute('src');
        resolve(v);
      };
      const timer = setTimeout(() => done(null), 8000);
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        const scale = Math.min(1, 1024 / (video.videoWidth || 1024));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((video.videoWidth || 1024) * scale);
        canvas.height = Math.round((video.videoHeight || 768) * scale);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.7);
        done({ uri: url, base64: url.split(',')[1] ?? null });
      };
      video.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
    } catch {
      resolve(null);
    }
  });
}
