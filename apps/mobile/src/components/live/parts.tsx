import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Job, JobStatus, Message, Rating } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, Card, Chip, Gradient } from '@/components/ui';
import { TIMELINE } from '@/lib/trip';
import { play } from '@/lib/sounds';
import { Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const STEP_ICONS: Record<JobStatus, IconName> = {
  toPickup: 'truck-fast-outline',
  atPickup: 'map-marker-check-outline',
  loading: 'package-variant',
  inTransit: 'truck-delivery-outline',
  atDropoff: 'flag-checkered',
  delivered: 'check-decagram-outline',
  completed: 'star-circle-outline',
  cancelled: 'close-circle-outline',
};

/** Round avatar with initials. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <Gradient colors={Gradients.primary} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="label" color={colors.onPrimary} style={{ fontSize: size * 0.36, lineHeight: size * 0.5 }}>
        {initials || '?'}
      </Text>
    </Gradient>
  );
}

/** Vertical list of trip steps with times. */
export function JobTimeline({ job }: { job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const current = TIMELINE.indexOf(job.status as (typeof TIMELINE)[number]);
  return (
    <Card>
      <Text variant="label">{t('track.progress')}</Text>
      {TIMELINE.map((status, index) => {
        const done = current >= 0 && index <= current;
        const active = index === current;
        const at = job.timeline[status];
        return (
          <View key={status} style={styles.stepRow}>
            <View style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: done ? (active ? colors.primary : colors.success) : colors.surfaceMuted },
                ]}>
                <MaterialCommunityIcons name={STEP_ICONS[status]} size={16} color={done ? colors.onPrimary : colors.textMuted} />
              </View>
              {index < TIMELINE.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: index < current ? colors.success : colors.border }]} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: Spacing.sm }}>
              <Text variant={active ? 'label' : 'body'} color={done ? colors.text : colors.textMuted}>
                {t(`status.${status}`)}
              </Text>
              {at && (
                <Text variant="caption" muted>
                  {dates.time(new Date(at))}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const QUICK = {
  client: ['chat.clientReady', 'chat.clientCall', 'chat.clientLate', 'chat.clientGate'],
  driver: ['chat.driverOnWay', 'chat.driverArrived', 'chat.driverTraffic', 'chat.driverAddress'],
} as const;

/** Simple chat with one-tap quick messages. */
export function ChatBox({
  me,
  messages,
  onSend,
}: {
  me: 'client' | 'driver';
  messages: Message[];
  onSend: (text: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const [text, setText] = useState('');
  const send = (value: string) => {
    if (!value.trim()) return;
    play('send');
    onSend(value.trim());
    setText('');
  };
  const sorted = [...messages].sort((a, b) => a.at - b.at).slice(-30);
  return (
    <Card>
      <View style={styles.row}>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
        <Text variant="label">{t('chat.title')}</Text>
      </View>
      {sorted.length === 0 && (
        <Text variant="caption" muted>
          {t('chat.empty')}
        </Text>
      )}
      {sorted.map((message) => {
        const mine = message.from === me;
        return (
          <View
            key={message.id}
            style={[
              styles.bubble,
              mine
                ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
                : { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
            ]}>
            <Text color={mine ? colors.onPrimary : colors.text}>{message.text}</Text>
            <Text variant="caption" color={mine ? colors.onPrimary : colors.textMuted} style={{ fontSize: 10, lineHeight: 14, opacity: 0.8 }}>
              {dates.time(new Date(message.at))}
            </Text>
          </View>
        );
      })}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
        {QUICK[me].map((key) => (
          <Chip key={key} label={t(key)} selected={false} onPress={() => send(t(key))} />
        ))}
      </ScrollView>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chat.placeholder')}
          style={{ flex: 1 }}
          onSubmitEditing={() => send(text)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          onPress={() => send(text)}
          style={[styles.sendButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="send" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Card>
  );
}

const TAGS = {
  driver: ['rate.punctual', 'rate.careful', 'rate.friendly', 'rate.cleanVehicle'],
  client: ['rate.ready', 'rate.accurate', 'rate.friendly', 'rate.easyAccess'],
} as const;

/** Stars + quick compliment tags. `about` is who is being rated. */
export function RatingCard({ about, name, onSubmit }: { about: 'driver' | 'client'; name: string; onSubmit: (rating: Rating) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Card style={{ alignItems: 'stretch' }}>
      <Text variant="subtitle" center>
        {t(about === 'driver' ? 'rate.titleDriver' : 'rate.titleClient', { name })}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value}`}
            onPress={() => {
              play('tap');
              setStars(value);
            }}>
            <Ionicons name={value <= stars ? 'star' : 'star-outline'} size={38} color={value <= stars ? colors.star : colors.border} />
          </Pressable>
        ))}
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'center' }]}>
        {TAGS[about].map((key) => (
          <Chip
            key={key}
            label={t(key)}
            selected={tags.includes(key)}
            onPress={() => setTags(tags.includes(key) ? tags.filter((tag) => tag !== key) : [...tags, key])}
          />
        ))}
      </View>
      <Button title={t('rate.submit')} icon="star" sound="success" onPress={() => onSubmit({ stars, tags })} />
    </Card>
  );
}

/** Confirmation dialog that states plainly what the action loses. */
export function ConfirmModal({
  visible,
  title,
  body,
  confirm,
  keep,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirm: string;
  keep: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }, softShadow(colors.shadow, 2)]}>
          <Text variant="title" center>
            {title}
          </Text>
          <Text muted center>
            {body}
          </Text>
          <Button title={keep} onPress={onClose} />
          <Button title={confirm} variant="ghost" sound="error" onPress={onConfirm} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Big status banner with an icon, for the top of live screens. */
export function StatusBanner({ icon, title, body, tone = 'primary' }: { icon: IconName; title: string; body?: string; tone?: 'primary' | 'success' | 'accent' }) {
  const colors = useColors();
  return (
    <Gradient colors={tone === 'success' ? Gradients.success : tone === 'accent' ? Gradients.accent : Gradients.primary} style={styles.banner}>
      <MaterialCommunityIcons name={icon} size={30} color={colors.onPrimary} />
      <View style={{ flex: 1 }}>
        <Text variant="subtitle" color={colors.onPrimary}>
          {title}
        </Text>
        {body && (
          <Text variant="caption" color={colors.onPrimary} style={{ opacity: 0.92 }}>
            {body}
          </Text>
        )}
      </View>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepRow: { flexDirection: 'row', gap: Spacing.md },
  stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 12, marginVertical: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,30,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
});
