import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useT, type Key } from './i18n';
import { play } from './sounds';
import { formatDuration, T, tap, useColors, useVoiceRecorder } from './ui';

/** Speech languages offered under the microphone. */
export const SPEECH_LANGS = [
  { id: 'ar-MA', label: 'الدارجة / العربية' },
  { id: 'fr-FR', label: 'Français' },
  { id: 'en-US', label: 'English' },
] as const;
export type SpeechLang = (typeof SPEECH_LANGS)[number]['id'];

const canRecognize = () => {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
};
const canKeepAudio = () => {
  try {
    return ExpoSpeechRecognitionModule.supportsRecording();
  } catch {
    return false;
  }
};

/**
 * The big microphone. Speech is written into the text live (the AI reads it), and where the
 * phone can keep the recording at the same time it becomes the voice note for the driver.
 * Phones without speech-to-text record a plain voice note instead.
 */
export function BigMic({
  speechLang,
  text,
  onText,
  onVoiceNote,
  small,
  title,
  sub,
}: {
  speechLang: SpeechLang;
  text: string;
  onText: (t: string) => void;
  onVoiceNote?: (uri: string, ms: number) => void;
  small?: boolean;
  title?: string;
  sub?: string;
}) {
  const c = useColors();
  const { t } = useT();
  const [mode, setMode] = useState<'idle' | 'listening' | 'recording'>('idle');
  const [error, setError] = useState<Key | ''>('');
  const [seconds, setSeconds] = useState(0);
  const base = useRef('');
  const startedAt = useRef(0);
  const active = useRef(false);
  const recorder = useVoiceRecorder((uri, ms) => onVoiceNote?.(uri, ms));
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'idle') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      loop.stop();
      clearInterval(timer);
    };
  }, [mode, pulse]);

  useSpeechRecognitionEvent('result', (e) => {
    if (!active.current) return;
    const said = e.results[0]?.transcript ?? '';
    onText([base.current, said].filter(Boolean).join(base.current ? ' ' : ''));
  });
  useSpeechRecognitionEvent('audiostart', (e) => {
    if (active.current) startedAt.current = e.timestamp;
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (active.current && e.uri && onVoiceNote) onVoiceNote(e.uri, Math.max(1000, e.timestamp - startedAt.current));
  });
  useSpeechRecognitionEvent('end', () => {
    active.current = false;
    setMode((m) => (m === 'listening' ? 'idle' : m));
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!active.current) return;
    active.current = false;
    setMode('idle');
    if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') setError(e.error === 'aborted' ? '' : 'micNoSpeech');
    else if (e.error === 'not-allowed') setError('micNoPermission');
    else if (onVoiceNote && (e.error === 'language-not-supported' || e.error === 'service-not-allowed' || e.error === 'network')) {
      // No speech-to-text here: keep the voice for the driver instead.
      setError('micUnavailable');
      startRecorder();
    } else setError('micFailed');
  });

  const startRecorder = () => {
    setSeconds(0);
    setMode('recording');
    recorder.start().catch(() => setMode('idle'));
  };

  const start = async () => {
    tap();
    setError('');
    setSeconds(0);
    if (!canRecognize()) {
      if (onVoiceNote) {
        setError('micUnavailable');
        startRecorder();
      } else setError('micFailed');
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('micNoPermission');
        return;
      }
      base.current = text.trim();
      active.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: speechLang,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        recordingOptions: onVoiceNote && canKeepAudio() ? { persist: true } : undefined,
      });
      setMode('listening');
      play('pop');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      active.current = false;
      setError('micFailed');
    }
  };

  const stop = () => {
    tap();
    if (mode === 'listening') {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        setMode('idle');
      }
    } else if (mode === 'recording') {
      recorder.stop(true);
      setMode('idle');
    }
  };

  const on = mode !== 'idle';
  const size = small ? 56 : 84;
  const ring = { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }) };

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={on ? t('micStop') : title ?? t('micTalk')}
        onPress={on ? stop : start}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          backgroundColor: on ? '#7C2D12' : c.accent,
          borderRadius: 22,
          padding: small ? 10 : 16,
          opacity: pressed ? 0.88 : 1,
        })}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF' }, ring]} /> : null}
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={on ? 'stop' : 'mic'} size={small ? 26 : 40} color="#FFFFFF" />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={small ? 16 : 19} weight="heavy" color="#FFFFFF">
            {on ? `${mode === 'listening' ? t('micListening') : t('micRecording')} ${formatDuration(seconds * 1000)}` : title ?? t('micTalk')}
          </T>
          <T size={13} color="#FFEDD5">
            {on ? t('micStop') : sub ?? t('micTalkSub')}
          </T>
        </View>
      </Pressable>
      {error ? (
        <T size={13} color={error === 'micUnavailable' ? c.warn : c.danger}>
          {t(error)}
        </T>
      ) : null}
    </View>
  );
}
