import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import type { Media } from '@/backend/types';
import { chooseAudioFile, MediaError, storeFile, type MediaErrorCode } from '@/lib/media';
import { play } from '@/lib/sounds';

/** Voice notes stop by themselves after two minutes. */
export const MAX_VOICE_SECONDS = 120;

export type VoiceError = MediaErrorCode | 'noMic';

/**
 * Records a voice note (tap to start, tap to send or cancel) and stores it.
 * When the microphone can't be used (the browser preview blocks it), `error` is 'noMic'
 * and `chooseFile` offers an audio file instead.
 */
export function useVoiceRecorder(onDone: (media: Media) => void) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'saving'>('idle');
  const [error, setError] = useState<VoiceError | null>(null);
  const startedAt = useRef(0);
  const keep = useRef(false);
  // The recorder keeps the first status listener, so the latest callback is read through a ref.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const save = async (uri: string, durationMs: number | undefined, mimeType?: string) => {
    setPhase('saving');
    try {
      const url = await storeFile(uri, 'audio', mimeType);
      play('send');
      done.current({ kind: 'audio', url, durationMs });
      setError(null);
    } catch (caught) {
      play('error');
      setError(caught instanceof MediaError ? caught.code : 'failed');
    } finally {
      setPhase('idle');
    }
  };

  const onStatus = (status: RecordingStatus) => {
    if (!status.isFinished) return;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (keep.current && status.url) save(status.url, Date.now() - startedAt.current);
    else setPhase('idle');
    keep.current = false;
  };

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, onStatus);
  const state = useAudioRecorderState(recorder, 200);

  const start = async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('noMic');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      play('tap');
      startedAt.current = Date.now();
      keep.current = true;
      recorder.record({ forDuration: MAX_VOICE_SECONDS });
      setPhase('recording');
    } catch {
      setError('noMic');
      setPhase('idle');
    }
  };

  /** Stops and keeps the note (`send`) or throws it away. */
  const stop = async (send: boolean) => {
    keep.current = send;
    try {
      await recorder.stop();
    } catch {
      setPhase('idle');
    }
  };

  const chooseFile = async () => {
    const file = await chooseAudioFile();
    if (file) await save(file.uri, file.durationMs, file.type);
  };

  return { phase, error, seconds: Math.floor((state.durationMillis ?? 0) / 1000), start, stop, chooseFile };
}

export function formatDuration(ms: number | undefined) {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
