import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
import { Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pinned to the bottom, e.g. the main action button. */
  footer?: ReactNode;
}) {
  const colors = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
      )}
      {footer && <View style={[styles.footer, { backgroundColor: colors.background }]}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, softShadow(colors.shadow), style]}>
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
  style?: ViewStyle;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'accent' | 'ghost';
  disabled?: boolean;
}) {
  const colors = useColors();
  const ghost = variant === 'ghost';
  const foreground = ghost ? colors.primary : colors.onPrimary;
  const content = (
    <>
      {icon && <Ionicons name={icon} size={20} color={foreground} />}
      <Text variant="label" color={foreground}>
        {title}
      </Text>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { borderRadius: Radius.md, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        !ghost && softShadow(variant === 'accent' ? Gradients.accent[1] : Gradients.primary[1]),
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      {ghost ? (
        <View style={[styles.button, { backgroundColor: colors.primarySoft }]}>{content}</View>
      ) : (
        <Gradient colors={variant === 'accent' ? Gradients.accent : Gradients.primary} style={styles.button}>
          {content}
        </Gradient>
      )}
    </Pressable>
  );
}

/** Chevron that points "forward" in the reading direction, or backward with `flip`. */
export function ForwardChevron({ color, flip }: { color: string; flip?: boolean }) {
  const { rtl } = useLanguage();
  return <Ionicons name={rtl !== !!flip ? 'chevron-back' : 'chevron-forward'} size={flip ? 26 : 20} color={color} />;
}

/** Round icon button, e.g. back or close. */
export function IconButton({ icon, onPress, label }: { icon: ReactNode; onPress: () => void; label: string }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: colors.surface }, softShadow(colors.shadow, 0.6)]}>
      {icon}
    </Pressable>
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}>
      {icon}
      <Text variant="caption" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  button: {
    minHeight: 56,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  iconButton: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
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
