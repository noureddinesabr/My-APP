import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { CountUp, PulseDot, Shimmer } from '@/components/motion/effects';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Fonts, Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TIP_MS = 4500;
const TIPS = ['track.tip1', 'track.tip2', 'track.tip3', 'track.tip4'] as const;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The whole "looking for drivers" moment in one compact card that fits the panel: the live
 * badge and title, the client's price glowing like a ticket next to a ring clock, the relay of
 * three steps (request → drivers → offers, see `Relay`),
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

      <Relay request={t('track.stepSent')} drivers={t('track.stepSeen')} offers={t('track.stepOffers')} />

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

/** One loop of the relay: the request lights up, the arrow carries it to the drivers, then on to the offers. */
const RELAY_MS = 3600;
const FIRST_ARRIVAL = 0.86;

/**
 * The three steps as a relay that keeps running while the request is live: the request grows
 * big and settles, a triangle runs along the arrow to the drivers, who grow and settle as it
 * runs on to the offers. The offers step then stays big, violet and glowing (it is what the
 * client is waiting for) until an offer arrives and this card goes away. The first two steps
 * are true from the start (the request is sent and visible to drivers); nothing is invented.
 */
function Relay({ request, drivers, offers }: { request: string; drivers: string; offers: string }) {
  const still = useReducedMotion();
  const clock = useSharedValue(still ? FIRST_ARRIVAL : 0);
  const arrived = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    clock.set(withDelay(250, withRepeat(withTiming(1, { duration: RELAY_MS, easing: Easing.linear }), -1, false)));
    arrived.set(withDelay(250 + RELAY_MS * FIRST_ARRIVAL, withSpring(1, { damping: 9, stiffness: 140 })));
    // A sound per step, the first time round only.
    const timers = [
      setTimeout(() => play('step'), 300),
      setTimeout(() => play('step'), 250 + RELAY_MS * 0.5),
      setTimeout(() => play('pop'), 250 + RELAY_MS * FIRST_ARRIVAL),
    ];
    return () => timers.forEach(clearTimeout);
  }, [clock, arrived, still]);

  return (
    <View style={styles.relay} accessibilityRole="progressbar" accessibilityLabel={`${request}, ${drivers}, ${offers}`}>
      <RelayStep clock={clock} icon="clipboard-check" label={request} peak={[0, 0.08, 0.26]} done />
      <RelayArrow clock={clock} span={[0.16, 0.46]} />
      <RelayStep clock={clock} icon="account-group" label={drivers} peak={[0.42, 0.52, 0.68]} done />
      <RelayArrow clock={clock} span={[0.58, FIRST_ARRIVAL]} />
      <OffersStep clock={clock} arrived={arrived} label={offers} />
    </View>
  );
}

type Clock = SharedValue<number>;

/** A done step (green, with a tick) that swells when the relay reaches it and settles again. */
function RelayStep({ clock, icon, label, peak, done }: { clock: Clock; icon: IconName; label: string; peak: [number, number, number]; done?: boolean }) {
  const colors = useColors();
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(clock.get(), [peak[0], peak[1], peak[2]], [1, 1.32, 1], Extrapolation.CLAMP) }] }));
  const glow = useAnimatedStyle(() => ({ opacity: interpolate(clock.get(), [peak[0], peak[1], peak[2]], [0, 0.55, 0], Extrapolation.CLAMP) }));
  return (
    <View style={styles.relayStep}>
      <View style={styles.discBox}>
        <Animated.View style={[styles.discGlow, { backgroundColor: colors.successFill }, glow]} />
        <Animated.View style={[styles.disc, { backgroundColor: colors.successFill }, grow]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.onPrimary} />
          {done && (
            <View style={[styles.tick, { backgroundColor: colors.surface, borderColor: colors.successFill }]}>
              <MaterialCommunityIcons name="check-bold" size={9} color={colors.success} />
            </View>
          )}
        </Animated.View>
      </View>
      <Text variant="caption" center color={colors.success} style={styles.stepLabel}>
        {label}
      </Text>
    </View>
  );
}

