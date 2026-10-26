import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/live/parts';
import { MenuButton } from '@/components/menu-drawer';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Spacing } from '@/theme';

/** Floating home header: the ☰ menu at the reading start, the greeting, and the profile photo. */
export function HomeHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useTranslation();
  const { account, driverRecord, clientRecord } = useMyRecord();
  const photo = (driverRecord ?? clientRecord)?.photo ?? null;
  return (
    <View style={styles.row}>
      <MenuButton />
      <View style={{ flex: 1 }}>
        <Text variant="subtitle" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('home.tabProfile')} scaleTo={0.9} onPress={() => router.push('/profile')}>
        <Avatar name={account?.name ?? '?'} photo={photo} size={40} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xs },
});
