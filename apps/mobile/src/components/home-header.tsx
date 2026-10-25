import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/theme';

export function HomeHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        {subtitle && <Text muted>{subtitle}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="settings"
        onPress={() => router.push('/settings')}
        style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="settings-outline" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
