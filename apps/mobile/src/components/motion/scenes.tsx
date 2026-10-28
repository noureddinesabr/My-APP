import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { physical as L } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { useColors, useTheme } from '@/theme';

/**
 * Explainer-video style motion graphics (flat vector shapes, parallax, springs), drawn with
 * SVG and moved on the UI thread. Every scene holds still when "Reduce motion" is on.
 */

/** A value that runs 0 → 1 forever (linear), for looping scenes. */
function useLoop(duration: number, still: boolean) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t, duration, still]);
  return t;
}

/** Buildings for a skyline strip of the given width (deterministic, so both copies match). */
function skyline(width: number, height: number, seed: number) {
  const rects: { x: number; w: number; h: number }[] = [];
  let x = 0;
  let n = seed;
  while (x < width) {
    n = (n * 9301 + 49297) % 233280;
    const w = 18 + (n % 26);
    const h = height * (0.35 + ((n >> 3) % 60) / 100);
    rects.push({ x, w, h });
    x += w + 4;
  }
  return rects;
}

function Strip({ width, height, t, seed, color, window }: { width: number; height: number; t: SharedValue<number>; seed: number; color: string; window: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -t.get() * width }] }));
  const rects = skyline(width, height, seed);
  const copy = (offset: number) =>
    rects.map((r, i) => (
      <G key={`${offset}-${i}`}>
        <Rect x={offset + r.x} y={height - r.h} width={r.w} height={r.h} rx={3} fill={color} />
        {r.h > height * 0.55 && <Rect x={offset + r.x + r.w / 2 - 3} y={height - r.h + 8} width={6} height={6} rx={1.5} fill={window} />}
      </G>
    ));
  return (
    <Animated.View style={[{ position: 'absolute', bottom: 0, [L('left')]: 0, width: width * 2, height }, style]}>
      <Svg width={width * 2} height={height}>
        {copy(0)}
        {copy(width)}
      </Svg>
    </Animated.View>
  );
}

/** The Xapp truck: violet box body, lavender cab, boxes painted on the side. Faces right. */
function Truck({ size }: { size: number }) {
  const colors = useColors();
  const s = size / 150;
  return (
    <Svg width={150 * s} height={74 * s} viewBox="0 0 150 74">
      {/* Chassis */}
      <Rect x={4} y={58} width={136} height={7} rx={3} fill={colors.control} />
      {/* Cargo box with a light top edge */}
      <Rect x={4} y={10} width={94} height={50} rx={8} fill={colors.primaryFill} />
      <Rect x={8} y={12} width={86} height={3} rx={1.5} fill={colors.primary} opacity={0.6} />
      {/* Parcel decal */}
      <G transform="translate(36 22)">
        <Path d="M15 0 L30 7 L30 23 L15 30 L0 23 L0 7 Z" fill={colors.cta} opacity={0.92} />
        <Path d="M0 7 L15 14 L30 7 M15 14 L15 30" stroke={colors.primaryFill} strokeWidth={2.2} fill="none" />
      </G>
      {/* Cab */}
      <Path d="M101 24 L124 24 Q131 24 135 31 L142 44 Q144 48 144 52 L144 60 L101 60 Z" fill={colors.primary} />
      <Path d="M106 29 L122 29 Q126 29 128 33 L133 43 L106 43 Z" fill={colors.background} opacity={0.85} />
      <Rect x={139} y={50} width={6} height={5} rx={2} fill={colors.accent} />
    </Svg>
  );
}

function Wheel({ size, t }: { size: number; t: SharedValue<number> }) {
  const colors = useColors();
  const { scheme } = useTheme();
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.get() * 360}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11.5} fill={scheme === 'dark' ? colors.background : colors.text} />
        <Circle cx={12} cy={12} r={6.5} fill={colors.textMuted} />
        <Circle cx={12} cy={12} r={2.2} fill={scheme === 'dark' ? colors.background : colors.text} />
        <Circle cx={12} cy={7.8} r={1.1} fill={scheme === 'dark' ? colors.background : colors.text} />
      </Svg>
    </Animated.View>
  );
}

