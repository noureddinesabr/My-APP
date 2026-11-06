import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type RecordingStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useT } from './i18n';
import { formatDuration, T, tap, useColors, VoicePlayer } from './ui';

export type VoiceNote = { uri: string; ms: number };

/**
 * A big box for a message to the driver with a microphone on its right side, like a chat box.
 * Recording: ✕ cancels (left end), ⏸ pauses and continues, ✓ keeps it. A kept voice note can be
 * played, deleted, or recorded again.
 */
export function NoteBox({ text, onText, voice, onVoice, placeholder }: { text: string; onText: (v: string) => void; voice: VoiceNote | null; onVoice: (v: VoiceNote | null) => void; placeholder: string }) {
  const c = useColors();
  const { t } = useT();
  const [mode, setMode] = useState<'idle' | 'rec' | 'paused'>('idle');
  const [error, setError] = useState('');
  const keep = useRef(false);
  const latest = useRef(onVoice);
  latest.current = onVoice;
  const onStatus = (status: RecordingStatus) => {
    if (!status.isFinished) return;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (keep.current && status.url) latest.current({ uri: status.url, ms: msRef.current });
    keep.current = false;
    setMode('idle');
  };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, onStatus);
  const state = useAudioRecorderState(recorder, 200);
  const msRef = useRef(0);
  msRef.current = state.durationMillis ?? msRef.current;
  useEffect(
    () => () => {
      if (recorder.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );

  const start = async () => {
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return setError(t('recNoMic'));
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      tap();
      setMode('rec');
    } catch {
      setError(t('recNoMic'));
      setMode('idle');
    }
  };
  const stop = async (save: boolean) => {
    keep.current = save;
    tap();
    try {
      await recorder.stop();
    } catch {
      setMode('idle');
    }
  };
  const pauseOrGo = () => {
    tap();
    if (mode === 'rec') {
      recorder.pause();
      setMode('paused');
    } else {
      recorder.record();
      setMode('rec');
    }
  };
  const round = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, bg: string, fg: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={fg} />
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      {/* The microphone sits on the right side of the box, also in Arabic. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: c.raised, borderRadius: 18, padding: 8, direction: 'ltr' }}>
        {mode === 'idle' ? (
          <>
            <TextInput
              value={text}
              onChangeText={onText}
              multiline
              placeholder={placeholder}
              placeholderTextColor={c.muted}
              accessibilityLabel={placeholder}
              style={[{ flex: 1, minWidth: 0, minHeight: 104, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16, color: c.fg, textAlignVertical: 'top' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
            {round('mic', t('recStart'), start, c.accent, c.onAccent)}
          </>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 104 }}>
            {round('close', t('recCancel'), () => stop(false), c.surface, c.fg)}
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mode === 'rec' ? c.danger : c.muted }} />
                <T size={22} weight="heavy">
                  {formatDuration(state.durationMillis ?? 0)}
                </T>
              </View>
              <T size={12} muted>
                {mode === 'rec' ? t('micListening') : t('recPaused')}
              </T>
            </View>
            {round(mode === 'rec' ? 'pause' : 'mic', mode === 'rec' ? t('recPause') : t('recResume'), pauseOrGo, c.surface, c.fg)}
            {round('checkmark', t('recDone'), () => stop(true), c.accent, c.onAccent)}
          </View>
        )}
      </View>
      {voice && mode === 'idle' ? (
        <View style={{ gap: 6 }}>
          <VoicePlayer uri={voice.uri} ms={voice.ms} label={t('voiceForDriver')} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable accessibilityRole="button" onPress={() => onVoice(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34 }}>
              <Ionicons name="trash-outline" size={16} color={c.danger} />
              <T size={13} weight="bold" color={c.danger}>
                {t('recDelete')}
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onVoice(null);
                start();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34 }}>
              <Ionicons name="mic-outline" size={16} color={c.accent} />
              <T size={13} weight="bold" color={c.accent}>
                {t('recAgain')}
              </T>
            </Pressable>
          </View>
        </View>
      ) : null}
      {error ? (
        <T size={13} color={c.danger}>
          {error}
        </T>
      ) : null}
    </View>
  );
}
