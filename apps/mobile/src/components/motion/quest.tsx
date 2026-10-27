import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';

import { Shimmer } from '@/components/motion/effects';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { ForwardChevron, IconButton } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { play } from '@/lib/sounds';
import { Radius, rim, Spacing, useColors } from '@/theme';

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
export function KineticTitle({ text, center }: { text: string; center?: boolean }) {
  const words = text.split(' ');
  return (
    <View style={[styles.words, center && { justifyContent: 'center' }]} accessible accessibilityRole="header" accessibilityLabel={text}>
      {words.map((word, i) => (
        <Animated.View key={`${i}-${word}`} entering={FadeInDown.delay(i * 45).springify().damping(15).stiffness(170)}>
          <Text variant="hero" style={styles.word}>
            {word}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** Thick progress bar that springs forward as questions are answered. */
export function QuestProgress({ value }: { value: number }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withSpring(Math.max(0, Math.min(1, value)), { damping: 16, stiffness: 120 }));
  }, [fill, value]);
  const style = useAnimatedStyle(() => ({ width: Math.max(14, fill.get() * width) }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, style]}>
        <View style={[styles.shine, { backgroundColor: colors.cta }]} />
        <Shimmer every={1800} />
      </Animated.View>
    </View>
  );
}

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
  children,
}: {
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <IconButton label={backLabel} icon={<ForwardChevron color={colors.text} flip />} onPress={onBack} />
        <View style={{ flex: 1 }}>
          <QuestProgress value={progress} />
        </View>
        {onClose && <IconButton label={closeLabel ?? ''} icon={<Ionicons name="close" size={22} color={colors.text} />} onPress={onClose} />}
      </View>
      <Animated.View key={stepKey} entering={enter} style={styles.page}>
        <View style={styles.heading}>
          <KineticTitle text={title} />
          {hint && (
            <Animated.View entering={FadeInDown.delay(160)}>
              <Text variant="body" muted>
                {hint}
              </Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.body}>{children}</View>
        {footer && <Rise index={6}>{footer}</Rise>}
      </Animated.View>
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
          { backgroundColor: selected ? colors.primarySoft : colors.surface },
          rim(colors),
          selected && { borderColor: colors.primary, borderWidth: 2 },
        ]}>
        {image ? (
          <Image source={image} style={[styles.image, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
        ) : icon ? (
          <View style={[styles.icon, { backgroundColor: selected ? colors.primaryFill : colors.surfaceMuted }]}>
            <MaterialCommunityIcons name={icon} size={28} color={selected ? colors.onPrimary : colors.primary} />
          </View>
        ) : null}
        <View style={tile ? styles.tileText : { flex: 1, gap: 2 }}>
          <Text variant="subtitle" center={tile} numberOfLines={2}>
            {title}
          </Text>
          {hint && (
            <Text variant="caption" muted center={tile} numberOfLines={2}>
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
  screen: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  page: { flex: 1, gap: Spacing.lg, paddingTop: Spacing.lg },
  heading: { gap: Spacing.xs },
  body: { flex: 1, gap: Spacing.sm },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  word: { fontSize: 28, lineHeight: 40 },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  shine: { position: 'absolute', top: 2, left: 6, right: 6, height: 2, borderRadius: 1, opacity: 0.35 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, minHeight: 72 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, minHeight: 104 },
  tileText: { alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  image: { width: 84, height: 52 },
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
