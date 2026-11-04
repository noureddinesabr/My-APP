import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { markRead, normalizeJob, sendMessage } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { Job, JobStatus, Media, Message } from '@/backend/types';
import { phoneDigits } from '@/components/contact-buttons';
import { callUrl, ExternalLink, whatsappUrl } from '@/components/external-link';
import { useDateFormat } from '@/components/date-format';
import { Avatar } from '@/components/live/parts';
import { useEventText } from '@/components/live/event-text';
import { FreightMap } from '@/components/map/freight-map';
import { MediaThumb, MediaViewer } from '@/components/media/media-gallery';
import { useVoiceRecorder } from '@/components/media/use-voice-recorder';
import { RecordingBar, VoiceErrorNotice } from '@/components/media/voice-note-field';
import { VoicePlayer } from '@/components/media/voice-player';
import { Glass } from '@/components/glass';
import { Text } from '@/components/text';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { BRAND } from '@/constants/brands';
import { TextInput } from '@/components/text-input';
import { Chip, ForwardChevron, IconButton } from '@/components/ui';
import { currentPosition } from '@/lib/location';
import { captureMedia, MediaError, type MediaErrorCode } from '@/lib/media';
import { play } from '@/lib/sounds';
import { useRole } from '@/state/role';
import { Radius, rim, Spacing, useColors } from '@/theme';

type Side = 'client' | 'driver';

/** One-tap replies that fit the moment of the trip. */
const QUICK: Record<Side, Partial<Record<JobStatus, string[]>>> = {
  client: {
    scheduled: ['chat.clientConfirmTime', 'chat.clientReady', 'chat.clientChangeTime'],
    toPickup: ['chat.clientReady', 'chat.clientGate', 'chat.clientCall', 'chat.clientLate'],
    atPickup: ['chat.clientComingDown', 'chat.clientTwoMinutes', 'chat.clientGate'],
    inTransit: ['chat.clientReceiver', 'chat.clientCall'],
    atDropoff: ['chat.clientComingDown', 'chat.clientReceiver'],
  },
  driver: {
    scheduled: ['chat.driverConfirmBooking', 'chat.driverExactAddress'],
    toPickup: ['chat.driverOnWay', 'chat.driverTraffic', 'chat.driverAddress'],
    atPickup: ['chat.driverArrived', 'chat.driverNeedHelp'],
    inTransit: ['chat.driverOnWayDropoff', 'chat.driverTraffic'],
    atDropoff: ['chat.driverArrivedDropoff', 'chat.driverCode'],
  },
};

const EVENT_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  booked: 'handshake-outline',
  bookedScheduled: 'calendar-check',
  started: 'truck-fast-outline',
  arrivedPickup: 'map-marker-check-outline',
  leftPickup: 'truck-delivery-outline',
  arrivedDropoff: 'flag-checkered',
  delivered: 'check-decagram-outline',
  completed: 'star-circle-outline',
  cancelledByClient: 'close-circle-outline',
  cancelledByDriver: 'close-circle-outline',
  late: 'clock-alert-outline',
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const raw = useDoc('jobs', id);
  const { role } = useRole();
  if (raw === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (raw === null) return null;
  return <Chat job={normalizeJob(raw)} me={role === 'driver' ? 'driver' : 'client'} />;
}

