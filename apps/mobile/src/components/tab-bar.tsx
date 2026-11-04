import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { haptic } from '@/lib/haptics';
import { Fonts, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type TabItem = { href: string; label: string; icon: IconName; iconActive: IconName; badge?: number };

/**
 * The bottom navigation of the customer (4 tabs) and driver (5 tabs) apps. Tabs run in reading
 * order (right to left in Arabic); the current tab is filled navy with its label in bold.
 */
export function TabBar({ items }: { items: TabItem[] }) {
  const colors = useColors();
  const pathname = usePathname();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }, rim(colors)]} accessibilityRole="tablist">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
        return (
          <PressableScale
            key={item.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            feedback={null}
            scaleTo={0.92}
            onPress={() => {
              if (active) return;
              haptic('selection');
              router.replace(item.href as Href);
            }}
            style={styles.tab}>
            <View style={[styles.pill, active && { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons name={active ? item.iconActive : item.icon} size={24} color={active ? colors.primary : colors.textMuted} />
              {!!item.badge && (
                <View style={[styles.badge, { backgroundColor: colors.accentFill, borderColor: colors.surface }]}>
                  <Text variant="caption" color={colors.onPrimary} style={styles.badgeText}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text variant="caption" color={active ? colors.primary : colors.textMuted} style={[styles.label, active && { fontFamily: Fonts.bold }]}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingBottom: 6, paddingHorizontal: Spacing.xs },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16 },
  badge: { position: 'absolute', top: -3, end: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: Fonts.bold },
});
