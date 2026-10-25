import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HomeHeader } from '@/components/home-header';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/theme';

export default function DriverHome() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Screen>
      <HomeHeader title={t('driver.greeting')} />

      <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.accent} />
          <Text variant="subtitle" style={{ flex: 1 }}>
            {t('driver.verifyTitle')}
          </Text>
        </View>
        <Text>{t('driver.verifyBody')}</Text>
        <Button title={t('driver.verifyAction')} variant="accent" icon="document-text-outline" />
      </Card>

      <Card>
        <View style={styles.row}>
          <MaterialCommunityIcons name="routes" size={26} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {t('driver.returnTrip')}
          </Text>
        </View>
        <Text muted>{t('driver.returnTripHint')}</Text>
      </Card>

      <Text variant="subtitle">{t('driver.requestsTitle')}</Text>
      <Card style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="package-variant" size={36} color={colors.primary} />
        </View>
        <Text muted center>
          {t('driver.noRequests')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { width: 72, height: 72, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
