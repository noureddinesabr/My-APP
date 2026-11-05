import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';

type Still = { uri: string; base64: string | null };

/** A few stills (with base64 for the AI) from a video: near the start, then a few seconds in. */
export async function stillsFromVideo(uri: string, count = 3): Promise<Still[]> {
  const out: Still[] = [];
  for (const time of [800, 4000, 10000].slice(0, count)) {
    try {
      const frame = await getThumbnailAsync(uri, { time });
      const small = await manipulateAsync(frame.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      // A short video gives the same last frame for later times; keep one.
      if (small.base64 && !out.some((s) => s.base64 === small.base64)) out.push({ uri: small.uri, base64: small.base64 });
    } catch {
      // Past the end of a short video: stop here.
      break;
    }
  }
  return out;
}
