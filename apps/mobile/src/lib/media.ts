import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { Media } from '@/backend/types';

/** HD photos: long side in pixels. */
const PHOTO_SIDE = 1920;
const MAX_VIDEO_SECONDS = 60;
/** The preview's file store takes files up to 20 MiB. */
const MAX_BYTES = 20 * 1024 * 1024;
/** Files this small are embedded when there is no file store (a plain browser tab), so they survive a reload. */
const EMBED_BYTES = 200 * 1024;

export type MediaErrorCode = 'permission' | 'tooLarge' | 'unsupported' | 'failed';

export class MediaError extends Error {
  constructor(public code: MediaErrorCode) {
    super(code);
  }
}

type Assets = { upload(blob: Blob, options?: { type?: string }): Promise<{ id: string; url: string }> };
type Runtime = { use(name: 'assets'): Promise<Assets | null> };

let assetsPromise: Promise<Assets | null> | null = null;

/** The preview page's file store, or null outside the preview (or for viewers who may not upload). */
function previewAssets() {
  if (!assetsPromise) {
    const runtime = (globalThis as { claude?: Runtime }).claude;
    assetsPromise = runtime?.use ? runtime.use('assets').catch(() => null) : Promise.resolve(null);
  }
  return assetsPromise;
}

/**
 * Saves a picked or recorded file where the other side can open it, and returns its URL.
 * - Preview page: uploaded to the page's shared file store.
 * - Phone app: the file stays on the phone (test mode is on-device until the hosted backend exists).
 * - Plain browser tab: small files are embedded, larger ones stay available until the tab reloads.
 */
export async function storeFile(uri: string, kind: Media['kind'], mimeType?: string | null): Promise<string> {
  if (Platform.OS !== 'web') return uri;
  let blob = await (await fetch(uri)).blob();
  if (kind === 'audio') blob = await playableAudio(blob, mimeType);
  const type = uploadType(kind, blob.type || mimeType || '');
  if (blob.size > MAX_BYTES) throw new MediaError('tooLarge');
  const assets = await previewAssets();
  if (assets) {
    try {
      const { id } = await assets.upload(blob, { type });
      return `/_blob/${id}`;
    } catch (error) {
      const code = (error as { code?: string }).code;
      throw new MediaError(code === 'too_large' ? 'tooLarge' : code === 'unsupported_type' ? 'unsupported' : 'failed');
    }
  }
  return blob.size <= EMBED_BYTES ? toDataUri(blob) : uri.startsWith('blob:') ? uri : URL.createObjectURL(blob);
}

/** The file types the preview store accepts; voice notes travel in a WebM or MP4 container. */
function uploadType(kind: Media['kind'], mime: string) {
  if (kind === 'photo') return 'image/jpeg';
  if (/webm/.test(mime)) return 'video/webm';
  if (/mp4|m4a|aac|quicktime|mov/.test(mime)) return 'video/mp4';
  throw new MediaError('unsupported');
}

/** Audio already in WebM or MP4 is kept; anything else (MP3, WAV, OGG…) is re-recorded into one. */
async function playableAudio(blob: Blob, mimeType?: string | null) {
  const mime = blob.type || mimeType || '';
  if (/webm|mp4|m4a|aac/.test(mime)) return blob;
  return reencodeAudio(blob);
}

async function reencodeAudio(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (buffer.duration > 180) throw new MediaError('tooLarge');
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new MediaError('unsupported');
    const recorder = new MediaRecorder(destination.stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start();
    source.onended = () => recorder.stop();
    source.start();
    await done;
    return new Blob(chunks, { type: mimeType.split(';')[0] });
  } catch (error) {
    throw error instanceof MediaError ? error : new MediaError('unsupported');
  } finally {
    context.close().catch(() => {});
  }
}

function toDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Takes (camera) or picks (gallery) a photo or video and stores it.
 * Photos are kept in HD (1920 px); videos up to 60 s.
 */
export async function captureMedia(
  source: 'camera' | 'library',
  types: ('photo' | 'video')[] = ['photo', 'video'],
): Promise<Media | null> {
  const mediaTypes = types.map((type) => (type === 'photo' ? 'images' : 'videos')) as ImagePicker.MediaType[];
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes,
    quality: 0.85,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
  };
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new MediaError('permission');
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  if (asset.type === 'video' || asset.mimeType?.startsWith('video/')) {
    // Browsers don't report the length reliably, so it is measured there.
    const durationMs = Platform.OS === 'web' ? await mediaDuration(asset.uri, 'video') : (asset.duration ?? undefined);
    if ((durationMs ?? 0) > (MAX_VIDEO_SECONDS + 1) * 1000) throw new MediaError('tooLarge');
    const url = await storeFile(asset.uri, 'video', asset.mimeType);
    return { kind: 'video', url, durationMs };
  }

  const photo = Platform.OS === 'web' ? await shrinkOnWeb(asset.uri, PHOTO_SIDE) : await shrinkOnPhone(asset.uri, asset.width, asset.height);
  return { kind: 'photo', url: await storeFile(photo, 'photo', 'image/jpeg') };
}

async function shrinkOnPhone(uri: string, width: number, height: number) {
  const resize = width >= height ? { width: Math.min(width, PHOTO_SIDE) } : { height: Math.min(height, PHOTO_SIDE) };
  const small = await manipulateAsync(uri, [{ resize }], { compress: 0.82, format: SaveFormat.JPEG });
  return small.uri;
}

/** Returns a JPEG blob URL no larger than `maxSide`. */
function shrinkOnWeb(uri: string, maxSide: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('encode'))), 'image/jpeg', 0.82);
    };
    image.onerror = reject;
    image.src = uri;
  });
}

/**
 * Browser fallback when the microphone can't be used (the preview page blocks it):
 * choose an audio file. On a phone browser, the system picker can also record one.
 */
export function chooseAudioFile(): Promise<{ uri: string; type: string; durationMs?: number } | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const uri = URL.createObjectURL(file);
      resolve({ uri, type: file.type, durationMs: await mediaDuration(uri, 'audio') });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Length in ms of an audio or video file in the browser (undefined when unknown). */
function mediaDuration(uri: string, kind: 'audio' | 'video') {
  return new Promise<number | undefined>((resolve) => {
    const element = document.createElement(kind);
    element.preload = 'metadata';
    element.onloadedmetadata = () => resolve(Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined);
    element.onerror = () => resolve(undefined);
    element.src = uri;
  });
}