function Puff({ t, delay, size }: { t: SharedValue<number>; delay: number; size: number }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => {
    const p = (t.get() + delay) % 1;
    return { opacity: 0.5 * (1 - p), transform: [{ translateX: -p * 40 }, { translateY: -p * 14 }, { scale: 0.4 + p * 1.2 }] };
  });
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.textMuted }, style]} />;
}

/**
 * A truck driving through the city: two parallax skylines, a moving road, spinning wheels,
 * a gentle bounce and exhaust puffs. Mirrored in Arabic so it drives in the reading direction.
 */
export function TruckScene({ height = 150, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const still = useReducedMotion();
  const [width, setWidth] = useState(0);
  const far = useLoop(26000, still);
  const near = useLoop(11000, still);
  const road = useLoop(450, still);
  const wheels = useLoop(500, still);
  const puffs = useLoop(1400, still);
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    bounce.set(withRepeat(withSequence(withTiming(-2.5, { duration: 180 }), withTiming(0, { duration: 220 })), -1, false));
    return () => cancelAnimation(bounce);
  }, [bounce, still]);

  const truckStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.get() }] }));
  const dashStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -road.get() * 40 }] }));

  const roadHeight = Math.round(height * 0.2);
  const truckWidth = Math.min(170, width * 0.5);
  const truckHeight = (truckWidth / 150) * 74;
  const wheel = truckWidth * 0.17;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
      // Drawn with physical positions (left = left in every language), then mirrored as a whole for Arabic.
      style={[{ height, overflow: 'hidden' }, rtl && { transform: [{ scaleX: -1 }] }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {width > 0 && (
        <>
          <View style={[styles.sun, { backgroundColor: colors.primarySoft, top: height * 0.08, [L('right')]: width * 0.12 }]} />
          <View style={[StyleSheet.absoluteFill, { bottom: roadHeight }]}>
            <Strip width={width} height={height * 0.62} t={far} seed={7} color={colors.surfaceRaised} window={colors.primarySoft} />
            <Strip width={width} height={height * 0.42} t={near} seed={3} color={colors.surfaceFloating} window={colors.primarySoft} />
          </View>
          <View style={[styles.road, { height: roadHeight, backgroundColor: colors.control }]}>
            <Animated.View style={[styles.dashes, { [L('left')]: 0, top: roadHeight / 2 - 1.5, width: width + 40 }, dashStyle]}>
              {Array.from({ length: Math.ceil(width / 40) + 1 }, (_, i) => (
                <View key={i} style={[styles.dash, { backgroundColor: colors.textMuted }]} />
              ))}
            </Animated.View>
          </View>
          <Animated.View
            style={[
              styles.truck,
              { width: truckWidth, height: truckHeight + wheel / 2, bottom: roadHeight * 0.55, [L('left')]: (width - truckWidth) / 2 },
              truckStyle,
            ]}>
            <View style={{ position: 'absolute', [L('left')]: -6, bottom: wheel * 0.6 }}>
              <Puff t={puffs} delay={0} size={12} />
              <Puff t={puffs} delay={0.33} size={12} />
              <Puff t={puffs} delay={0.66} size={12} />
            </View>
            <Truck size={truckWidth} />
            <View style={[styles.wheel, { [L('left')]: truckWidth * 0.14, width: wheel }]}>
              <Wheel size={wheel} t={wheels} />
            </View>
            <View style={[styles.wheel, { [L('left')]: truckWidth * 0.72, width: wheel }]}>
              <Wheel size={wheel} t={wheels} />
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const CONFETTI = 22;

function ConfettiPiece({ index, p, colors: palette }: { index: number; p: SharedValue<number>; colors: string[] }) {
  // Spread evenly round the circle with a little jitter, alternating near and far.
  const angle = (index / CONFETTI) * Math.PI * 2 + (index % 3) * 0.17;
  const distance = 70 + (index % 4) * 22;
  const spin = (index % 2 ? 1 : -1) * (360 + (index % 5) * 90);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.75 ? 1 : 1 - (v - 0.75) / 0.25,
      transform: [
        { translateX: Math.cos(angle) * distance * v },
        { translateY: Math.sin(angle) * distance * v + 60 * v * v },
        { rotate: `${spin * v}deg` },
        { scale: v === 0 ? 0 : 1 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.confetti,
        { backgroundColor: palette[index % palette.length], width: index % 3 ? 7 : 10, height: index % 3 ? 12 : 10, borderRadius: index % 3 ? 2 : 5 },
        style,
      ]}
    />
  );
}

/**
 * The "done!" moment: a green disc springs in, a ripple rings out, the tick draws itself
 * and confetti bursts round it, with the celebrate sound.
 */
export function SuccessBurst({ size = 132, sound = true }: { size?: number; sound?: boolean }) {
  const colors = useColors();
  const still = useReducedMotion();
  const disc = useSharedValue(still ? 1 : 0);
  const tick = useSharedValue(still ? 1 : 0);
  const ripple = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (sound) play('celebrate');
    if (still) return;
    disc.set(withSpring(1, { mass: 0.8, stiffness: 180, damping: 11 }));
    ripple.set(withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    tick.set(withDelay(260, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })));
    burst.set(withDelay(200, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) })));
  }, [disc, tick, ripple, burst, still, sound]);

  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: disc.get() }] }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ripple.get()), transform: [{ scale: 1 + ripple.get() * 0.8 }] }));
  // The tick is revealed left to right, like a pen drawing it.
  const tickStyle = useAnimatedStyle(() => ({ width: size * 0.56 * tick.get() }));
  const palette = [colors.primary, colors.accent, colors.success, colors.location, colors.cta];

  return (
    <View style={[styles.burst, { width: size * 2.2, height: size * 2.2 }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: CONFETTI }, (_, i) => (
        <ConfettiPiece key={i} index={i} p={burst} colors={palette} />
      ))}
      <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: colors.success }, rippleStyle]} />
      <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successFill }, discStyle]}>
        <Animated.View style={[{ position: 'absolute', top: size * 0.22, height: size * 0.56, overflow: 'hidden', [L('left')]: size * 0.22 }, tickStyle]}>
          <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
            <Path d="M3 12.5 L9.5 19 L21 6" stroke={colors.onPrimary} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Concentric rings pulsing out from an icon: "looking for drivers". */
