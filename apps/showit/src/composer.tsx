import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type RecordingStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Image, Linking, Platform, Pressable, TextInput, View } from 'react-native';

import { capture } from './flow';
import { useT } from './i18n';
import { play } from './sounds';
import { formatDuration, layoutRtl, T, tap, useColors, VoicePlayer } from './ui';

/** A note or a chat message: words, a voice recording, a photo, or a file. */
export type Bit = { id: string; kind: 'text' | 'voice' | 'photo' | 'file'; text?: string; uri?: string; ms?: number; name?: string; at?: number };
const bitId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Which way a piece of writing goes ----------

/** The writing's own language direction, from its first letter: Arabic → right to left, Latin → left to right. */
export function scriptOf(text: string | undefined): 'ar' | 'lat' | null {
  for (const ch of text ?? '') {
    if (/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(ch)) return 'ar';
    if (/[A-Za-zÀ-ÿ]/.test(ch)) return 'lat';
  }
  return null;
}
/** The side writing belongs on: Arabic on the right, French / English on the left; `fallback` when there are no letters. */
export const sideOf = (text: string | undefined, fallback: 'left' | 'right'): 'left' | 'right' => {
  const s = scriptOf(text);
  return s === 'ar' ? 'right' : s === 'lat' ? 'left' : fallback;
};
/** A side of the screen as a flex alignment (a right-to-left layout swaps start and end). */
export const alignTo = (side: 'left' | 'right') => (side === 'right' ? (layoutRtl() ? 'flex-start' : 'flex-end') : layoutRtl() ? 'flex-end' : 'flex-start');
/** A side of the screen as textAlign (Android's right-to-left layout swaps left and right). */
export const textTo = (side: 'left' | 'right'): 'left' | 'right' => (Platform.OS !== 'web' && I18nManager.isRTL ? (side === 'left' ? 'right' : 'left') : side);

/** Style for any writing box: the words go the way their own language goes (the app's language while empty). */
export const autoDir = (value: string, lang: string) => {
  const side = sideOf(value, lang === 'ar' ? 'right' : 'left');
  return { textAlign: textTo(side), writingDirection: side === 'right' ? ('rtl' as const) : ('ltr' as const) };
};

/**
 * The message bar, like WhatsApp's: a slim rounded box that grows only as the words do, a
 * paperclip inside it to attach a file (and, in the chat, a camera), and one round button on the
 * right: a microphone while the box is empty, a send arrow once something is written. The bar
 * itself never flips with the language (the round button is always on the right); the words
 * typed go right to left or left to right by themselves, from the language they are written in.
 * Recording: the bin cancels, ⏸ pauses / continues, and the round button sends it.
 */
