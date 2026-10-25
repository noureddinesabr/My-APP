import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const MAX_SIDE = 900;

/**
 * Lets the user pick a photo and returns a URI that can be saved.
 * On the web, picked files are temporary, so the photo is shrunk into a small data URI.
 */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (result.canceled || !result.assets[0]) return null;
  const uri = result.assets[0].uri;
  if (Platform.OS !== 'web') return uri;
  try {
    return await shrinkOnWeb(uri);
  } catch {
    return uri;
  }
}

function shrinkOnWeb(uri: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
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