export function Radar({ size = 200, children }: { size?: number; children?: React.ReactNode }) {
  const colors = useColors();
  const still = useReducedMotion();
  const t = useLoop(2400, still);
  const sweep = useLoop(3200, still);
  const beam = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.get() * 360}deg` }] }));
  return (
    <View style={[styles.burst, { width: size, height: size }]}>
      {/* A radar beam sweeping round, like a real radar looking for drivers. */}
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: `${colors.primaryFill}14` }]}>
        <Animated.View style={[{ width: size, height: size }, beam]}>
          <Svg width={size} height={size}>
            <Defs>
              <SvgGradient id="beam" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.primaryFill} stopOpacity="0.55" />
                <Stop offset="1" stopColor={colors.primaryFill} stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Path d={`M ${size / 2} ${size / 2} L ${size / 2} 0 A ${size / 2} ${size / 2} 0 0 1 ${size} ${size / 2} Z`} fill="url(#beam)" />
          </Svg>
        </Animated.View>
      </View>
      {[0, 0.33, 0.66].map((delay) => (
        <Ring key={delay} t={t} delay={delay} size={size} color={colors.primaryFill} />
      ))}
      <View style={[styles.circle, { width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: colors.primaryFill }]}>{children}</View>
    </View>
  );
}

function Ring({ t, delay, size, color }: { t: SharedValue<number>; delay: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = (t.get() + delay) % 1;
    return { opacity: 0.55 * (1 - p), transform: [{ scale: 0.36 + p * 0.64 }] };
  });
  return <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth: 2 }, style]} />;
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', width: 54, height: 54, borderRadius: 27 },
  road: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'center', overflow: 'hidden' },
  dashes: { position: 'absolute', flexDirection: 'row', gap: 18 },
  dash: { width: 22, height: 3, borderRadius: 2 },
  truck: { position: 'absolute' },
  wheel: { position: 'absolute', bottom: 0 },
  burst: { alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  confetti: { position: 'absolute' },
});
