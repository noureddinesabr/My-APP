import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { useKeyboardHeight } from '@/lib/keyboard';
import { play } from '@/lib/sounds';
import { Fonts, Radius, rim, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const enterSpring = { damping: 18, stiffness: 170 };

/** Height (px) left for the answers under the question, measured by `QuestScreen`; 0 = not known yet. */
const FitContext = createContext(0);

const ROW_MAX = 72;
const ROW_COMFY = 62;
const ROW_MIN = 46;
const ROW_GAP = Spacing.sm;

/**
 * How tall each of `rows` answer rows can be so they all fit in the space under the
 * question without scrolling: comfy (title + hint on two lines) when there is room,
 * compact (one line, smaller text) when it's tight. `capacity` is how many rows fit at the
 * smallest size, for splitting long lists over two pages.
 */
export function useFit(rows: number) {
  const available = useContext(FitContext);
  if (!available) return { height: undefined, compact: false, capacity: rows };
  const per = (available - ROW_GAP * (rows - 1)) / rows;
  const capacity = Math.max(2, Math.floor((available + ROW_GAP) / (ROW_MIN + ROW_GAP)));
  return { height: Math.max(ROW_MIN, Math.min(per, ROW_MAX)), compact: per < ROW_COMFY, capacity };
}


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
          colors={[colors.primaryFill, colors.primary]}
          start={{ x: rtl ? 1 : 0, y: 0.5 }}
          end={{ x: rtl ? 0 : 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.gloss, { backgroundColor: colors.onPrimary }]} />
        <Shimmer every={350} color="rgba(255,255,255,0.45)" />
        <Pop trigger={Math.round(clamped * 100)}>
          <Text variant="caption" color={colors.onPrimary} style={styles.percent}>
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
  badge,
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
  /** A bright pill under the question, e.g. "Optional", so it can't be missed. */
  badge?: string;
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
  const keyboard = useKeyboardHeight();
  const { height: screen } = useWindowDimensions();
  const [viewport, setViewport] = useState(0);
  const [heading, setHeading] = useState(0);
  // Last-resort fit: if a page is still taller than its space (long dates, big phone text),
  // shrink the whole question a little instead of making people scroll.
  const [natural, setNatural] = useState(0);
  const shrink = viewport && natural > viewport ? Math.max(0.62, (viewport - 6) / natural) : 1;
  const available = viewport && heading ? viewport - heading - (panel ? Spacing.md : Spacing.lg) - Spacing.sm : 0;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      // The browser doesn't move the page for the keyboard: lift the panel ourselves there.
      style={[{ flex: 1 }, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'web' ? keyboard : 0 }]}>
      {/* The map stays mounted while the questions change underneath it; while typing it
          shrinks to a strip so the panel can rise and everything typed stays in view. */}
      {top && <View style={{ height: keyboard ? Math.round(screen * 0.14) : topHeight }}>{top}</View>}
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
          <ScrollView
            style={{ flex: 1 }}
            onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View
              onLayout={(event) => setNatural(event.nativeEvent.layout.height)}
              style={[
                styles.scroll,
                panel && styles.scrollPanel,
                // Measured at its own height (no stretching), so shrinking can't feed back on itself.
                { flexGrow: 0 },
                shrink < 1 && { transform: [{ scale: shrink }], transformOrigin: 'top', marginBottom: -natural * (1 - shrink) },
              ]}>
            <View style={styles.heading} onLayout={(event) => setHeading(event.nativeEvent.layout.height)}>
              <KineticTitle text={title} size={panel ? 22 : 28} />
              {badge && (
                <Animated.View entering={ZoomIn.delay(200).springify().damping(11)} style={[styles.badgePill, { backgroundColor: colors.accentFill }]}>
                  <Ionicons name="sparkles" size={14} color={colors.onPrimary} />
                  <Text variant="caption" color={colors.onPrimary} style={styles.badgeText}>
                    {badge}
                  </Text>
                </Animated.View>
              )}
              {hint && (
                <Animated.View entering={FadeInDown.delay(160)}>
                  <Text variant="caption" muted>
                    {hint}
                  </Text>
                </Animated.View>
              )}
            </View>
            <FitContext.Provider value={available}>
              <View style={styles.body}>{children}</View>
            </FitContext.Provider>
            </View>
          </ScrollView>
          {footer && <Rise index={6}>{footer}</Rise>}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Smaller letters in a half-width tile when one word is long ("Déménagement"), so no word is ever split. */
