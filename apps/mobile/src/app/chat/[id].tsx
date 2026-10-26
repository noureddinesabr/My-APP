import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markRead, normalizeJob, sendMessage } from '@/backend/actions';
import { useDoc, useQuery, useStore } from '@/backend';
import type { Job, JobStatus, Message } from '@/backend/types';
import { phoneDigits } from '@/components/contact-buttons';
import { useDateFormat } from '@/components/date-format';
import { Avatar } from '@/components/live/parts';
import { useEventText } from '@/components/live/event-text';
import { FreightMap } from '@/components/map/freight-map';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Chip, ForwardChevron, IconButton } from '@/components/ui';
import { currentPosition } from '@/lib/location';
import { pickPhoto } from '@/lib/pick-photo';
import { play } from '@/lib/sounds';
import { useRole } from '@/state/role';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
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
  const [busy, setBusy] = useState<'location' | 'photo' | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const sorted = [...(messages ?? [])].sort((a, b) => a.at - b.at);
  const other = me === 'client' ? { name: job.driverName, photo: job.driverPhoto, phone: job.driverPhone } : { name: job.clientName, photo: job.clientPhoto, phone: job.clientPhone };
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

  const send = async (content: { text?: string; location?: { lat: number; lng: number }; photo?: string }) => {
    play('send');
    await sendMessage(store, job.id, me, content);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
  };

  const shareLocation = async () => {
    setBusy('location');
    const point = (me === 'driver' ? job.driverPos : null) ?? (await currentPosition());
    setBusy(null);
    if (point) send({ location: point });
    else play('error');
  };

  const sharePhoto = async () => {
    setBusy('photo');
    const photo = await pickPhoto(600);
    setBusy(null);
    if (photo) send({ photo });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: colors.surface }, softShadow(colors.shadow, 0.5)]}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Avatar name={other.name} photo={other.photo} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="label" numberOfLines={1}>
              {other.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {t(`status.${status}`)}
            </Text>
          </View>
          <IconButton
            label={t('contact.call')}
            icon={<Ionicons name="call" size={20} color={colors.success} />}
            onPress={() => Linking.openURL(`tel:+${phoneDigits(other.phone)}`).catch(() => {})}
          />
          <IconButton
            label="WhatsApp"
            icon={<MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />}
            onPress={() => Linking.openURL(`https://wa.me/${phoneDigits(other.phone)}`).catch(() => {})}
          />
        </View>

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
          <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              {(QUICK[me][status] ?? []).map((key) => (
                <Chip key={key} label={t(key)} selected={false} onPress={() => send({ text: t(key) })} />
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <IconButton
                label={t('chat.shareLocation')}
                icon={
                  busy === 'location' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="location" size={20} color={colors.primary} />
                  )
                }
                onPress={shareLocation}
              />
              <IconButton
                label={t('chat.sharePhoto')}
                icon={
                  busy === 'photo' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="camera" size={20} color={colors.primary} />
                  )
                }
                onPress={sharePhoto}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                disabled={!text.trim()}
                onPress={() => {
                  send({ text: text.trim() });
                  setText('');
                }}
                style={[styles.send, { backgroundColor: text.trim() ? colors.primary : colors.surfaceMuted }]}>
                <Ionicons name="send" size={18} color={text.trim() ? colors.onPrimary : colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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

  if (message.kind === 'event') {
    return (
      <View style={[styles.event, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name={EVENT_ICONS[message.event ?? ''] ?? 'information-outline'} size={16} color={colors.primary} />
        <Text variant="caption" color={colors.primary} style={{ flexShrink: 1 }}>
          {eventText(message)}
        </Text>
        <Text variant="caption" muted style={{ fontSize: 10 }}>
          {time}
        </Text>
      </View>
    );
  }

  const fg = mine ? colors.onPrimary : colors.text;
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: mine ? colors.primary : colors.surface },
          mine ? { borderBottomEndRadius: 4 } : { borderBottomStartRadius: 4 },
          !mine && softShadow(colors.shadow, 0.3),
        ]}>
        {message.kind === 'location' && message.location && (
          <View style={{ gap: Spacing.xs, width: 220 }}>
            <FreightMap
              height={120}
              markers={[{ id: 'shared', kind: mine ? 'pick' : 'driver', lat: message.location.lat, lng: message.location.lng }]}
              focus={[message.location]}
              focusKey={message.id}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${message.location!.lat},${message.location!.lng}`).catch(() => {})
              }>
              <Text variant="caption" color={fg} style={{ textDecorationLine: 'underline' }}>
                📍 {t('chat.openInMaps')}
              </Text>
            </Pressable>
          </View>
        )}
        {message.kind === 'photo' && message.photo && (
          <Image source={{ uri: message.photo }} style={styles.photo} contentFit="cover" />
        )}
        {!!message.text && message.kind === 'text' && <Text color={fg}>{message.text}</Text>}
        <Text variant="caption" color={fg} style={{ fontSize: 10, lineHeight: 14, opacity: 0.75, alignSelf: 'flex-end' }}>
          {time}
        </Text>
      </View>
      {seen && (
        <View style={styles.seen}>
          <Ionicons name="checkmark-done" size={14} color={colors.primary} />
          <Text variant="caption" color={colors.primary} style={{ fontSize: 11, lineHeight: 15 }}>
            {t('chat.seen')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
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
  composer: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
