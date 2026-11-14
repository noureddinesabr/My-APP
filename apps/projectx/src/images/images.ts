import type { ChatImage } from '../ai/types';
import room from '../assets/photos/room.jpg';
import movers from '../assets/photos/movers.jpg';

/** Image handling: photos are resized in the browser (max 1280 px, JPEG) before being stored or sent. */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const SAMPLE_PHOTOS: { id: string; src: string; label: { en: string; fr: string; ar: string } }[] = [
  { id: 'room', src: room, label: { en: 'Living room: sofa & boxes', fr: 'Salon : canapé et cartons', ar: 'صالون وكراطن' } },
  { id: 'movers', src: movers, label: { en: 'Boxes being packed', fr: 'Cartons en préparation', ar: 'كراطن كيتوجدو' } },
];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('image'));
    img.src = src;
  });

async function toJpeg(src: string, max = 1280, quality = 0.82) {
  const img = await loadImage(src);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export async function fileToImage(file: File): Promise<ChatImage> {
  const url = URL.createObjectURL(file);
  try {
    return { id: uid(), dataUrl: await toJpeg(url), name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function sampleToImage(id: string): Promise<ChatImage> {
  const s = SAMPLE_PHOTOS.find((p) => p.id === id)!;
  return { id: uid(), dataUrl: await toJpeg(s.src, 1024), name: `${id}.jpg`, sample: id };
}
export async function videoFrameToImage(video: HTMLVideoElement): Promise<ChatImage> {
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d')!.drawImage(video, 0, 0);
  return { id: uid(), dataUrl: await toJpeg(c.toDataURL('image/jpeg', 0.92)), name: 'camera.jpg' };
}
