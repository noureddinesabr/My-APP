import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { Job } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { StateView } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useAccount } from '@/state/account';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

/** One row per trip conversation: the other person, the route, the last message and unread count. */
export function Conversations({ side }: { side: 'client' | 'driver' }) {
  const { t } = useTranslation();
  const account = useAccount()[side];
  const jobs = useQuery('jobs', account ? [[side === 'client' ? 'clientId' : 'driverId', account.id]] : null);
  if (!account) return <StateView state="empty" title={t('history.signIn')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: side } })} />;
  if (jobs === undefined) return <StateView state="loading" />;
  const list = [...jobs].sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) return <StateView state="empty" title={t('messages.empty')} body={t('messages.emptyBody')} />;
  return (
    <>
      {list.map((job) => (
        <Row key={job.id} job={job} side={side} />
      ))}
    </>
  );
}

function Row({ job, side }: { job: Job; side: 'client' | 'driver' }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const messages = useQuery('messages', [['jobId', job.id]]);
  const sorted = [...(messages ?? [])].sort((a, b) => b.at - a.at);
  const last = sorted.find((m) => m.from !== 'system') ?? sorted[0];
  const readAt = side === 'client' ? (job.clientReadAt ?? 0) : (job.driverReadAt ?? 0);
  const unread = (messages ?? []).filter((m) => m.from !== side && m.from !== 'system' && m.at > readAt).length;
  const other = side === 'client' ? job.driverName : job.clientName;
  const preview = !last ? t('messages.noMessages') : last.kind === 'text' ? last.text : last.kind === 'event' ? t('messages.tripUpdate') : t(`messages.kind_${last.kind}`);
  return (
    <PressableScale accessibilityRole="button" scaleTo={0.98} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })} style={[styles.row, { backgroundColor: colors.surface }, rim(colors)]}>
      <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
        <Text variant="label" color={colors.primary}>
          {other.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{other}</Text>
        <Text variant="caption" muted>
          {names.shortRoute(job.from, job.to)}
        </Text>
        <Text variant="caption" style={unread ? { fontFamily: Fonts.bold } : undefined}>
          {preview}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {last && (
          <Text variant="caption" muted style={styles.time}>
            {dates.dayTime(new Date(last.at))}
          </Text>
        )}
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primaryFill }]}>
            <Text variant="caption" color={colors.onPrimary} style={styles.badgeText}>
              {unread}
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 12, lineHeight: 16 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 12, lineHeight: 15, fontFamily: Fonts.bold },
});
