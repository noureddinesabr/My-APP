import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Media } from '@/backend/types';
import { formatDuration } from '@/components/media/use-voice-recorder';
import { Text } from '@/components/text';
import { Spacing, useColors } from '@/theme';

const BARS = 28;

/** Bar heights that look like a voice waveform; the same note always draws the same shape. */
function waveform(seed: string) {
  let hash = 7;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const envelope = Math.sin((Math.PI * (i + 1)) / (BARS + 1));
    return 0.25 + 0.75 * envelope * ((hash % 1000) / 1000);
  });
}

/** Play / pause a voice note, with progress drawn over its waveform. */
export function VoicePlayer({ media, tint }: { media: Media; tint?: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const player = useAudioPlayer(media.url);
  const status = useAudioPlayerStatus(player);
  const color = tint ?? colors.primary;
  const duration = status.duration > 0 ? status.duration * 1000 : (media.durationMs ?? 0);
  const progress = duration > 0 ? Math.min(1, (status.currentTime * 1000) / duration) : 0;
  const bars = waveform(media.url);

  const toggle = () => {
    if (status.playing) return player.pause();
    if (status.didJustFinish || (duration > 0 && status.currentTime * 1000 >= duration - 100)) player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('media.pause') : t('media.playVoice')}
        onPress={toggle}
        style={[styles.play, { backgroundColor: color }]}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={24} color={tint ? colors.primary : colors.onPrimary} />
      </Pressable>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {bars.map((height, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: 5 + height * 28, backgroundColor: color, opacity: i / BARS < progress ? 1 : 0.35 },
            ]}
          />
        ))}
      </View>
      <Text variant="caption" color={color} style={{ minWidth: 34, writingDirection: 'ltr' }}>
        {formatDuration(status.playing || progress > 0 ? status.currentTime * 1000 : duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 220 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 36 },
  bar: { flex: 1, borderRadius: 2 },
});
