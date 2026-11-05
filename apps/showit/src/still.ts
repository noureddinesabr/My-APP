import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';

/** A small still (with base64 for the AI) from the first second of a video; null where the phone can't make one. */
export async function stillFromVideo(uri: string): Promise<{ uri: string; base64: string | null } | null> {
  try {
    const frame = await getThumbnailAsync(uri, { time: 1000 });
    const small = await manipulateAsync(frame.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
    return { uri: small.uri, base64: small.base64 ?? null };
  } catch {
    return null;
  }
}
