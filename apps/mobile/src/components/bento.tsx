import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Gradient } from '@/components/ui';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Gradients, Radius, rim, softShadow, Spacing, useTheme } from '@/theme';

/** Gap between modules; the screen gives the 16 pt outer margin. */
export const BENTO_GAP = Spacing.md;

const ColumnWidth = createContext(0);

/**
 * Two-column bento grid. Tiles take one or two columns and a height in "cells":
 * 1x1 square metrics, 2x1 wide banners and live controls, 2x2 main focus modules,
 * `auto` when content decides. Use BentoRow + BentoStack for asymmetric layouts
 * (a tall tile beside two small ones).
 */
export function BentoGrid({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ColumnWidth.Provider value={width ? (width - BENTO_GAP) / 2 : 0}>{width ? children : null}</ColumnWidth.Provider>
    </View>
  );
}

export function BentoRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function BentoStack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

type Size = '1x1' | '1x2' | '2x1' | '2x2' | '1xauto' | '2xauto';

export function BentoTile({
  size = '1x1',
  tone = 'surface',
  onPress,
  label,
  children,
  style,
}: {
  size?: Size;
  /** surface: opaque card; hero: violet gradient with white text; soft: the light violet fill. */
  tone?: 'surface' | 'hero' | 'soft';
  onPress?: () => void;
  /** Accessibility label for pressable tiles. */
  label?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const column = useContext(ColumnWidth);
  const { colors, scheme } = useTheme();
  const [columns, rows] = size.split('x');
  const width = columns === '2' ? column * 2 + BENTO_GAP : column;
  const height = rows === 'auto' ? undefined : rows === '2' ? column * 2 + BENTO_GAP : columns === '2' ? column * 0.62 : column;

  const frame: StyleProp<ViewStyle> = [
    styles.tile,
    { width, minHeight: height },
    tone === 'surface' && { backgroundColor: colors.surface },
    tone === 'soft' && { backgroundColor: colors.primarySoft },
    rim(colors),
    scheme === 'light' && tone !== 'hero' && softShadow(colors.shadow, 0.35),
    style,
  ];

  const content =
    tone === 'hero' ? (
      <Gradient colors={Gradients.hero} style={[StyleSheet.absoluteFill, styles.heroFill]}>
        {null}
      </Gradient>
    ) : null;

  const body = (
    <>
      {content}
      {children}
    </>
  );

  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97} onPress={onPress} style={frame}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { gap: BENTO_GAP },
  row: { flexDirection: 'row', gap: BENTO_GAP },
  stack: { gap: BENTO_GAP },
  tile: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, overflow: 'hidden' },
  heroFill: { borderRadius: Radius.lg },
});
