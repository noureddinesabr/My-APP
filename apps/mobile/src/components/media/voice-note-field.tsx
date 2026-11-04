import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { Media } from '@/backend/types';
import { formatDuration, MAX_VOICE_SECONDS, useVoiceRecorder, type VoiceError } from '@/components/media/use-voice-recorder';
import { VoicePlayer } from '@/components/media/voice-player';
import { Text } from '@/components/text';
import { Gradient } from '@/components/ui';
import { play } from '@/lib/sounds';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

/** Record (or attach) one voice note, listen back, delete or record again. */
export function VoiceNoteField({ value, onChange }: { value: Media | null; onChange: (media: Media | null) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const voice = useVoiceRecorder((media) => onChange(media));

  if (voice.phase === 'recording') return <RecordingBar seconds={voice.seconds} onCancel={() => voice.stop(false)} onDone={() => voice.stop(true)} />;

  if (voice.phase === 'saving') {
    return (
      <View style={[styles.box, { backgroundColor: colors.primarySoft }]}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="label" color={colors.primary}>
          {t('media.saving')}
        </Text>
      </View>
    );
  }

  if (value) {
    return (
      <View style={[styles.box, { backgroundColor: colors.primarySoft }]}>
        <View style={{ flex: 1 }}>
          <VoicePlayer media={value} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('media.deleteVoice')}
          hitSlop={8}
          onPress={() => {
            play('tap');
            onChange(null);
          }}
          style={styles.iconHit}>
          <Ionicons name="trash-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('media.recordVoice')} onPress={voice.start}>
        <Gradient colors={Gradients.primary} style={styles.record}>
          <View style={styles.micRing}>
            <Ionicons name="mic" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.onPrimary}>
              {t('media.recordVoice')}
            </Text>
            <Text variant="caption" color={colors.onPrimary} style={{ opacity: 0.85 }}>
              {t('media.recordVoiceHint', { max: formatDuration(MAX_VOICE_SECONDS * 1000) })}
            </Text>
          </View>
        </Gradient>
      </Pressable>
      <VoiceErrorNotice error={voice.error} onChooseFile={voice.chooseFile} />
    </View>
  );
}

/** Live timer with a pulsing dot while recording; cancel or keep. */
export function RecordingBar({ seconds, onCancel, onDone }: { seconds: number; onCancel: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.box, { backgroundColor: colors.accentSoft }]} accessibilityLiveRegion="polite">
      <Pressable accessibilityRole="button" accessibilityLabel={t('media.cancelRecording')} onPress={onCancel} hitSlop={8} style={styles.iconHit}>
        <Ionicons name="trash-outline" size={22} color={colors.accent} />
      </Pressable>
      <Animated.View style={[styles.dot, { backgroundColor: colors.accentFill, opacity: pulse }]} />
      <Text variant="label" color={colors.accent} style={{ flex: 1, writingDirection: 'ltr' }}>
        {t('media.recording')} {formatDuration(seconds * 1000)} / {formatDuration(MAX_VOICE_SECONDS * 1000)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('media.stopRecording')}
        onPress={onDone}
        style={[styles.done, { backgroundColor: colors.accentFill }]}>
        <Ionicons name="checkmark" size={22} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

/** Explains why recording failed; in a browser that blocks the microphone, offers an audio file instead. */
export function VoiceErrorNotice({ error, onChooseFile }: { error: VoiceError | null; onChooseFile: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  if (!error) return null;
  return (
    <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}>
      <Text variant="caption" muted>
        {t(`media.error.${error}`)}
      </Text>
      {error === 'noMic' && Platform.OS === 'web' && (
        <Pressable accessibilityRole="button" onPress={onChooseFile} style={styles.fileButton}>
          <Ionicons name="musical-notes-outline" size={16} color={colors.primary} />
          <Text variant="label" color={colors.primary}>
            {t('media.chooseAudio')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.lg, minHeight: 56 },
  record: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  micRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  done: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notice: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md },
  fileButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
});
