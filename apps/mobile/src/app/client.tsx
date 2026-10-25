import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HomeHeader } from '@/components/home-header';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import { VEHICLE_TYPES } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { Radius, Spacing, useColors } from '@/theme';

function comingSoon(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

export default function ClientHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl } = useLanguage();
  // Vehicles should drive in the reading direction.
  const flip = rtl ? { transform: [{ scaleX: -1 }] } : undefined;

  return (
    <Screen>
      <HomeHeader title={t('client.greeting')} subtitle={t('client.whereTo')} />

      <Card>
        <RouteField
          dotColor={colors.primary}
          label={t('client.from')}
          placeholder={t('client.fromPlaceholder')}
          onPress={() => comingSoon(t('common.comingSoon'))}
        />
        <View style={styles.routeLineRow}>
          <View style={[styles.routeLine, { borderColor: colors.border }]} />
        </View>
        <RouteField
          dotColor={colors.accent}
          label={t('client.to')}
          placeholder={t('client.toPlaceholder')}
          onPress={() => comingSoon(t('common.comingSoon'))}
        />
        <Button
          title={t('client.postRequest')}
          icon="add-circle-outline"
          variant="accent"
          onPress={() => comingSoon(t('common.comingSoon'))}
        />
      </Card>

      <Text variant="subtitle">{t('client.vehicles')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicles}>
        {VEHICLE_TYPES.map((vehicle) => (
          <View
            key={vehicle.id}
            style={[styles.vehicle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.vehicleIcon, { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons name={vehicle.icon} size={30} color={colors.primary} style={flip} />
            </View>
            <Text variant="caption" center numberOfLines={2}>
              {t(`vehicle.${vehicle.id}` as 'vehicle.truck7')}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text variant="subtitle">{t('client.howItWorks')}</Text>
      <Card>
        {(['client.step1', 'client.step2', 'client.step3'] as const).map((key, index) => (
          <View key={key} style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text variant="label" color={colors.onPrimary}>
                {index + 1}
              </Text>
            </View>
            <Text style={{ flex: 1 }}>{t(key)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function RouteField({
  dotColor,
  label,
  placeholder,
  onPress,
}: {
  dotColor: string;
  label: string;
  placeholder: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.field, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.dot, { borderColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="label">{placeholder}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
  routeLineRow: { flexDirection: 'row', paddingHorizontal: Spacing.md + 6, marginVertical: -8 },
  routeLine: { height: 14, borderLeftWidth: 2, borderStyle: 'dashed' },
  vehicles: { gap: Spacing.md, paddingEnd: Spacing.lg },
  vehicle: {
    width: 104,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vehicleIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