function tileFont(title: string) {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length));
  return longest > 11 ? { fontSize: 13, lineHeight: 18 } : longest > 9 ? { fontSize: 14, lineHeight: 19 } : null;
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
  rows,
  iconScale = 1,
  multi,
  onPress,
}: {
  /** Grows or shrinks the icon (e.g. bigger boxes for heavier weights). */
  iconScale?: number;
  /** One of several that can be ticked together (a checkbox, not a single choice). */
  multi?: boolean;
  /** How many rows of answers the page shows; sizes the card to fit them all. */
  rows?: number;
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
  const fit = useFit(rows ?? 1);
  const compact = !!rows && fit.compact;
  return (
    <Rise index={index} style={tile ? styles.tileWrap : undefined}>
      <PressableScale
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={multi ? { checked: selected } : { selected }}
        accessibilityLabel={[title, hint, aside].filter(Boolean).join(', ')}
        feedback={null}
        scaleTo={0.95}
        onPress={() => {
          play('pop');
          onPress();
        }}
        style={[
          tile ? styles.tile : styles.row,
          rows && fit.height ? { minHeight: fit.height } : null,
          compact && styles.compact,
          { backgroundColor: selected ? colors.primarySoft : colors.surface, borderWidth: 1.5, borderColor: colors.border },
          selected && { borderColor: colors.primary, borderWidth: 2.5 },
          selected && softShadow(colors.primaryFill, 0.8),
        ]}>
        {(image || icon) && (
          <View>
            {image ? (
              <Image source={image} style={[styles.image, compact && styles.imageCompact, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
            ) : (
              <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: selected ? colors.primaryFill : colors.primarySoft }]}>
                <MaterialCommunityIcons name={icon!} size={Math.round((compact ? 20 : 24) * iconScale)} color={selected ? colors.onPrimary : colors.primary} />
              </View>
            )}
            {selected && (
              <Animated.View
                entering={ZoomIn.springify().damping(10)}
                style={[styles.check, { [physical(rtl ? 'right' : 'left')]: -8, backgroundColor: colors.successFill, borderColor: colors.surface }]}>
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              </Animated.View>
            )}
          </View>
        )}
        <View style={tile ? styles.tileText : { flex: 1, gap: 2 }}>
          {/* In a row, the badge ("Best fit") sits right after the name, so it never covers other words. */}
          <View style={styles.titleRow}>
            {compact ? (
              // Tight: one line, the hint after the title in smaller grey text.
              <Text variant="label" style={[styles.compactTitle, tile && tileFont(title)]}>
                {title}
                {hint ? <Text variant="caption" muted style={styles.compactHint}>{`  ${hint}`}</Text> : null}
              </Text>
            ) : (
              <Text variant="label" style={tile && [styles.tileTitle, tileFont(title)]}>
                {title}
              </Text>
            )}
            {badge && !tile && (
              <View style={[styles.inlineBadge, { backgroundColor: colors.successFill }]}>
                <Text variant="caption" color={colors.onPrimary} style={styles.inlineBadgeText}>
                  {badge}
                </Text>
              </View>
            )}
          </View>
          {hint && !compact && (
            <Text variant="caption" muted>
              {hint}
            </Text>
          )}
        </View>
        {aside && !tile && (
          <Text variant="label" color={colors.primary}>
            {aside}
          </Text>
        )}
        {badge && tile && (
          <View style={[styles.badge, { [physical(rtl ? 'left' : 'right')]: 14, backgroundColor: colors.successFill }]}>
            <Text variant="caption" color={colors.onPrimary}>
              {badge}
            </Text>
          </View>
        )}
      </PressableScale>
    </Rise>
  );
}

/** The page each list was left on, so coming back to a question shows the same page. */
const pageMemory = new Map<string, number>();

/**
 * Rows of answers that always fit under the question: all of them when there is room,
 * otherwise split over pages with back / forward buttons under them, so nobody has to scroll.
 * The page is remembered (`id`) when the person goes on and comes back, and the buttons show
 * how many answers are ticked on the other pages. Each row is built with the number of rows
 * on its page (for `ChoiceCard rows`).
 */
export function FittedRows({
  id,
  rows,
  picked = [],
  remember = true,
  more,
  back,
}: {
  id: string;
  /** Come back to the page last seen (several answers can be ticked); otherwise open on the answer. */
  remember?: boolean;
  rows: ((rowsOnPage: number, index: number) => ReactNode)[];
  /** How many answers are ticked in each row. */
  picked?: number[];
  more: string;
  back: string;
}) {
  const { capacity } = useFit(rows.length);
  const perPage = Math.max(1, capacity - 1);
  const pages = Math.ceil(rows.length / perPage);
  // Open on the page last seen while answering, or else on the page with the current answer
  // (a new request, with nothing ticked yet, starts on the first page).
  const firstPicked = picked.findIndex((count) => count > 0);
  const answerPage = firstPicked > 0 ? Math.floor(firstPicked / perPage) : 0;
  const [page, setPageState] = useState(() => (remember && firstPicked >= 0 ? (pageMemory.get(id) ?? answerPage) : answerPage));
  if (capacity >= rows.length) return <>{rows.map((row, index) => row(rows.length, index))}</>;
  const current = Math.min(page, pages - 1);
  const setPage = (next: number) => {
    play('whoosh');
    pageMemory.set(id, next);
    setPageState(next);
  };
  const count = (from: number, to: number) => picked.slice(from * perPage, to * perPage).reduce((sum, n) => sum + n, 0);
  const shown = rows.slice(current * perPage, current * perPage + perPage);
  return (
    <>
      {shown.map((row, index) => row(capacity, index))}
      <PageSwitch page={current} pages={pages} before={count(0, current)} after={count(current + 1, pages)} more={more} back={back} onPage={setPage} />
    </>
  );
}

