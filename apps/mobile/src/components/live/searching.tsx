import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Fonts, Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TIP_MS = 4500;
const TIPS = ['track.tip1', 'track.tip2', 'track.tip3', 'track.tip4'] as const;

/**
 * While drivers look at the request: three steps that light up one after another (sent →
 * visible to drivers → offers), a running clock, and a new helpful tip every few seconds.
 * Everything it says is true; it never invents drivers or offers.
 */
export function SearchProgress({ since }: { since: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const tip = TIPS[Math.floor(seconds / (TIP_MS / 1000)) % TIPS.length];

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.steps}>
        <Step index={0} icon="send-check" label={t('track.stepSent')} done />
        <Link index={0} />
        <Step index={1} icon="account-group" label={t('track.stepSeen')} done />
        <Link index={1} />
        <Step index={2} icon="cash-clock" label={t('track.stepOffers')} />
      </View>
      <View style={[styles.footer, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name="timer-sand" size={16} color={colors.primary} />
        <Text variant="caption" color={colors.primary} style={styles.clock}>
          {clock}
        </Text>
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
        <Animated.View key={tip} entering={FadeInDown.duration(380)} style={{ flex: 1 }}>
          <Text variant="caption" numberOfLines={2}>
            {t(tip)}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

/** One step: a disc that pops in done (with a tick) or keeps pulsing while it is waiting. */
function Step({ index, icon, label, done }: { index: number; icon: IconName; label: string; done?: boolean }) {
  const colors = useColors();
  const still = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (done || still) return;
    pulse.set(withRepeat(withSequence(withTiming(1.14, { duration: 650 }), withTiming(1, { duration: 650 })), -1, false));
  }, [pulse, done, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const fill = done ? colors.successFill : colors.primaryFill;
  return (
    <Animated.View entering={ZoomIn.delay(250 + index * 650).springify().damping(11)} style={styles.step}>
      <Animated.View style={[styles.disc, { backgroundColor: fill }, style]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.onPrimary} />
        {done && (
          <View style={[styles.tick, { backgroundColor: colors.surface, borderColor: colors.successFill }]}>
            <MaterialCommunityIcons name="check-bold" size={10} color={colors.success} />
          </View>
        )}
      </Animated.View>
      <Text variant="caption" center numberOfLines={2} style={[styles.stepLabel, { color: done ? colors.success : colors.primary }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** The line between two steps, filling in as the next one lights up. */
function Link({ index }: { index: number }) {
  const colors = useColors();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(450 + index * 650, withTiming(1, { duration: 500 })));
  }, [grow, index]);
  const style = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  return (
    <View style={[styles.link, { backgroundColor: colors.surfaceMuted }]}>
      <Animated.View style={[styles.linkFill, { backgroundColor: colors.successFill }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 82, alignItems: 'center', gap: 4 },
  disc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', bottom: -3, end: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  link: { flex: 1, height: 4, borderRadius: 2, marginTop: 19, overflow: 'hidden' },
  linkFill: { height: 4, borderRadius: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, minHeight: 52 },
  clock: { fontFamily: Fonts.bold, fontSize: 15, writingDirection: 'ltr' },
  sep: { width: 1, alignSelf: 'stretch' },
});
