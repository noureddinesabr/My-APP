import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Translucent material for FLOATING, temporary parts only: the dock, toasts, sheets'
 * grabber bar, auto-hiding headers. Never put long text or primary content on it.
 *
 * - iOS 26+: the system Liquid Glass (real lensing / refraction).
 * - iOS before 26 and browsers: background blur + a tinted layer + a soft top highlight.
 * - Android: an almost opaque tinted surface (real-time blur is costly on many devices).
 * - Reduce Transparency / high contrast: a fully opaque surface with a stronger rim.
 *
 * `thickness` sets how much of the content behind shows through; text-carrying
 * parts (toasts) use 'thick'.
 */
export function Glass({
  children,
  style,
  thickness = 'regular',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  thickness?: 'thin' | 'regular' | 'thick';
}) {
  const { scheme, colors, reduceTransparency } = useTheme();
  const frame = [styles.frame, { borderColor: colors.rim }, style];

  if (reduceTransparency) {
    return <View style={[frame, { backgroundColor: colors.surfaceFloating }]}>{children}</View>;
  }

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle={thickness === 'thin' ? 'clear' : 'regular'} colorScheme={scheme} style={frame}>
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === 'android') {
    // No live blur: keep it ≥ 92 % opaque so text stays fully legible.
    return <View style={[frame, { backgroundColor: colors.surfaceFloating }]}>{children}</View>;
  }

  const tint = thickness === 'thick' ? 0.86 : thickness === 'thin' ? 0.45 : 0.68;
  return (
    <BlurView
      intensity={thickness === 'thin' ? 24 : 48}
      tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[frame, styles.clip]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceFloating, opacity: tint }]} pointerEvents="none" />
      {/* Specular highlight along the top edge, like light catching a glass rim. */}
      <LinearGradient
        colors={scheme === 'dark' ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
        style={styles.highlight}
        pointerEvents="none"
      />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1 },
  clip: { overflow: 'hidden' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 24 },
});
