import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Media } from '@/backend/types';
import { formatDuration } from '@/components/media/use-voice-recorder';
import { Text } from '@/components/text';
import { Gradient } from '@/components/ui';
import { useDirectionStyle, useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

/** A photo or video tile; tapping opens it full screen. */
export function MediaThumb({
  media,
  size = 92,
  width,
  onOpen,
  onRemove,
}: {
  media: Media;
  size?: number;
  width?: number;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={media.kind === 'video' ? t('media.openVideo') : t('media.openPhoto')}
        onPress={() => {
          play('tap');
          onOpen();
        }}
        style={[styles.thumb, { width: width ?? size, height: size, backgroundColor: colors.surfaceMuted }]}>
        {media.kind === 'photo' ? (
          <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Gradient colors={Gradients.primary} style={styles.cover}>
            {Platform.OS === 'web' && (
              // The browser can show the video's first frame; the phone app shows the gradient tile.
              <video
                src={`${media.url}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <View style={styles.playRing}>
              <Ionicons name="play" size={22} color="#fff" />
            </View>
            <View style={styles.duration}>
              <Ionicons name="videocam" size={12} color="#fff" />
              <Text variant="caption" color="#fff" style={{ fontSize: 11, lineHeight: 14 }}>
                {media.durationMs ? formatDuration(media.durationMs) : t('media.video')}
              </Text>
            </View>
          </Gradient>
        )}
      </Pressable>
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('media.remove')}
          onPress={() => {
            play('tap');
            onRemove();
          }}
          hitSlop={8}
          style={[styles.remove, { backgroundColor: colors.text, borderColor: colors.surface }]}>
          <Ionicons name="close" size={14} color={colors.surface} />
        </Pressable>
      )}
    </View>
  );
}

/** A row of photo/video tiles with a full-screen viewer. */
export function MediaStrip({ items, onRemove, extra }: { items: Media[]; onRemove?: (index: number) => void; extra?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0 && !extra) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {items.map((media, index) => (
          <MediaThumb
            key={media.url}
            media={media}
            onOpen={() => setOpen(index)}
            onRemove={onRemove ? () => onRemove(index) : undefined}
          />
        ))}
        {extra}
      </ScrollView>
      <MediaViewer items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  );
}

/** Full-screen photo / video viewer with swipe-free previous / next buttons. */
export function MediaViewer({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: Media[];
  index: number | null;
  onClose: () => void;
  onIndex?: (index: number) => void;
}) {
  const layerDirection = useDirectionStyle();
  const { t } = useTranslation();
  const { rtl } = useLanguage();
  const media = index === null ? null : items[index];
  return (
    <Modal visible={!!media} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={[styles.viewer, layerDirection]}>
        <View style={styles.viewerBar}>
          <Text variant="label" color="#fff">
            {items.length > 1 && index !== null ? `${index + 1} / ${items.length}` : ''}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('media.close')} onPress={onClose} hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {media?.kind === 'photo' && <Image source={{ uri: media.url }} style={{ flex: 1 }} contentFit="contain" />}
          {media?.kind === 'video' && <VideoPane key={media.url} url={media.url} />}
        </View>
        {items.length > 1 && index !== null && onIndex && (
          <View style={styles.viewerNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('media.previous')}
              disabled={index === 0}
              onPress={() => onIndex(index - 1)}
              style={[styles.navButton, { opacity: index === 0 ? 0.3 : 1 }]}>
              <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('media.next')}
              disabled={index === items.length - 1}
              onPress={() => onIndex(index + 1)}
              style={[styles.navButton, { opacity: index === items.length - 1 ? 0.3 : 1 }]}>
              <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color="#fff" />
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function VideoPane({ url }: { url: string }) {
  const player = useVideoPlayer(url, (created) => {
    created.loop = false;
    created.play();
  });
  return (
    <View style={{ flex: 1 }}>
      <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />
      <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
    </View>
  );
}

/** Dashed "add" tile used at the end of a media strip. */
export function AddTile({ label, icon, onPress, busy }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; busy?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={[styles.thumb, styles.center, styles.add, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
      {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={icon} size={24} color={colors.primary} />}
      <Text variant="caption" color={colors.primary} center style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.sm, paddingVertical: Spacing.xs, paddingEnd: Spacing.sm },
  thumb: { width: 92, height: 92, borderRadius: Radius.md, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', gap: 2, padding: 4 },
  playRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    start: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  remove: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewerNav: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, padding: Spacing.md },
  navButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