/** The step everyone waits for: bigger than the others once reached, violet, with a halo that keeps breathing. */
function OffersStep({ clock, arrived, label }: { clock: Clock; arrived: Clock; label: string }) {
  const colors = useColors();
  const still = useReducedMotion();
  const halo = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    halo.set(withDelay(250 + RELAY_MS * FIRST_ARRIVAL, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [halo, still]);
  // Big once reached, with a little extra bump each time the relay comes round again.
  const grow = useAnimatedStyle(() => {
    const bump = interpolate(clock.get(), [FIRST_ARRIVAL - 0.02, FIRST_ARRIVAL + 0.05, 1], [0, 0.14, 0], Extrapolation.CLAMP);
    return { transform: [{ scale: 1 + arrived.get() * 0.42 + bump * arrived.get() }] };
  });
  const ring = useAnimatedStyle(() => ({ opacity: arrived.get() * (1 - halo.get()) * 0.7, transform: [{ scale: 1.2 + halo.get() * 0.9 }] }));
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: arrived.get() * 6 }, { scale: 1 + arrived.get() * 0.08 }] }));
  return (
    <View style={styles.relayStep}>
      <View style={styles.discBox}>
        <Animated.View style={[styles.halo, { borderColor: colors.primary }, ring]} />
        <Animated.View style={[styles.disc, softShadow(colors.primaryFill, 1.6), grow]}>
          <LinearGradient colors={[...Gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.discFill]} />
          <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.onHero} />
        </Animated.View>
      </View>
      <Animated.View style={labelStyle}>
        <Text variant="caption" center color={colors.primary} style={styles.offersLabel}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * The arrow between two steps, pointing the way the steps are read (to the left in Arabic): a
 * track that fills behind a triangle head as it runs from one step to the next during `span`.
 */
function RelayArrow({ clock, span }: { clock: Clock; span: [number, number] }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const [width, setWidth] = useState(0);
  const run = (value: number) => {
    'worklet';
    return interpolate(value, span, [0, 1], Extrapolation.CLAMP);
  };
  const travel = Math.max(0, width - HEAD);
  const fill = useAnimatedStyle(() => ({
    width: run(clock.get()) * width,
    // The trail fades as the loop starts over.
    opacity: interpolate(clock.get(), [0.9, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const head = useAnimatedStyle(() => {
    const p = run(clock.get());
    return {
      opacity: interpolate(p, [0, 0.08, 0.92, 1], [0, 1, 1, 0]),
      transform: [{ translateX: (rtl ? -1 : 1) * p * travel }, { scale: interpolate(p, [0, 0.5, 1], [0.8, 1.15, 0.8]) }],
    };
  });
  // Physical sides, so the native right-to-left layout can't flip it a second time.
  const from = physical(rtl ? 'right' : 'left');
  return (
    <View style={styles.arrow} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.arrowTrack, { backgroundColor: colors.surfaceMuted }]} />
      <Animated.View style={[styles.arrowFill, { [from]: 0, backgroundColor: colors.success }, fill]} />
      <Animated.View style={[styles.arrowHead, { [from]: 0 }, head]}>
        <Svg width={HEAD} height={HEAD}>
          <Polygon points={rtl ? `${HEAD},1 1,${HEAD / 2} ${HEAD},${HEAD - 1}` : `0,1 ${HEAD - 1},${HEAD / 2} 0,${HEAD - 1}`} fill={colors.success} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const HEAD = 18;

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
  relay: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, paddingBottom: 2 },
  relayStep: { width: 84, alignItems: 'center', gap: 6 },
  discBox: { width: 52, height: 40, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  discFill: { borderRadius: 19 },
  discGlow: { position: 'absolute', width: 52, height: 52, borderRadius: 26 },
  halo: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 3 },
  tick: { position: 'absolute', bottom: -3, end: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18 },
  offersLabel: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 19 },
  // Lined up with the middle of the discs (discBox is 40 high, arrow is HEAD high).
  arrow: { flex: 1, height: HEAD, marginTop: 8 + (40 - HEAD) / 2, justifyContent: 'center' },
  arrowTrack: { height: 5, borderRadius: 2.5 },
  arrowFill: { position: 'absolute', top: (HEAD - 5) / 2, height: 5, borderRadius: 2.5 },
  arrowHead: { position: 'absolute', top: 0, width: HEAD, height: HEAD },
  // Wraps to two lines when a tip is long; never cut.
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.lg, minHeight: 32 },
  tipText: { fontSize: 13, lineHeight: 18 },
  cancel: { paddingVertical: 4, fontSize: 15 },
});
