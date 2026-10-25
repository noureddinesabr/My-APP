import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HomeHeader } from '@/components/home-header';
import { Text } from '@/components/text';
import { Card, Screen } from '@/components/ui';
import { Spacing, useColors } from '@/theme';

export default function CompanyHome() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Screen>
      <HomeHeader title={t('company.greeting')} />
      <Card>
        <View style={styles.row}>
          <MaterialCommunityIcons name="truck-cargo-container" size={28} color={colors.primary} />
          <Text variant="subtitle" style={{ flex: 1 }}>
            {t('company.fleetTitle')}
          </Text>
        </View>
        <Text muted>{t('company.fleetBody')}</Text>
        <Text variant="caption" color={colors.accent}>
          {t('common.comingSoon')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
