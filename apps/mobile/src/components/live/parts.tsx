import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import type { Job, JobStatus, Message, Rating } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useEventText } from '@/components/live/event-text';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Float, Pop, Shimmer } from '@/components/motion/effects';
import { Button, Card, Chip, Gradient } from '@/components/ui';
import { timelineFor, type Level } from '@/lib/trip';
import { play } from '@/lib/sounds';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const STEP_ICONS: Record<JobStatus, IconName> = {
  scheduled: 'calendar-check-outline',
  toPickup: 'truck-fast-outline',
  atPickup: 'map-marker-check-outline',
  loading: 'package-variant',
  inTransit: 'truck-delivery-outline',
  atDropoff: 'flag-checkered',
  delivered: 'check-decagram-outline',
  completed: 'star-circle-outline',
  cancelled: 'close-circle-outline',
};

/** Profile photo, or initials when there is none. */
export function Avatar({ name, photo, size = 48 }: { name: string; photo?: string | null; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photo) return <Image source={{ uri: photo }} style={round} contentFit="cover" />;
  return (
    <Gradient colors={Gradients.primary} style={{ ...round, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="label" color={colors.onPrimary} style={{ fontSize: size * 0.36, lineHeight: size * 0.5 }}>
        {initials || '?'}
      </Text>
    </Gradient>
  );
}

const LEVEL_STYLE: Record<Level, { icon: IconName; color: string }> = {
  new: { icon: 'sprout', color: '#12B886' },
  bronze: { icon: 'medal', color: '#C27C3E' },
  silver: { icon: 'medal', color: '#8E9AAF' },
  gold: { icon: 'crown', color: '#E0A100' },
  platinum: { icon: 'diamond-stone', color: '#5B4BFF' },
};

/** Level pill (New, Bronze, Silver, Gold, Platinum). */
export function LevelBadge({ level }: { level: Level }) {
  const { t } = useTranslation();
  const style = LEVEL_STYLE[level];
  return (
    <View style={[styles.level, { borderColor: style.color }]}>
      <MaterialCommunityIcons name={style.icon} size={13} color={style.color} />
      <Text variant="caption" color={style.color} style={{ fontSize: 13, lineHeight: 18 }}>
        {t(`level.${level}`)}
      </Text>
    </View>
  );
}

/** Vertical list of trip steps with times. */
export function JobTimeline({ job }: { job: Job }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const steps = timelineFor(!!job.scheduledAt);
  const status = job.status === 'loading' ? 'atPickup' : job.status;
  const current = steps.indexOf(status);
  return (
    <Card>
      <Text variant="label">{t('track.progress')}</Text>
      {steps.map((step, index) => {
        const done = current >= 0 && index <= current;
        const active = index === current;
        const at = job.timeline[step];
        return (
          <View key={step} style={styles.stepRow}>
            <View style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: done ? (active ? colors.primaryFill : colors.successFill) : colors.surfaceMuted },
                ]}>
                <MaterialCommunityIcons name={STEP_ICONS[step]} size={16} color={done ? colors.onPrimary : colors.textMuted} />
              </View>
              {index < steps.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: index < current ? colors.successFill : colors.border }]} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: Spacing.sm }}>
              <Text variant={active ? 'label' : 'body'} color={done ? colors.text : colors.textMuted}>
                {t(`status.${step}`)}
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

/** Last message and unread count; opens the full chat. */
export function ChatPreview({ messages, readAt, me, onOpen }: { messages: Message[]; readAt: number; me: 'client' | 'driver'; onOpen: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const eventText = useEventText();
  const last = [...messages].sort((a, b) => b.at - a.at)[0];
  // Trip events are shown on screen anyway; only messages from the other person count as unread.
  const unread = messages.filter((message) => message.from !== me && message.from !== 'system' && message.at > readAt).length;
  const preview = !last
    ? t('chat.empty')
    : last.kind === 'event'
      ? eventText(last)
      : last.kind === 'location'
        ? t('chat.sharedLocation')
        : last.kind === 'photo'
          ? t('chat.sharedPhoto')
          : last.kind === 'video'
            ? t('chat.sharedVideo')
            : last.kind === 'audio'
              ? t('chat.sharedVoice')
              : last.text;
  return (
    <Pressable accessibilityRole="button" onPress={onOpen}>
      <Card style={styles.chatPreview}>
        <View style={[styles.chatIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          {unread > 0 && (
            <View style={[styles.unread, { backgroundColor: colors.accentFill, borderColor: colors.surface }]}>
              <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 13, lineHeight: 18 }}>
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label">{t('chat.title')}</Text>
          <Text variant="caption" muted>
            {preview}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
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
            <Pop trigger={value <= stars}>
              <Ionicons name={value <= stars ? 'star' : 'star-outline'} size={38} color={value <= stars ? colors.star : colors.border} />
            </Pop>
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

/** Confirmation bottom sheet that states plainly what the action loses. */
export function ConfirmSheet({
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
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="title" center>
        {title}
      </Text>
      <Text muted center>
        {body}
      </Text>
      <Button title={keep} variant="accent" onPress={onClose} />
      <PressableScale accessibilityRole="button" feedback="warning" onPress={onConfirm} style={[styles.destructive, { borderColor: colors.accent }]}>
        <Text variant="label" color={colors.accent}>
          {confirm}
        </Text>
      </PressableScale>
    </Sheet>
  );
}

/** Big status banner with an icon, for the top of live screens. */
export function StatusBanner({ icon, title, body, tone = 'primary' }: { icon: IconName; title: string; body?: string; tone?: 'primary' | 'success' | 'accent' }) {
  const colors = useColors();
  return (
    <Animated.View key={title} entering={ZoomIn.springify().damping(14).stiffness(170)}>
    <Gradient colors={tone === 'success' ? Gradients.success : tone === 'accent' ? Gradients.accent : Gradients.primary} style={styles.banner}>
      <Float distance={3}>
        <MaterialCommunityIcons name={icon} size={30} color={colors.onPrimary} />
      </Float>
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
      <Shimmer every={4000} />
    </Gradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  chatPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chatIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  unread: {
    position: 'absolute',
    top: -4,
    end: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepRow: { flexDirection: 'row', gap: Spacing.md },
  stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 12, marginVertical: 2 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  destructive: { minHeight: 52, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
});
