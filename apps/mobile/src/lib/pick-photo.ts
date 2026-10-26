import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const MAX_SIDE = 900;

/**
 * Lets the user pick a photo and returns a URI that can be saved.
 * The photo is shrunk into a small data URI so it can be saved and shared with the other side.
 */
export async function pickPhoto(maxSide = MAX_SIDE): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];
  try {
    if (Platform.OS === 'web') return await shrinkOnWeb(uri, maxSide);
    // Shrink and embed, so the photo can be shared with the other side (profile, chat).
    const resize = width >= height ? { width: Math.min(width, maxSide) } : { height: Math.min(height, maxSide) };
    const small = await manipulateAsync(uri, [{ resize }], { base64: true, compress: 0.7, format: SaveFormat.JPEG });
    return small.base64 ? `data:image/jpeg;base64,${small.base64}` : small.uri;
  } catch {
    return uri;
  }
}

function shrinkOnWeb(uri: string, maxSide: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    image.onerror = reject;
    image.src = uri;
  });
}
