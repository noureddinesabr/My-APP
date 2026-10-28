import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CityPicker, useCityName } from '@/components/city-picker';
import { PhotoTile } from '@/components/driver/photo-tile';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { DEFAULT_CITY } from '@/constants/cities';
import { VEHICLE_TYPES } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { maxTons, type VehicleId } from '@/lib/pricing';
import { pickPhoto } from '@/lib/pick-photo';
import { useDriver } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

/** Most common vehicle among drivers: pre-selected. */
const DEFAULT_VEHICLE: VehicleId = 'truck35';

export default function DriverVehicle() {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const { rtl } = useLanguage();
  const { profile, update } = useDriver();
  const [type, setType] = useState<VehicleId>(profile.vehicle?.type ?? DEFAULT_VEHICLE);
  const [plate, setPlate] = useState(profile.vehicle?.plate ?? '');
  const [homeCity, setHomeCity] = useState(profile.vehicle?.homeCity ?? DEFAULT_CITY);
  const [photo, setPhoto] = useState(profile.vehicle?.photo);
  const [pickingCity, setPickingCity] = useState(false);
  const plateValid = plate.trim().length >= 4;

  const save = () => {
    update({ vehicle: { type, plate: plate.trim(), homeCity, photo } });
    router.back();
  };

  return (
    <Screen
      footer={<Button title={t('driver.saveVehicle')} disabled={!plateValid} onPress={save} />}
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="title">{t('driver.vehicleTitle')}</Text>
        </View>
      }>
      <Text variant="label">{t('driver.vehicleType')}</Text>
      <View style={styles.grid}>
        {VEHICLE_TYPES.map((vehicle) => {
          const selected = vehicle.id === type;
          return (
            <Pressable
              key={vehicle.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setType(vehicle.id)}
              style={[
                styles.vehicle,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}>
              <MaterialCommunityIcons
                name={vehicle.icon}
                size={28}
                color={selected ? colors.primary : colors.textMuted}
                style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
              />
              <Text variant="caption" center>
                {t(`vehicle.${vehicle.id}`)}
              </Text>
              <Text variant="caption" center muted style={{ fontSize: 13, lineHeight: 18 }}>
                {t('request.upTo', { tons: maxTons(vehicle.id) })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <Text variant="label">{t('driver.plate')}</Text>
        <TextInput
          value={plate}
          onChangeText={setPlate}
          placeholder={t('driver.platePlaceholder')}
          autoCapitalize="characters"
          style={{ writingDirection: 'ltr' }}
        />
        <Text variant="label">{t('driver.homeCity')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickingCity(true)}
          style={[styles.city, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text variant="label" style={{ flex: 1 }}>
            {cityName(homeCity)}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </Card>

      <Card>
        <Text variant="label">{t('driver.vehiclePhoto')}</Text>
        <PhotoTile uri={photo} onPick={async () => setPhoto((await pickPhoto()) ?? photo)} />
      </Card>

      <CityPicker
        visible={pickingCity}
        title={t('driver.homeCity')}
        selected={homeCity}
        onSelect={setHomeCity}
        onClose={() => setPickingCity(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  vehicle: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  city: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
});
