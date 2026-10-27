import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';

import { Pop, Shimmer } from '@/components/motion/effects';
import { useCountUp } from '@/components/motion/use-count-up';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { ForwardChevron, IconButton } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Fonts, Radius, rim, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const enterSpring = { damping: 18, stiffness: 170 };

/** Wraps a block so it rises into place, `index` steps after the page appears. */
export function Rise({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(90 + index * 60).springify().damping(16).stiffness(160)} style={style}>
      {children}
    </Animated.View>
  );
}

/** A big question whose words rise in one after another (kinetic typography). */
export function KineticTitle({ text, center, size = 28 }: { text: string; center?: boolean; size?: number }) {
  const words = text.split(' ');
  return (
    <View style={[styles.words, center && { justifyContent: 'center' }]} accessible accessibilityRole="header" accessibilityLabel={text}>
      {words.map((word, i) => (
        <Animated.View key={`${i}-${word}`} entering={FadeInDown.delay(i * 45).springify().damping(15).stiffness(170)}>
          <Text variant="hero" style={{ fontSize: size, lineHeight: Math.round(size * 1.42) }}>
            {word}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * The game-style progress bar: a thick violet gradient that springs forward, a band of
 * light running through it all the time, and the percentage inside, counting up.
 */
export function QuestProgress({ value }: { value: number }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, value));
  const percent = useCountUp(Math.round(clamped * 100), 600);
  useEffect(() => {
    fill.set(withSpring(clamped, { damping: 15, stiffness: 110 }));
  }, [fill, clamped]);
  const style = useAnimatedStyle(() => ({ width: Math.max(MIN_FILL, fill.get() * width) }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }, rim(colors)]}>
      <Animated.View style={[styles.fill, style]}>
        <LinearGradient
          colors={[colors.primaryFill, colors.cta]}
          start={{ x: rtl ? 1 : 0, y: 0.5 }}
          end={{ x: rtl ? 0 : 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.gloss, { backgroundColor: colors.onPrimary }]} />
        <Shimmer every={350} color="rgba(255,255,255,0.45)" />
        <Pop trigger={Math.round(clamped * 100)}>
          <Text variant="caption" color={colors.onCta} style={styles.percent}>
            {percent}%
          </Text>
        </Pop>
      </Animated.View>
    </View>
  );
}

const MIN_FILL = 52;

/**
 * One question per screen, like a game level: back, a progress bar and close on top, the
 * question in big words, the answers, and (optionally) one button at the bottom. Nothing
 * scrolls; a new question slides in from the reading direction (from behind when going back).
 */
export function QuestScreen({
  stepKey,
  direction = 1,
  progress,
  title,
  hint,
  onBack,
  onClose,
  backLabel,
  closeLabel,
  footer,
  top,
  topHeight = 0,
  children,
}: {
  /** Shown above the questions and kept in place between them (the trip map). */
  top?: ReactNode;
  topHeight?: number;
  stepKey: string;
  direction?: 1 | -1;
  progress: number;
  title: string;
  hint?: string;
  onBack: () => void;
  onClose?: () => void;
  backLabel: string;
  closeLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const fromEnd = (direction === 1) !== rtl;
  const enter = (fromEnd ? FadeInRight : FadeInLeft).springify().damping(enterSpring.damping).stiffness(enterSpring.stiffness);

  const panel = !!top;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={[{ flex: 1 }, { backgroundColor: colors.background }]}>
      {/* The map stays mounted while the questions change underneath it. */}
      {top && <View style={{ height: topHeight }}>{top}</View>}
      <View style={[styles.screen, panel && [styles.panel, { backgroundColor: colors.surfaceRaised }, rim(colors)]]}>
        {!panel && <LinearGradient colors={[colors.backgroundGlow, colors.background]} style={styles.glow} pointerEvents="none" />}
        <View style={styles.top}>
          <IconButton label={backLabel} icon={<ForwardChevron color={colors.text} flip />} onPress={onBack} />
          <View style={{ flex: 1 }}>
            <QuestProgress value={progress} />
          </View>
          {onClose && <IconButton label={closeLabel ?? ''} icon={<Ionicons name="close" size={22} color={colors.text} />} onPress={onClose} />}
        </View>
        <Animated.View key={stepKey} entering={enter} style={[styles.page, panel && styles.pagePanel]}>
          {/* Fits on usual phones; scrolls instead of cutting off on short ones. */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scroll, panel && styles.scrollPanel]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <KineticTitle text={title} size={panel ? 24 : 28} />
              {hint && (
                <Animated.View entering={FadeInDown.delay(160)}>
                  <Text variant="caption" muted>
                    {hint}
                  </Text>
                </Animated.View>
              )}
            </View>
            <View style={styles.body}>{children}</View>
          </ScrollView>
          {footer && <Rise index={6}>{footer}</Rise>}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * A big answer card. Tapping it pops (sound + haptic), marks it chosen with a springy tick,
 * and calls `onPress` — the screen then moves on by itself.
 */
export function ChoiceCard({
  index = 0,
  title,
  hint,
  icon,
  image,
  badge,
  aside,
  selected,
  layout = 'row',
  onPress,
}: {
  index?: number;
  title: string;
  hint?: string;
  icon?: IconName;
  image?: ImageSource | number;
  badge?: string;
  /** Shown at the end of a row, e.g. a price. */
  aside?: string;
  selected: boolean;
  layout?: 'row' | 'tile';
  onPress: () => void;
}) {
  const colors = useColors();
  const { rtl } = useLanguage();
  const tile = layout === 'tile';
  return (
    <Rise index={index} style={tile ? styles.tileWrap : undefined}>
      <PressableScale
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={[title, hint, aside].filter(Boolean).join(', ')}
        feedback={null}
        scaleTo={0.95}
        onPress={() => {
          play('pop');
          onPress();
        }}
        style={[
          tile ? styles.tile : styles.row,
          { backgroundColor: selected ? colors.primarySoft : colors.surface, borderWidth: 1.5, borderColor: colors.border },
          selected && { borderColor: colors.primary, borderWidth: 2.5 },
          selected && softShadow(colors.primaryFill, 0.8),
        ]}>
        {image ? (
          <Image source={image} style={[styles.image, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
        ) : icon ? (
          <View style={[styles.icon, { backgroundColor: selected ? colors.primaryFill : colors.primarySoft }]}>
            <MaterialCommunityIcons name={icon} size={24} color={selected ? colors.onPrimary : colors.primary} />
          </View>
        ) : null}
        <View style={tile ? styles.tileText : { flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={2} style={tile && styles.tileTitle}>
            {title}
          </Text>
          {hint && (
            <Text variant="caption" muted numberOfLines={2}>
              {hint}
            </Text>
          )}
        </View>
        {aside && !tile && (
          <Text variant="label" color={colors.primary}>
            {aside}
          </Text>
        )}
        {badge && (
          <View style={[styles.badge, { backgroundColor: colors.successFill }]}>
            <Text variant="caption" color={colors.onPrimary}>
              {badge}
            </Text>
          </View>
        )}
        {selected && (
          <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.check, { backgroundColor: colors.primaryFill, borderColor: colors.background }]}>
            <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
          </Animated.View>
        )}
      </PressableScale>
    </Rise>
  );
}

/** Calls `next` a moment after an answer is picked, so the tick and pop are seen first. */
export function useAutoAdvance(next: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, 320);
  };
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  screen: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  panel: { marginTop: -Radius.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderBottomWidth: 0, paddingTop: Spacing.md },
  pagePanel: { gap: Spacing.sm, paddingTop: Spacing.sm },
  scrollPanel: { gap: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  page: { flex: 1, gap: Spacing.md, paddingTop: Spacing.md },
  scroll: { flexGrow: 1, gap: Spacing.lg, paddingBottom: Spacing.sm },
  heading: { gap: Spacing.xs },
  body: { flex: 1, gap: Spacing.sm },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  track: { height: 28, borderRadius: Radius.pill, overflow: 'hidden', justifyContent: 'center' },
  fill: { height: '100%', borderRadius: Radius.pill, overflow: 'hidden', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 10 },
  gloss: { position: 'absolute', top: 3, start: 10, end: 10, height: 3, borderRadius: 2, opacity: 0.3 },
  percent: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.lg, minHeight: 58 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.sm, borderRadius: Radius.lg, minHeight: 64 },
  tileText: { flex: 1 },
  tileTitle: { fontSize: 15, lineHeight: 21 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  image: { width: 72, height: 44 },
  badge: { position: 'absolute', top: -9, end: 14, paddingHorizontal: 8, borderRadius: Radius.pill },
  check: {
    position: 'absolute',
    top: -8,
    start: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