function Chat({ job, me }: { job: Job; me: Side }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const eventText = useEventText();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'location' | 'photo' | 'video' | 'library' | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mediaError, setMediaError] = useState<MediaErrorCode | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const sorted = [...(messages ?? [])].sort((a, b) => a.at - b.at);
  const other =
    me === 'client'
      ? { name: job.driverName, photo: job.driverPhoto, phone: job.driverPhone }
      : { name: job.clientName, photo: job.clientPhoto, phone: job.clientPhone };
  const otherReadAt = me === 'client' ? job.driverReadAt : job.clientReadAt;
  const myReadAt = me === 'client' ? job.clientReadAt : job.driverReadAt;
  const newest = sorted.length ? sorted[sorted.length - 1].at : 0;
  const lastMine = [...sorted].reverse().find((message) => message.from === me);
  const active = job.status !== 'completed' && job.status !== 'cancelled';
  const status = job.status === 'loading' ? 'atPickup' : job.status;

  // Opening the chat (and new messages while open) marks everything as read.
  useEffect(() => {
    if (newest > myReadAt) markRead(store, job, me).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest]);

  const send = async (content: { text?: string; location?: { lat: number; lng: number }; photo?: string; media?: Media }) => {
    play('send');
    await sendMessage(store, job.id, me, content);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
  };
  const voice = useVoiceRecorder((media) => send({ media }));

  const shareLocation = async () => {
    setBusy('location');
    const point = (me === 'driver' ? job.driverPos : null) ?? (await currentPosition());
    setBusy(null);
    if (point) send({ location: point });
    else play('error');
  };

  /** Camera photo or video, or anything from the gallery. */
  const shareMedia = async (source: 'photo' | 'video' | 'library') => {
    play('tap');
    setAttachOpen(false);
    setMediaError(null);
    setBusy(source);
    try {
      const media =
        source === 'library' ? await captureMedia('library') : await captureMedia('camera', [source === 'photo' ? 'photo' : 'video']);
      if (media?.kind === 'photo') await send({ photo: media.url });
      else if (media) await send({ media });
    } catch (caught) {
      play('error');
      setMediaError(caught instanceof MediaError ? caught.code : 'failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Android draws behind the keyboard (edge to edge), so lift the composer on both platforms. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Glass style={styles.header} thickness="thick">
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Avatar name={other.name} photo={other.photo} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="label">
              {other.name}
            </Text>
            <Text variant="caption" muted>
              {t(`status.${status}`)}
            </Text>
          </View>
          <ExternalLink
            href={callUrl(phoneDigits(other.phone))}
            label={t('contact.call')}
            style={[styles.headerLink, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="call" size={20} color={colors.success} />
          </ExternalLink>
          <ExternalLink
            href={whatsappUrl(phoneDigits(other.phone))}
            label="WhatsApp"
            style={[styles.headerLink, { backgroundColor: colors.successSoft }]}>
            <MaterialCommunityIcons name="whatsapp" size={22} color={BRAND.whatsapp} />
          </ExternalLink>
        </Glass>

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {sorted.length === 0 && (
            <Text muted center>
              {t('chat.empty')}
            </Text>
          )}
          {sorted.map((message) => (
            <Bubble
              key={message.id}
              message={message}
              mine={message.from === me}
              seen={message.id === lastMine?.id && otherReadAt >= message.at}
              time={dates.time(new Date(message.at))}
              eventText={eventText}
            />
          ))}
        </ScrollView>

        {active && (
          <View style={[styles.composer, { backgroundColor: colors.surfaceRaised, borderColor: colors.rim }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              {(QUICK[me][status] ?? []).map((key) => (
                <Chip key={key} label={t(key)} selected={false} onPress={() => send({ text: t(key) })} />
              ))}
            </ScrollView>
            {attachOpen && (
              <View style={styles.attachRow}>
                <AttachOption icon="camera" label={t('media.takePhoto')} onPress={() => shareMedia('photo')} />
                <AttachOption icon="videocam" label={t('media.recordVideo')} onPress={() => shareMedia('video')} />
                <AttachOption icon="images" label={t('media.gallery')} onPress={() => shareMedia('library')} />
                <AttachOption
                  icon="location"
                  label={t('chat.shareLocation')}
                  onPress={() => {
                    setAttachOpen(false);
                    shareLocation();
                  }}
                />
              </View>
            )}
            {voice.phase === 'recording' ? (
              <RecordingBar seconds={voice.seconds} onCancel={() => voice.stop(false)} onDone={() => voice.stop(true)} />
            ) : (
              <View style={styles.inputRow}>
                <IconButton
                  label={t('media.attach')}
                  icon={
                    busy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name={attachOpen ? 'close' : 'add'} size={24} color={colors.primary} />
                    )
                  }
                  onPress={() => {
                    play('tap');
                    setAttachOpen(!attachOpen);
                  }}
                />
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t('chat.placeholder')}
                  style={{ flex: 1 }}
                  onSubmitEditing={() => {
                    if (text.trim()) send({ text: text.trim() });
                    setText('');
                  }}
                  returnKeyType="send"
                />
                {text.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.send')}
                    onPress={() => {
                      send({ text: text.trim() });
                      setText('');
                    }}
                    style={[styles.send, { backgroundColor: colors.primaryFill }]}>
                    <Ionicons name="send" size={18} color={colors.onPrimary} />
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('media.recordVoice')}
                    disabled={voice.phase === 'saving'}
                    onPress={voice.start}
                    style={[styles.send, { backgroundColor: colors.primaryFill }]}>
                    {voice.phase === 'saving' ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="mic" size={20} color={colors.onPrimary} />
                    )}
                  </Pressable>
                )}
              </View>
            )}
            <VoiceErrorNotice error={voice.error} onChooseFile={voice.chooseFile} />
            {mediaError && (
              <Text variant="caption" muted>
                {t(`media.error.${mediaError}`)}
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({
  message,
  mine,
  seen,
  time,
  eventText,
}: {
  message: Message;
  mine: boolean;
  seen: boolean;
  time: string;
  eventText: (message: Message) => string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl } = useLanguage();
  const [viewing, setViewing] = useState(false);
  const viewable: Media | null =
    message.kind === 'photo' && message.photo
      ? { kind: 'photo', url: message.photo }
      : message.kind === 'video' && message.media
        ? message.media
        : null;

  if (message.kind === 'event') {
    return (
      <View style={[styles.event, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name={EVENT_ICONS[message.event ?? ''] ?? 'information-outline'} size={16} color={colors.primary} />
        <Text variant="caption" color={colors.primary} style={{ flexShrink: 1 }}>
          {eventText(message)}
        </Text>
        <Text variant="caption" muted style={{ fontSize: 12 }}>
          {time}
        </Text>
      </View>
    );
  }

  const fg = mine ? colors.onPrimary : colors.text;
  return (
    // Your own messages on the right and the other person's on the left, in every language
    // (in Arabic too, as the owner asked).
    <View style={{ alignItems: mine !== rtl ? 'flex-end' : 'flex-start', gap: 2 }}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: mine ? colors.primaryFill : colors.surface },
          { [physical(mine ? 'right' : 'left') === 'right' ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 4 },
          !mine && rim(colors),
        ]}>
        {message.kind === 'location' && message.location && (
          <View style={{ gap: Spacing.xs, width: 220 }}>
            <FreightMap
              height={120}
              markers={[{ id: 'shared', kind: mine ? 'pick' : 'driver', lat: message.location.lat, lng: message.location.lng }]}
              focus={[message.location]}
              focusKey={message.id}
            />
            <ExternalLink
              href={`https://www.google.com/maps/search/?api=1&query=${message.location.lat},${message.location.lng}`}
              label={t('chat.openInMaps')}>
              <Text variant="caption" color={fg} style={{ textDecorationLine: 'underline' }}>
                📍 {t('chat.openInMaps')}
              </Text>
            </ExternalLink>
          </View>
        )}
        {message.kind === 'photo' && message.photo && (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={t('media.openPhoto')} onPress={() => setViewing(true)}>
            <Image source={{ uri: message.photo }} style={styles.photo} contentFit="cover" />
          </Pressable>
        )}
        {message.kind === 'video' && message.media && (
          <MediaThumb media={message.media} width={220} size={165} onOpen={() => setViewing(true)} />
        )}
        {message.kind === 'audio' && message.media && <VoicePlayer media={message.media} tint={mine ? colors.onPrimary : undefined} />}
        {viewable && <MediaViewer items={[viewable]} index={viewing ? 0 : null} onClose={() => setViewing(false)} />}
        {!!message.text && message.kind === 'text' && (
          <Text color={fg} userText>
            {message.text}
          </Text>
        )}
        <Text variant="caption" color={fg} style={{ fontSize: 12, lineHeight: 16, opacity: 0.75, alignSelf: 'flex-end' }}>
          {time}
        </Text>
      </View>
      {seen && (
        <View style={styles.seen}>
          <Ionicons name="checkmark-done" size={14} color={colors.primary} />
          <Text variant="caption" color={colors.primary} style={{ fontSize: 13, lineHeight: 18 }}>
            {t('chat.seen')}
          </Text>
        </View>
      )}
    </View>
  );
}

function AttachOption({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.attachOption}>
      <View style={[styles.attachIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text variant="caption" center>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerLink: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  attachRow: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.sm },
  attachOption: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  attachIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.xl },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  event: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    maxWidth: '92%',
  },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, gap: 2 },
  photo: { width: 220, height: 165, borderRadius: Radius.md },
  seen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  composer: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
