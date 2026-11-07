import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type RecordingStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, TextInput, View } from 'react-native';

import { capture } from './flow';
import { useT } from './i18n';
import { play } from './sounds';
import { formatDuration, layoutRtl, T, tap, useColors, VoicePlayer } from './ui';

/** A note or a chat message: words, a voice recording, or a photo. */
export type Bit = { id: string; kind: 'text' | 'voice' | 'photo'; text?: string; uri?: string; ms?: number };
const bitId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The message bar, like WhatsApp's: a rounded box that grows with the words, a paperclip (photo
 * from the gallery) and a camera inside it, and one round button on the right that records a
 * voice note while the box is empty and sends once something is written. The bar never flips
 * with the language: the round button is always on the right. Only the hint (with its moving
 * dots) follows the language: on the left in English/French, on the right in Arabic.
 * Recording: ✕ cancels, ⏸ pauses / continues, and the round button sends it.
 */
export function Composer({ onSend, hint, photos = true }: { onSend: (bit: Bit) => void; hint: string; photos?: boolean }) {
  const c = useColors();
  const { t, rtl } = useT();
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
      send.current({ id: bitId(), kind: 'voice', uri: status.url, ms: msRef.current });
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
    onSend({ id: bitId(), kind: 'text', text: words });
    setText('');
  };
  const addPhoto = async (source: 'camera' | 'library') => {
    tap();
    const got = await capture(source, 1);
    if (Array.isArray(got) && got[0]) {
      play('pop');
      onSend({ id: bitId(), kind: 'photo', uri: got[0].uri });
    }
  };
  const typed = text.trim().length > 0;
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, press: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} hitSlop={6} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={22} color={c.muted} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      {/* Always laid out left to right: the round button stays on the right in every language. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, direction: 'ltr' }}>
        {mode === 'idle' ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 50, backgroundColor: c.surface, borderRadius: 25, borderWidth: focused ? 2 : 1, borderColor: focused ? c.accent : c.line, paddingHorizontal: 4, paddingVertical: 3 }}>
            {photos ? icon('attach', t('addPhoto'), () => addPhoto('library')) : null}
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 42 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                accessibilityLabel={hint}
                style={[{ maxHeight: 132, minHeight: 42, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 10, fontSize: 16, color: c.fg, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr', textAlignVertical: 'center' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
              />
              {!text ? <TypingHint text={hint} end={rtl} /> : null}
            </View>
            {photos && !typed ? icon('camera-outline', t('takePhoto'), () => addPhoto('camera')) : null}
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 50, backgroundColor: c.surface, borderRadius: 25, borderWidth: 1, borderColor: c.line, paddingHorizontal: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('recCancel')} onPress={() => stop(false)} hitSlop={6} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={22} color={c.danger} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mode === 'rec' ? c.danger : c.muted, opacity: mode === 'rec' ? pulse : 1 }} />
              <T size={17} weight="heavy" style={{ writingDirection: 'ltr' }}>
                {formatDuration(state.durationMillis ?? 0)}
              </T>
              <T size={12} muted>
                {mode === 'rec' ? t('micListening') : t('recPaused')}
              </T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={mode === 'rec' ? t('recPause') : t('recResume')} onPress={pauseOrGo} hitSlop={6} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised }}>
              <Ionicons name={mode === 'rec' ? 'pause' : 'mic'} size={20} color={c.fg} />
            </Pressable>
          </View>
        )}
        {/* The round button: microphone while empty, send once there are words (or while recording: send the voice note). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode !== 'idle' ? t('recDone') : typed ? t('chatSend') : t('recStart')}
          onPress={() => (mode !== 'idle' ? stop(true) : typed ? sendText() : startRecording())}
          style={({ pressed }) => ({ width: 50, height: 50, borderRadius: 25, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }], shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 })}>
          <Ionicons name={mode !== 'idle' || typed ? 'send' : 'mic'} size={22} color={c.onAccent} />
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

/** The hint with three dots rising one after another: dots first where the reading starts. */
export function TypingHint({ text, end }: { text: string; end: boolean }) {
  const c = useColors();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        180,
        dots.map((d) => Animated.sequence([Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true })])),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);
  const dotRow = (
    <View key="dots" style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingTop: 4 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />
      ))}
    </View>
  );
  const words = (
    <T key="words" size={14} muted numberOfLines={2} style={{ flexShrink: 1 }}>
      {text}
    </T>
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: end ? 'flex-end' : 'flex-start', direction: 'ltr' }}>
      {end ? [words, dotRow] : [dotRow, words]}
    </View>
  );
}

/**
 * Where a message sits, seen from the person holding this phone: in Arabic my messages on the
 * right and the other person's on the left; in English and French the other way round.
 */
export function bubbleSide(mine: boolean, lang: string): 'flex-start' | 'flex-end' {
  const right = lang === 'ar' ? mine : !mine;
  // In a right-to-left layout "flex-start" is the right edge.
  const rtlLayout = layoutRtl();
  return right ? (rtlLayout ? 'flex-start' : 'flex-end') : rtlLayout ? 'flex-end' : 'flex-start';
}

/** A note or message bubble: words, a voice note with its waveform, or a photo. */
export function BitBubble({ bit, mine, time, onRemove }: { bit: Bit; mine: boolean; time?: string; onRemove?: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const side = bubbleSide(mine, lang);
  const bg = mine ? c.accent : c.surface;
  const fg = mine ? c.onAccent : c.fg;
  return (
    <View style={{ alignSelf: side, maxWidth: bit.kind === 'voice' ? '88%' : '82%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ flexShrink: 1, backgroundColor: bg, borderWidth: mine ? 0 : 1, borderColor: c.line, borderRadius: 18, padding: bit.kind === 'text' ? 0 : 4, overflow: 'hidden' }}>
        {bit.kind === 'text' ? (
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}>
            <T size={15} color={fg}>
              {bit.text ?? ''}
            </T>
            {time ? (
              <T size={10} color={fg} style={{ opacity: 0.75, alignSelf: 'flex-end', writingDirection: 'ltr' }}>
                {time}
              </T>
            ) : null}
          </View>
        ) : bit.kind === 'voice' && bit.uri ? (
          <View style={{ width: 230 }}>
            <VoicePlayer uri={bit.uri} ms={bit.ms ?? 0} label={t('voiceNote')} />
          </View>
        ) : bit.uri ? (
          <Image source={{ uri: bit.uri }} style={{ width: 180, height: 180, borderRadius: 14 }} resizeMode="cover" accessibilityLabel={t('photoShort')} />
        ) : null}
      </View>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('removeNote')} onPress={onRemove} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={16} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
