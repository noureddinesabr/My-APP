import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Phones (the APK): Android's own speech recognition (Moroccan Arabic «ar-MA» understands Darija
 * and Arabic) and the phone's text-to-speech voice. The browser preview has its own version
 * (`speech.web.ts`) using the claude.ai page's dictation and voice.
 */
export type VoiceLang = 'ar' | 'fr' | 'en';
const LISTEN: Record<VoiceLang, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' };
const SAY: Record<VoiceLang, string> = { ar: 'ar', fr: 'fr-FR', en: 'en-US' };

/** Nothing to prepare on phones (the browser loads its helpers ahead of the first tap). */
export function prepareVoice() {}

/** Phones can start listening by themselves (after reading a new load aloud), so the driver needn't touch the screen. */
export const canListenAlone = true;

export function canListen() {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/** Says the text and resolves when it's done (or stopped). */
export function speak(text: string, lang: VoiceLang): Promise<void> {
  return new Promise((resolve) => {
    try {
      Speech.stop();
      Speech.speak(text, { language: SAY[lang], rate: 0.98, onDone: () => resolve(), onStopped: () => resolve(), onError: () => resolve() });
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {
    // nothing to stop
  }
}

let current: (() => void) | null = null;

/**
 * Listens for one command: resolves with what was said ('' after a silence or when nothing was
 * understood). `onHeard` shows the words as they come.
 */
export async function listenOnce(lang: VoiceLang, onHeard?: (text: string) => void): Promise<string> {
  stopListening();
  try {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return '';
  } catch {
    return '';
  }
  return new Promise((resolve) => {
    let best = '';
    let done = false;
    const subs: { remove: () => void }[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      subs.forEach((s) => s.remove());
      current = null;
      resolve(best.trim());
    };
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e) => {
        best = e.results?.[0]?.transcript ?? best;
        onHeard?.(best);
        if (e.isFinal) {
          try {
            ExpoSpeechRecognitionModule.stop();
          } catch {
            // already stopped
          }
          finish();
        }
      }),
      ExpoSpeechRecognitionModule.addListener('end', finish),
      ExpoSpeechRecognitionModule.addListener('error', finish),
    );
    // One command is short: stop after 9 seconds whatever happens.
    const limit = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // already stopped
      }
      setTimeout(finish, 600);
    }, 9000);
    current = () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // nothing to abort
      }
      finish();
    };
    try {
      ExpoSpeechRecognitionModule.start({ lang: LISTEN[lang], interimResults: true, continuous: false, maxAlternatives: 1, androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 } });
    } catch {
      finish();
    }
  });
}

export function stopListening() {
  current?.();
}