export function Composer({ onSend, hint, camera = false }: { onSend: (bit: Bit) => void; hint: string; camera?: boolean }) {
  const c = useColors();
  const { t, lang } = useT();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'idle' | 'rec' | 'paused'>('idle');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const keep = useRef(false);
  const send = useRef(onSend);
  send.current = onSend;
  const msRef = useRef(0);
  const onStatus = (status: RecordingStatus) => {
    if (!status.isFinished) return;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (keep.current && status.url) {
      play('send');
      send.current({ id: bitId(), kind: 'voice', uri: status.url, ms: msRef.current, at: Date.now() });
    }
    keep.current = false;
    setMode('idle');
  };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, onStatus);
  const state = useAudioRecorderState(recorder, 200);
  msRef.current = state.durationMillis ?? msRef.current;
  useEffect(
    () => () => {
      if (recorder.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );
  // The red dot breathes while recording.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (mode !== 'rec') return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [mode, pulse]);

  const startRecording = async () => {
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
  const sendText = () => {
    const words = text.trim();
    if (!words) return;
    play('send');
    onSend({ id: bitId(), kind: 'text', text: words, at: Date.now() });
    setText('');
  };
  const attachFile = async () => {
    tap();
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const f = res.assets[0];
      play('pop');
      const image = (f.mimeType ?? '').startsWith('image/');
      onSend(camera && image ? { id: bitId(), kind: 'photo', uri: f.uri, at: Date.now() } : { id: bitId(), kind: 'file', uri: f.uri, name: f.name, at: Date.now() });
    } catch {
      setError(t('fileFailed'));
    }
  };
  const takePhoto = async () => {
    tap();
    const got = await capture('camera', 1);
    if (Array.isArray(got) && got[0]) {
      play('pop');
      onSend({ id: bitId(), kind: 'photo', uri: got[0].uri, at: Date.now() });
    }
  };
  const typed = text.trim().length > 0;
  // The words go the way their own language goes (the hint follows the app's language).
  const side = sideOf(text, lang === 'ar' ? 'right' : 'left');
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, press: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} hitSlop={6} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={21} color={c.muted} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      {/* Always laid out left to right: the round button stays on the right in every language. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, direction: 'ltr' }}>
        {mode === 'idle' ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 46, backgroundColor: c.surface, borderRadius: 23, borderWidth: focused ? 1.5 : 1, borderColor: focused ? c.accent : c.line, paddingHorizontal: 4 }}>
            {icon('attach', t('attachFile'), attachFile)}
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={hint}
              placeholderTextColor={c.muted}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={hint}
              style={[{ flex: 1, minWidth: 0, maxHeight: 120, minHeight: 44, paddingHorizontal: 6, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: c.fg, textAlign: textTo(side), writingDirection: side === 'right' ? 'rtl' : 'ltr', textAlignVertical: 'center' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
            {camera && !typed ? icon('camera-outline', t('takePhoto'), takePhoto) : null}
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, backgroundColor: c.surface, borderRadius: 23, borderWidth: 1, borderColor: c.line, paddingHorizontal: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('recCancel')} onPress={() => stop(false)} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={21} color={c.danger} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mode === 'rec' ? c.danger : c.muted, opacity: mode === 'rec' ? pulse : 1 }} />
              <T size={16} weight="heavy" style={{ writingDirection: 'ltr' }}>
                {formatDuration(state.durationMillis ?? 0)}
              </T>
              <T size={12} muted>
                {mode === 'rec' ? t('micListening') : t('recPaused')}
              </T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={mode === 'rec' ? t('recPause') : t('recResume')} onPress={pauseOrGo} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised }}>
              <Ionicons name={mode === 'rec' ? 'pause' : 'mic'} size={19} color={c.fg} />
            </Pressable>
          </View>
        )}
        {/* The round button: microphone while empty, send once there are words (or while recording: send the voice note). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode !== 'idle' ? t('recDone') : typed ? t('chatSend') : t('recStart')}
          onPress={() => (mode !== 'idle' ? stop(true) : typed ? sendText() : startRecording())}
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Ionicons name={mode !== 'idle' || typed ? 'send' : 'mic'} size={21} color={c.onAccent} />
        </Pressable>
      </View>
      {error ? (
        <T size={13} color={c.danger}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

const clockOf = (at?: number) => {
  if (!at) return '';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** A note or message bubble on the given side: words, a voice note with its waveform, a photo, or a file. */
export function BitBubble({ bit, mine, side, onRemove }: { bit: Bit; mine: boolean; side: 'left' | 'right'; onRemove?: () => void }) {
  const c = useColors();
  const { t } = useT();
  const bg = mine ? c.accent : c.surface;
  const fg = mine ? c.onAccent : c.fg;
  const time = clockOf(bit.at);
  const textSide = sideOf(bit.text, side);
  const remove = onRemove ? (
    <Pressable key="x" accessibilityRole="button" accessibilityLabel={t('removeNote')} onPress={onRemove} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="close" size={15} color={c.muted} />
    </Pressable>
  ) : null;
  const body = (
    <View key="b" style={{ flexShrink: 1, backgroundColor: bg, borderWidth: mine ? 0 : 1, borderColor: c.line, borderRadius: 18, borderBottomRightRadius: side === 'right' ? 6 : 18, borderBottomLeftRadius: side === 'left' ? 6 : 18, padding: bit.kind === 'text' || bit.kind === 'file' ? 0 : 4, overflow: 'hidden' }}>
      {bit.kind === 'text' ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 7, gap: 1 }}>
          <T size={15} color={fg} style={{ textAlign: textTo(textSide), writingDirection: textSide === 'right' ? 'rtl' : 'ltr' }}>
            {bit.text ?? ''}
          </T>
          {time ? (
            <T size={10} color={fg} style={{ opacity: 0.75, alignSelf: 'flex-end', writingDirection: 'ltr' }}>
              {time}
            </T>
          ) : null}
        </View>
      ) : bit.kind === 'voice' && bit.uri ? (
        <View style={{ width: 224 }}>
          <VoicePlayer uri={bit.uri} ms={bit.ms ?? 0} label={time ? `${t('voiceNote')} · ${time}` : t('voiceNote')} />
        </View>
      ) : bit.kind === 'file' ? (
        <Pressable accessibilityRole="button" onPress={() => bit.uri && Linking.openURL(bit.uri).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, maxWidth: 240 }}>
          <Ionicons name="document-attach-outline" size={22} color={fg} />
          <T size={14} weight="bold" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
            {bit.name ?? t('fileShort')}
          </T>
        </Pressable>
      ) : bit.uri ? (
        <Image source={{ uri: bit.uri }} style={{ width: 180, height: 180, borderRadius: 14 }} resizeMode="cover" accessibilityLabel={t('photoShort')} />
      ) : null}
    </View>
  );
  return (
    // Laid out left to right so the ✕ is always on the inner side of the bubble.
    <View style={{ alignSelf: alignTo(side), maxWidth: bit.kind === 'voice' ? '92%' : '84%', flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' }}>
      {side === 'right' ? [remove, body] : [body, remove]}
    </View>
  );
}
