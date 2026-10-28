import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { CountUp, PulseDot, Shimmer } from '@/components/motion/effects';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Fonts, Radius, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TIP_MS = 4500;
const TIPS = ['track.tip1', 'track.tip2', 'track.tip3', 'track.tip4'] as const;
const STEP_MS = 700;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The whole "looking for drivers" moment in one compact card that fits the panel: the live
 * badge and title, the client's price glowing like a ticket next to a ring clock, three steps
 * that light up one after another with a little sound (sent → drivers can see it → offers),
 * and a new tip every few seconds. Everything it says is true; it never invents drivers or offers.
 */
export function SearchingCard({ since, price, onCancel, cancelLabel }: { since: number; price: number; onCancel: () => void; cancelLabel: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const tip = TIPS[Math.floor(seconds / (TIP_MS / 1000)) % TIPS.length];

  // The steps light up one by one, each with its sound.
  useEffect(() => {
    const timers = [0, 1, 2].map((i) => setTimeout(() => play(i === 2 ? 'pop' : 'step'), 350 + i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.live, { backgroundColor: colors.successSoft }]}>
          <PulseDot color={colors.success} size={8} />
          <Text variant="caption" color={colors.success} style={styles.liveText}>
            {t('track.live')}
          </Text>
        </View>
        <Text variant="title" style={styles.title}>
          {t('track.searchingShort')}
        </Text>
        <Dots />
      </View>

      <View style={styles.hero}>
        {/* The price, glowing: what drivers see and answer to. */}
        <View style={[styles.ticket, { backgroundColor: colors.successFill, borderColor: colors.success }, softShadow(colors.successFill, 1.4)]}>
          <Shimmer every={2200} color="rgba(255,255,255,0.3)" />
          <Text variant="caption" color={colors.onPrimary} style={styles.ticketLabel}>
            {t('track.offeredPrice')}
          </Text>
          <CountUp value={price} from={0} format={(value) => formatMoney(t, value)} variant="title" color={colors.onPrimary} style={styles.ticketPrice} />
        </View>
        <RingClock seconds={seconds} />
      </View>

      <View style={styles.steps}>
        <Step index={0} icon="send-check" label={t('track.stepSent')} done />
        <Link index={0} />
        <Step index={1} icon="account-group" label={t('track.stepSeen')} done />
        <Link index={1} />
        <Step index={2} icon="cash-clock" label={t('track.stepOffers')} />
      </View>

      <View style={[styles.tip, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={colors.primary} />
        <Animated.View key={tip} entering={FadeInDown.duration(380)} style={{ flex: 1 }}>
          <Text variant="caption" style={styles.tipText}>
            {t(tip)}
          </Text>
        </Animated.View>
      </View>

      <Text variant="label" color={colors.accent} center onPress={onCancel} accessibilityRole="button" style={styles.cancel}>
        {cancelLabel}
      </Text>
    </View>
  );
}

/** Time since the request went live, inside a ring that fills once a minute. */
function RingClock({ seconds }: { seconds: number }) {
  const colors = useColors();
  const size = 64;
  const r = 27;
  const length = 2 * Math.PI * r;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming((seconds % 60) / 60, { duration: 900 }));
  }, [fill, seconds]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - fill.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${seconds}s`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={5} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="caption" color={colors.primary} style={styles.clock}>
        {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
      </Text>
    </View>
  );
}

/** Three dots bouncing one after another: "still looking". */
function Dots() {
  const colors = useColors();
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={colors.primary} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const still = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 420 })), -1, false)));
  }, [y, delay, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** One step: a disc that pops in done (with a tick) or keeps pulsing while it is waiting. */
function Step({ index, icon, label, done }: { index: number; icon: IconName; label: string; done?: boolean }) {
  const colors = useColors();
  const still = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (done || still) return;
    pulse.set(withRepeat(withSequence(withTiming(1.16, { duration: 650 }), withTiming(1, { duration: 650 })), -1, false));
  }, [pulse, done, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const fill = done ? colors.successFill : colors.primaryFill;
  return (
    <Animated.View entering={ZoomIn.delay(350 + index * STEP_MS).springify().damping(11)} style={styles.step}>
      <Animated.View style={[styles.disc, { backgroundColor: fill }, style]}>
        <MaterialCommunityIcons name={icon} size={17} color={colors.onPrimary} />
        {done && (
          <View style={[styles.tick, { backgroundColor: colors.surface, borderColor: colors.successFill }]}>
            <MaterialCommunityIcons name="check-bold" size={9} color={colors.success} />
          </View>
        )}
      </Animated.View>
      <Text variant="caption" center style={[styles.stepLabel, { color: done ? colors.success : colors.primary }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * The arrow from one step to the next (pointing in the reading direction): it draws itself as
 * the next step lights up, then a little arrowhead keeps flowing along it, towards the offers.
 */
function Link({ index }: { index: number }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const still = useReducedMotion();
  const grow = useSharedValue(0);
  const flow = useSharedValue(0);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    grow.set(withDelay(450 + index * STEP_MS, withTiming(1, { duration: 500 })));
    if (!still) flow.set(withDelay(1200 + index * 250, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false)));
  }, [grow, flow, index, still]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  // Travels from the start of the arrow to its head, fading out as it arrives.
  const runner = useAnimatedStyle(() => ({
    opacity: grow.get() < 1 ? 0 : Math.sin(flow.get() * Math.PI),
    transform: [{ translateX: (rtl ? -1 : 1) * flow.get() * Math.max(0, width - 14) }],
  }));
  return (
    <View style={styles.link} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.linkTrack, { backgroundColor: colors.surfaceMuted }]}>
        <Animated.View style={[styles.linkFill, { backgroundColor: colors.successFill }, fill]} />
      </View>
      {/* The triangle head, at the end the steps go towards. */}
      {/* Physical sides (the head points left in Arabic, right otherwise), so native RTL can't flip it twice. */}
      <View
        style={[
          styles.arrowHead,
          // A triangle points away from its coloured border: right border → points left (Arabic).
          rtl
            ? { [physical('right') === 'right' ? 'borderRightColor' : 'borderLeftColor']: colors.successFill, [physical('right') === 'right' ? 'borderRightWidth' : 'borderLeftWidth']: 9, [physical('left')]: 0 }
            : { [physical('left') === 'left' ? 'borderLeftColor' : 'borderRightColor']: colors.successFill, [physical('left') === 'left' ? 'borderLeftWidth' : 'borderRightWidth']: 9, [physical('right')]: 0 },
        ]}
      />
      <Animated.View style={[styles.runner, { [physical(rtl ? 'right' : 'left')]: 0 }, runner]}>
        <MaterialCommunityIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={16} color={colors.success} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  liveText: { fontFamily: Fonts.extrabold, fontSize: 13, lineHeight: 18 },
  title: { fontSize: 20, lineHeight: 28, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 4, paddingTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ticket: { flex: 1, borderRadius: Radius.lg, borderWidth: 2, paddingHorizontal: Spacing.md, paddingVertical: 6, overflow: 'hidden' },
  ticketLabel: { fontSize: 13, lineHeight: 17, opacity: 0.92 },
  ticketPrice: { fontSize: 26, lineHeight: 34 },
  clock: { fontFamily: Fonts.bold, fontSize: 13, writingDirection: 'ltr' },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 92, alignItems: 'center', gap: 2 },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', bottom: -3, end: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16 },
  link: { flex: 1, height: 18, marginTop: 9, justifyContent: 'center' },
  linkTrack: { height: 4, borderRadius: 2, marginHorizontal: 6, overflow: 'hidden' },
  linkFill: { height: 4, borderRadius: 2 },
  arrowHead: { position: 'absolute', top: 2, width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  runner: { position: 'absolute', top: -14 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, overflow: 'hidden', minHeight: 32 },
  tipText: { fontSize: 13, lineHeight: 18 },
  cancel: { paddingVertical: 4, fontSize: 15 },
});
