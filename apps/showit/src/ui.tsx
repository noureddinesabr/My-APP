import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  I18nManager,
  StyleSheet,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { getState } from './store';
import { customer, Font, hasArabic, type Palette } from './theme';

/** True when the whole layout runs right to left (Arabic). */
export const layoutRtl = () => (Platform.OS === 'web' ? getState().lang === 'ar' : I18nManager.isRTL);

export const ColorsContext = createContext<Palette>(customer);
export const useColors = () => useContext(ColorsContext);

/** The main scrolling panel, so a new step can start at its top. */
export const mainScroll: { current: { scrollTo: (o: { y: number; animated?: boolean }) => void } | null } = { current: null };

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

type TProps = TextProps & {
  size?: number;
  weight?: 'regular' | 'semibold' | 'bold' | 'heavy';
  color?: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
};

/**
 * Simple design: one calmer type scale for the whole app (owner: "normal and average sizes, so it
 * fits the pages"). Headings shrink (26 → 22, 36 → 31), body text and small text stay as written.
 */
export const typeSize = (s: number) => (s >= 20 ? Math.round(s * 0.86) : s >= 17 ? s - 1 : s);

/** Text in Plus Jakarta Sans, switching to Noto Kufi Arabic when the words are Arabic. */
export function T({ size: asked = 16, weight = 'regular', color, muted, style, children, ...rest }: TProps) {
  const size = typeSize(asked);
  const c = useColors();
  const plain = typeof children === 'string' ? children : Array.isArray(children) ? children.filter((x) => typeof x === 'string').join('') : '';
  const arabic = hasArabic(plain);
  const family = arabic ? (weight === 'regular' || weight === 'semibold' ? Font.arabic : Font.arabicBold) : Font[weight];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.2}
      style={[
        { fontFamily: family, fontSize: size, lineHeight: Math.round(size * (arabic ? 1.6 : 1.3)), color: color ?? (muted ? c.muted : weight === 'heavy' ? c.title : c.fg) },
        // Arabic words inside a left-to-right screen still read from the right.
        arabic && !layoutRtl() && { textAlign: 'right', writingDirection: 'rtl' },
        style,
      ]}>
      {children}
    </Text>
  );
}

/** Simple design: a page or panel that appears with a soft rise (opacity and 12 px), once on mount. */
export function FadeIn({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, style]}>{children}</Animated.View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 10 }, style]}>{children}</View>;
}

type BtnKind = 'accent' | 'ink' | 'ghost';
export function Btn({
  title,
  onPress,
  kind = 'accent',
  disabled,
  busy,
  icon,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
}) {
  const c = useColors();
  const forward = icon === 'arrow-forward';
  const bg = kind === 'accent' ? c.accent : kind === 'ink' ? c.ink : c.card;
  const fg = kind === 'accent' ? c.onAccent : kind === 'ink' ? c.onInk : c.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: small ? 42 : 52,
          borderRadius: small ? 10 : 12,
          paddingHorizontal: 16,
          backgroundColor: bg,
          borderWidth: 0,
          borderColor: c.line,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      {/* Simple design: the main buttons have a soft gradient of the side's colour. */}
      {kind === 'accent' && !disabled ? <LinearGradient pointerEvents="none" colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: small ? 10 : 12 }]} /> : null}
      {busy ? <ActivityIndicator color={fg} /> : icon && !forward ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <T size={small ? 15 : 17} weight="heavy" color={fg} style={{ textAlign: 'center' }}>
        {title}
      </T>
      {/* A "go on" arrow comes after the words and points the way the language reads. */}
      {forward && !busy ? <Ionicons name={layoutRtl() ? 'arrow-back' : 'arrow-forward'} size={20} color={fg} /> : null}
    </Pressable>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'live' | 'warn' | 'ok' }) {
  const c = useColors();
  const bg = tone === 'live' ? c.liveSoft : tone === 'warn' ? c.warnSoft : tone === 'ok' ? c.okSoft : c.raised;
  const fg = tone === 'live' ? c.live : tone === 'warn' ? c.warn : tone === 'ok' ? c.ok : c.title;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexShrink: 0 }}>
      {/* A little room at the ends: Android can clip the last letters of Arabic words in a tight pill. */}
      <T size={13} weight="bold" color={fg} style={{ paddingHorizontal: 2 }}>
        {children}
      </T>
    </View>
  );
}

export function LiveDot() {
  const c = useColors();
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((x) => !x), 700);
    return () => clearInterval(t);
  }, []);
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.live, opacity: on ? 1 : 0.35 }} />;
}

export const formatDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Tap to start recording a voice note, tap again to keep it. No time limit. */
export function useVoiceRecorder(onDone: (uri: string, ms: number) => void) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(0);
  const keep = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const onStatus = (status: RecordingStatus) => {
    if (!status.isFinished) return;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (keep.current && status.url) done.current(status.url, Date.now() - started.current);
    keep.current = false;
    setRecording(false);
  };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, onStatus);
  const recState = useAudioRecorderState(recorder, 200);

  const start = async () => {
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Allow the microphone in your phone settings to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      started.current = Date.now();
      keep.current = true;
      recorder.record();
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setError('The microphone could not start. Try again.');
      setRecording(false);
    }
  };
  const stop = async (save: boolean) => {
    keep.current = save;
    try {
      await recorder.stop();
    } catch {
      setRecording(false);
    }
  };
  return { recording, error, ms: recState.durationMillis ?? 0, start, stop };
}

const BARS = 26;
function bars(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.25 + 0.75 * Math.sin((Math.PI * (i + 1)) / (BARS + 1)) * ((h % 1000) / 1000);
  });
}

/** Play or pause a recorded voice note, with progress over its waveform. */
export function VoicePlayer({ uri, ms, label }: { uri: string; ms: number; label?: string }) {
  const c = useColors();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 ? status.duration * 1000 : ms;
  const progress = duration > 0 ? Math.min(1, (status.currentTime * 1000) / duration) : 0;
  const shape = bars(uri);
  const toggle = () => {
    tap();
    if (status.playing) return player.pause();
    if (status.didJustFinish || (duration > 0 && status.currentTime * 1000 >= duration - 100)) player.seekTo(0);
    player.play();
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        onPress={toggle}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={22} color={c.onAccent} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 30 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {shape.map((h, i) => (
            <View key={i} style={{ flex: 1, height: 4 + h * 24, borderRadius: 2, backgroundColor: i / BARS < progress ? c.accent : c.muted, opacity: i / BARS < progress ? 1 : 0.45 }} />
          ))}
        </View>
        <T size={12} muted>
          {label ?? 'Voice note'} · {formatDuration(duration)}
        </T>
      </View>
    </View>
  );
}

export { useKeyboardInset } from './keyboard';

/** Press = one step; hold = keeps stepping, faster after a moment. */
export function useHoldRepeat(step: (delta: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(step);
  latest.current = step;
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = (delta: number) => {
    stop();
    tap();
    latest.current(delta);
    let count = 0;
    const tick = () => {
      count += 1;
      latest.current(count > 15 ? delta * 5 : delta);
      timer.current = setTimeout(tick, count > 6 ? 70 : 140);
    };
    timer.current = setTimeout(tick, 420);
  };
  useEffect(() => stop, []);
  return { start, stop };
}