/** Back / forward between pages of answers: ‹ · · › with the ticked answers waiting on each side. */
function PageSwitch({
  page,
  pages,
  before,
  after,
  more,
  back,
  onPage,
}: {
  page: number;
  pages: number;
  before: number;
  after: number;
  more: string;
  back: string;
  onPage: (page: number) => void;
}) {
  const colors = useColors();
  const first = page === 0;
  const last = page === pages - 1;
  return (
    <Rise index={6} style={styles.switch}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={back}
        accessibilityState={{ disabled: first }}
        disabled={first}
        feedback={null}
        scaleTo={0.92}
        onPress={() => onPage(page - 1)}
        style={[styles.switchBack, { backgroundColor: colors.primarySoft, borderColor: colors.primary, opacity: first ? 0.35 : 1 }]}>
        <ForwardChevron color={colors.primary} flip />
        {before > 0 && <SwitchCount value={before} />}
      </PressableScale>
      <View style={styles.dots}>
        {Array.from({ length: pages }, (_, index) => (
          <View key={index} style={[styles.dot, { backgroundColor: index === page ? colors.primary : colors.border, width: index === page ? 22 : 8 }]} />
        ))}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={more}
        accessibilityState={{ disabled: last }}
        disabled={last}
        feedback={null}
        scaleTo={0.95}
        onPress={() => onPage(page + 1)}
        style={[styles.switchMore, { backgroundColor: colors.primaryFill, opacity: last ? 0.35 : 1 }]}>
        <Text variant="label" color={colors.onPrimary} style={{ flexShrink: 1 }}>
          {more}
        </Text>
        <ForwardChevron color={colors.onPrimary} />
        {after > 0 && <SwitchCount value={after} />}
      </PressableScale>
    </Rise>
  );
}

/** A small round number on a page button: ticked answers on that side. */
function SwitchCount({ value }: { value: number }) {
  const colors = useColors();
  const { rtl } = useLanguage();
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(10)}
      style={[styles.switchCount, { [physical(rtl ? 'left' : 'right')]: -4, backgroundColor: colors.successFill, borderColor: colors.surface }]}>
      <Text variant="caption" color={colors.onPrimary} style={styles.switchCountText}>
        {value}
      </Text>
    </Animated.View>
  );
}

/**
 * A box that never scrolls: when what's inside is a little taller than the space, it is
 * shrunk to fit (like the question pages), so nothing is cut off or hidden.
 */
export function FitPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [viewport, setViewport] = useState(0);
  const [natural, setNatural] = useState(0);
  const shrink = viewport && natural > viewport ? Math.max(0.6, viewport / natural) : 1;
  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={(event) => setViewport(event.nativeEvent.layout.height)}>
      <View
        onLayout={(event) => setNatural(event.nativeEvent.layout.height)}
        style={[{ flexGrow: 0 }, shrink < 1 && { transform: [{ scale: shrink }], transformOrigin: 'top' }]}>
        {children}
      </View>
    </View>
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
  switch: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 50 },
  switchBack: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  switchMore: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minHeight: 50, paddingHorizontal: Spacing.md, borderRadius: 25 },
  switchCount: { position: 'absolute', top: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  switchCountText: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { height: 8, borderRadius: 4 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  screen: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  panel: { marginTop: -Radius.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderBottomWidth: 0, paddingTop: Spacing.md },
  pagePanel: { gap: Spacing.sm, paddingTop: Spacing.sm },
  scrollPanel: { gap: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  page: { flex: 1, gap: Spacing.md, paddingTop: Spacing.md },
  scroll: { flexGrow: 1, gap: Spacing.lg, paddingBottom: Spacing.sm },
  heading: { gap: Spacing.xs },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 3, borderRadius: Radius.pill },
  badgeText: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 19 },
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
  compact: { paddingVertical: 4, gap: Spacing.sm },
  compactTitle: { fontSize: 15, lineHeight: 21 },
  compactHint: { fontSize: 13, lineHeight: 18 },
  iconCompact: { width: 32, height: 32, borderRadius: 16 },
  imageCompact: { width: 56, height: 34 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  image: { width: 72, height: 44 },
  badge: { position: 'absolute', top: -9, paddingHorizontal: 8, borderRadius: Radius.pill },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
  inlineBadge: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: Radius.pill },
  inlineBadgeText: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 17 },
  check: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
