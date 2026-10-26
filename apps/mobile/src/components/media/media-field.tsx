import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Media } from '@/backend/types';
import { AddTile, MediaStrip } from '@/components/media/media-gallery';
import { Text } from '@/components/text';
import { captureMedia, MediaError, type MediaErrorCode } from '@/lib/media';
import { play } from '@/lib/sounds';
import { Spacing } from '@/theme';

export const MAX_LOAD_MEDIA = 6;

type Source = 'photo' | 'video' | 'library';

/** Take HD photos or short videos of the load, or pick them from the gallery. */
export function MediaField({ value, onChange }: { value: Media[]; onChange: (media: Media[]) => void }) {
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

  return (
    <View style={{ gap: Spacing.xs }}>
      <MediaStrip
        items={value}
        onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
        extra={
          !full && (
            <>
              <AddTile label={t('media.takePhoto')} icon="camera" busy={busy === 'photo'} onPress={() => add('photo')} />
              <AddTile label={t('media.recordVideo')} icon="videocam" busy={busy === 'video'} onPress={() => add('video')} />
              <AddTile label={t('media.gallery')} icon="images" busy={busy === 'library'} onPress={() => add('library')} />
            </>
          )
        }
      />
      <Text variant="caption" muted>
        {error ? t(`media.error.${error}`) : t('media.count', { count: value.length, max: MAX_LOAD_MEDIA })}
      </Text>
    </View>
  );
}
