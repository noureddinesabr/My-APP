import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/live/parts';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

export function HomeHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  const { account, driverRecord, clientRecord } = useMyRecord();
  const photo = (driverRecord ?? clientRecord)?.photo ?? null;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="profile"
        onPress={() => router.push('/profile')}
        style={softShadow(colors.shadow, 0.6)}>
        <Avatar name={account?.name ?? '?'} photo={photo} size={44} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        {subtitle && <Text muted>{subtitle}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="settings"
        onPress={() => router.push('/settings')}
        style={[styles.iconButton, { backgroundColor: colors.surface }, softShadow(colors.shadow, 0.6)]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
