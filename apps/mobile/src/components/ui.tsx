import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type AnimatedRef } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Shimmer } from '@/components/motion/effects';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useDirectionStyle, useLanguage } from '@/i18n/language-provider';
import { haptic } from '@/lib/haptics';
import { Springs } from '@/lib/motion';
import { play, type SoundName } from '@/lib/sounds';
import { Radius, rim, softShadow, Spacing, useColors, useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Scroll distance before a header starts hiding, and the jitter ignored while scrolling. */
const HEADER_SLACK = 48;
const SCROLL_JITTER = 6;

/**
 * A screen on the black (OLED) base, optionally with the violet glow at the top.
 * - `header`: floats on glass and dissolves while scrolling down; it springs back on scrolling up.
 * - `footer`: the main action, pinned on glass in the thumb zone.
 * - `overlay`: extra floating parts (e.g. the home dock), drawn above the content.
 */
export function Screen({
  children,
  scroll = true,
  header,
  footer,
  overlay,
  glow,
  contentStyle,
  scrollRef,
  top,
}: {
  /** A map that stays in place at the top while the rest scrolls under it (never scrolled away or covered). */
  top?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  glow?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** From useAnimatedRef(), to scroll to a section (e.g. from the dock). */
  scrollRef?: AnimatedRef<Animated.ScrollView>;
}) {
  const colors = useColors();
  const layerDirection = useDirectionStyle();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const hidden = useSharedValue(0);
  const lastY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.get();
    if (y < HEADER_SLACK) hidden.set(0);
    else if (dy > SCROLL_JITTER) hidden.set(1);
    else if (dy < -SCROLL_JITTER) hidden.set(0);
    lastY.set(y);
  });

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(hidden.get() ? -(headerHeight + Spacing.md) : 0, Springs.bar) }],
    opacity: withSpring(hidden.get() ? 0 : 1, Springs.bar),
  }));

  const measure = (set: (height: number) => void) => (event: LayoutChangeEvent) => set(event.nativeEvent.layout.height);
  const { height: screenHeight } = useWindowDimensions();
  const padding = {
    // With a map on top, the header floats over the map, not over the content.
    paddingTop: (header && !top ? headerHeight + Spacing.sm : 0) + Spacing.lg,
    paddingBottom: (footer ? footerHeight : 0) + Spacing.xxl + (overlay ? 96 : 0),
  };

  return (
    // Lifts fields and the footer above the keyboard (Android draws behind it, edge to edge).
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={[{ flex: 1, backgroundColor: colors.background, overflow: 'hidden' }, layerDirection]}>
      {glow && (
        <LinearGradient
          colors={[colors.backgroundGlow, colors.background]}
          style={[styles.glow, { height: 420, top: 0 }]}
          pointerEvents="none"
        />
      )}
      {top && <View style={{ height: Math.round(screenHeight * MAP_SHARE) }}>{top}</View>}
      {scroll ? (
        <Animated.ScrollView
          style={top ? [styles.underMap, { backgroundColor: colors.surfaceRaised }] : undefined}
          entering={FadeIn.duration(260)}
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.screenContent, padding, contentStyle]}
          keyboardShouldPersistTaps="handled">
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.screenContent, padding, { flex: 1 }, contentStyle]}>{children}</View>
      )}
      {header && (
        <Animated.View style={[styles.header, headerStyle]} onLayout={measure(setHeaderHeight)} pointerEvents="box-none">
          <Glass style={styles.headerGlass} thickness="thick">
            {header}
          </Glass>
        </Animated.View>
      )}
      {footer && (
        <View style={[styles.footer, { paddingBottom: Spacing.md }]} onLayout={measure(setFooterHeight)}>
          <Glass style={styles.footerGlass} thickness="thick">
            {footer}
          </Glass>
        </View>
      )}
      {overlay}
    </KeyboardAvoidingView>
  );
}

/** Opaque card on surface level 1, separated from the black base by a 1 px rim. */
export function Card({ children, style, raised }: { children: ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: raised ? colors.surfaceRaised : colors.surface },
        rim(colors),
        scheme === 'light' && softShadow(colors.shadow, 0.4),
        style,
      ]}>
      {children}
    </View>
  );
}

export function Gradient({
  colors,
  children,
  style,
}: {
  colors: readonly [string, string, ...string[]];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

/**
 * - `accent`: the screen's main action — a solid white pill in dark mode (black in light),
 *   the most contrasted element on screen. Use once per screen.
 * - `primary`: a filled blue pill for other important actions.
 * - `ghost`: a neutral control pill.
 */
export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  sound = 'tap',
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'accent' | 'ghost';
  disabled?: boolean;
  /** Played on press (with its haptic); null for silence. */
  sound?: SoundName | null;
}) {
  const colors = useColors();
  const background = variant === 'accent' ? colors.cta : variant === 'ghost' ? colors.control : colors.primaryFill;
  const foreground = variant === 'accent' ? colors.onCta : variant === 'ghost' ? colors.onControl : colors.onPrimary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      feedback={sound ? null : 'light'}
      onPress={() => {
        if (sound) play(sound);
        onPress?.();
      }}
      style={[styles.button, { backgroundColor: background }]}>
      {variant !== 'ghost' && !disabled && <Shimmer color={variant === 'accent' ? `${colors.primary}66` : 'rgba(255,255,255,0.28)'} />}
      {icon && <Ionicons name={icon} size={20} color={foreground} />}
      <Text variant="label" color={foreground}>
        {title}
      </Text>
    </PressableScale>
  );
}

/** Chevron that points "forward" in the reading direction, or backward with `flip`. */
export function ForwardChevron({ color, flip }: { color: string; flip?: boolean }) {
  const { rtl } = useLanguage();
  return <Ionicons name={rtl !== !!flip ? 'chevron-back' : 'chevron-forward'} size={flip ? 26 : 20} color={color} />;
}

/** Round control button, e.g. back or close. */
export function IconButton({ icon, onPress, label }: { icon: ReactNode; onPress: () => void; label: string }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.9}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: colors.surfaceRaised }, rim(colors)]}>
      {icon}
    </PressableScale>
  );
}

/** Round action with a label underneath (Add money / Move / Details in the reference design). */
export function RoundAction({ icon, label, onPress, onHero }: { icon: IconName; label: string; onPress: () => void; onHero?: boolean }) {
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.9} onPress={onPress} style={styles.roundAction}>
      <View style={[styles.roundIcon, { backgroundColor: onHero ? colors.heroControl : colors.control }]}>
        <Ionicons name={icon} size={24} color={onHero ? colors.onHero : colors.onControl} />
      </View>
      <Text variant="caption" center numberOfLines={1} color={onHero ? colors.onHero : undefined}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Selectable pill used for quick choices. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      feedback={null}
      scaleTo={0.94}
      onPress={() => {
        haptic('selection');
        play('tap', null);
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryFill : colors.surface,
          borderColor: selected ? colors.primaryFill : colors.border,
        },
      ]}>
      {icon}
      <Text variant="caption" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Share of the screen the map keeps at the top of map screens (as in the request flow). */
const MAP_SHARE = 0.42;

const styles = StyleSheet.create({
  underMap: { flex: 1, marginTop: -Radius.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  screenContent: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  glow: { position: 'absolute', left: 0, right: 0 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  headerGlass: { borderRadius: Radius.xl, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.md },
  footerGlass: { borderRadius: Radius.xl, padding: Spacing.sm, gap: Spacing.xs },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  button: {
    minHeight: 56,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  iconButton: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  roundAction: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  roundIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
});
