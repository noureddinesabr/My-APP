import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { FreightRequest } from '@/backend/types';
import { MediaStrip } from '@/components/media/media-gallery';
import { VoicePlayer } from '@/components/media/voice-player';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/theme';

/** The client's voice note and photos/videos of the load, for drivers. */
export function LoadAttachments({ request }: { request: Pick<FreightRequest, 'voiceNote' | 'media'> }) {
  const { t } = useTranslation();
  const colors = useColors();
  const media = request.media ?? [];
  if (!request.voiceNote && media.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      {request.voiceNote && (
        <View style={[styles.voice, { backgroundColor: colors.primarySoft }]}>
          <Text variant="caption" color={colors.primary}>
            {t('media.clientVoice')}
          </Text>
          <VoicePlayer media={request.voiceNote} />
        </View>
      )}
      {media.length > 0 && (
        <>
          <Text variant="label">{t('media.clientMedia', { count: media.length })}</Text>
          <MediaStrip items={media} size={150} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  voice: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg },
});
