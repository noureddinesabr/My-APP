import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { NoticeCard } from '@/components/notice';
import { Springs } from '@/lib/motion';
import { Radius, Spacing, useColors } from '@/theme';


/**
 * Holds the predicted-next-step notice at the top of a screen, under its top buttons, where
 * phone notifications appear (so people read it as one).
 */
export function CalloutSlot({ children, top = 72 }: { children?: ReactNode; top?: number }) {
  if (!children) return null;
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

/**
 * The predicted next step (offers waiting, the live trip, resume a draft…) as a notification:
 * tap to open it, flick it away, or let it fade after 5 seconds (it comes back when something new happens).
 */
export function Callout({
  icon,
  title,
  body,
  onPress,
  tone = 'primary',
  progress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  onPress: () => void;
  tone?: 'primary' | 'success' | 'accent';
  /** 0–1: shows a progress bar (e.g. how much of a draft is done). */
  progress?: number;
}) {
  const colors = useColors();
  // Hidden after a flick, until the notice says something else.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${title}|${body}`;
  // Like a phone notification: it fades away by itself after a few seconds.
  useEffect(() => {
    const timer = setTimeout(() => setDismissed(key), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [key]);
  if (dismissed === key) return null;
  return (
    <Animated.View key={key} entering={FadeInUp.springify().damping(Springs.pop.damping).stiffness(Springs.pop.stiffness)} exiting={FadeOutUp}>
      <NoticeCard
        icon={ICON_MAP[icon] ?? 'bell-ring-outline'}
        title={title}
        body={body}
        tone={tone}
        onPress={onPress}
        onDismiss={() => setDismissed(key)}
        footer={
          progress !== undefined ? (
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          ) : undefined
        }
      />
    </Animated.View>
  );
}

/** How long a notice stays before fading away. */
const NOTICE_MS = 5000;

/** The callers' Ionicons names, drawn with the notification's icon set. */
const ICON_MAP: Partial<Record<ComponentProps<typeof Ionicons>['name'], ComponentProps<typeof NoticeCard>['icon']>> = {
  navigate: 'navigation-variant',
  radio: 'radar',
  time: 'clock-outline',
  alarm: 'alarm',
  wallet: 'wallet',
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: Spacing.md, gap: Spacing.sm, zIndex: 40 },
  dock: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.xl, padding: Spacing.xs + 2 },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.lg },
  mainItem: { flex: 1, alignItems: 'center', gap: 2 },
  mainCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  label: { fontSize: 13, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: -6,
    end: -10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 3,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, lineHeight: 16 },
  callout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  calloutIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 3 },
});
