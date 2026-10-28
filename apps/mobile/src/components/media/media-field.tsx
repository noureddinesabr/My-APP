import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Media } from '@/backend/types';
import { AddTile, MediaStrip } from '@/components/media/media-gallery';
import { Text } from '@/components/text';
import { captureMedia, MediaError, type MediaErrorCode } from '@/lib/media';
import { play } from '@/lib/sounds';
import { Spacing } from '@/theme';

export const MAX_LOAD_MEDIA = 6;

type Source = 'photo' | 'video' | 'library';

/** Take HD photos or short videos of the load, or pick them from the gallery. */
export function MediaField({ value, onChange, compact }: { value: Media[]; onChange: (media: Media[]) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Source | null>(null);
  const [error, setError] = useState<MediaErrorCode | null>(null);
  const full = value.length >= MAX_LOAD_MEDIA;

  const add = async (source: Source) => {
    play('tap');
    setBusy(source);
    setError(null);
    try {
      const media =
        source === 'library' ? await captureMedia('library') : await captureMedia('camera', [source === 'photo' ? 'photo' : 'video']);
      if (media) {
        play('success');
        onChange([...value, media]);
      }
    } catch (caught) {
      play('error');
      setError(caught instanceof MediaError ? caught.code : 'failed');
    } finally {
      setBusy(null);
    }
  };

  // Tight: one row, the add buttons shrink to icons once there are pictures to show next to them.
  if (compact) {
    const tiny = value.length > 0;
    return (
      <View style={{ gap: Spacing.xs }}>
        <View style={styles.adds}>
          {!full && <AddTile wide={!tiny} short tiny={tiny} label={t('media.takePhoto')} icon="camera" busy={busy === 'photo'} onPress={() => add('photo')} />}
          {!full && <AddTile wide={!tiny} short tiny={tiny} label={t('media.recordVideo')} icon="videocam" busy={busy === 'video'} onPress={() => add('video')} />}
          {!full && <AddTile wide={!tiny} short tiny={tiny} label={t('media.gallery')} icon="images" busy={busy === 'library'} onPress={() => add('library')} />}
          {tiny && (
            <View style={{ flex: 1 }}>
              <MediaStrip items={value} size={44} onRemove={(index) => onChange(value.filter((_, i) => i !== index))} />
            </View>
          )}
        </View>
        {error && (
          <Text variant="caption" muted>
            {t(`media.error.${error}`)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.xs }}>
      {!full && (
        <View style={styles.adds}>
          <AddTile wide short={compact} label={t('media.takePhoto')} icon="camera" busy={busy === 'photo'} onPress={() => add('photo')} />
          <AddTile wide short={compact} label={t('media.recordVideo')} icon="videocam" busy={busy === 'video'} onPress={() => add('video')} />
          <AddTile wide short={compact} label={t('media.gallery')} icon="images" busy={busy === 'library'} onPress={() => add('library')} />
        </View>
      )}
      <MediaStrip items={value} size={compact ? 64 : undefined} onRemove={(index) => onChange(value.filter((_, i) => i !== index))} />
      {(!compact || error) && (
        <Text variant="caption" muted>
          {error ? t(`media.error.${error}`) : t('media.count', { count: value.length, max: MAX_LOAD_MEDIA })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  adds: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
