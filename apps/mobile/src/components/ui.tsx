import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
import { Radius, Spacing, useColors } from '@/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const colors = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenContent}>{children}</ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
}: {
  title: string;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'accent' | 'ghost';
}) {
  const colors = useColors();
  const background = { primary: colors.primary, accent: colors.accent, ghost: colors.primarySoft }[variant];
  const foreground = variant === 'ghost' ? colors.primary : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: pressed ? 0.85 : 1 }]}>
      {icon && <Ionicons name={icon} size={20} color={foreground} />}
      <Text variant="label" color={foreground}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Chevron that points "forward" in the reading direction, or backward with `flip`. */
export function ForwardChevron({ color, flip }: { color: string; flip?: boolean }) {
  const { rtl } = useLanguage();
  return <Ionicons name={rtl !== !!flip ? 'chevron-back' : 'chevron-forward'} size={flip ? 26 : 20} color={color} />;
}

const styles = StyleSheet.create({
  screenContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
});
