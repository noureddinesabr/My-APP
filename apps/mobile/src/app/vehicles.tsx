import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CityPicker, useCityName } from '@/components/city-picker';
import { FilterChips, FormField, InfoRow, PageHeader, PrototypeNote, SectionHeader, SelectField, StatusBadge } from '@/components/ds';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import type { CityId } from '@/constants/cities';
import { CLIENT_VEHICLES, vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import type { VehicleId } from '@/lib/pricing';
import { useDriver, type DriverVehicle } from '@/state/driver';
import { Spacing } from '@/theme';

/** Moroccan plates read like "12345-A-6" (number, Arabic letter written in Latin, region). */
const PLATE = /^\d{1,6}-[A-Z]{1,2}-\d{1,2}$/i;

/**
 * Vehicle management (Doc 5 D42): every vehicle the driver uses, with its picture, what it
 * carries and its verification; add another one with a validated plate. Documents and their
 * expiry dates live on the documents page.
 */
export default function Vehicles() {
  const { t } = useTranslation();
  const cityName = useCityName();
  const { rtl } = useLanguage();
  const { profile, update } = useDriver();
  const vehicles: DriverVehicle[] = [...(profile.vehicle ? [profile.vehicle] : []), ...(profile.moreVehicles ?? [])];
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<VehicleId>('pickup');
  const [plate, setPlate] = useState('');
  const [city, setCity] = useState<CityId>('casablanca');
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);
  const plateError = !PLATE.test(plate.trim()) ? t('vehicles.errPlate') : vehicles.some((v) => v.plate.toUpperCase() === plate.trim().toUpperCase()) ? t('vehicles.errDuplicate') : null;

  return (
    <Screen header={<PageHeader title={t('dprofile.vehicles')} onBack={() => router.back()} right={!adding ? <Button compact variant="accent" icon="add" title={t('vehicles.add')} onPress={() => setAdding(true)} /> : undefined} />}>
      {vehicles.length === 0 && !adding && (
        <Card>
          <Text muted>{t('vehicles.none')}</Text>
          <Button variant="primary" title={t('driver.ctaVehicle')} onPress={() => router.push('/driver-vehicle')} />
        </Card>
      )}
      {vehicles.map((vehicle, i) => (
        <Card key={`${vehicle.plate}-${i}`}>
          <View style={styles.row}>
            <Image source={vehicleImage(vehicle.type)} style={[styles.image, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{t(`vehicle.${vehicle.type}`)}</Text>
              <Text variant="caption" muted>
                {vehicle.plate} · {cityName(vehicle.homeCity)}
              </Text>
              <StatusBadge status={i === 0 && profile.status === 'approved' ? 'verified' : 'pending'} label={i === 0 && profile.status === 'approved' ? t('dprofile.ver_verified') : t('vehicles.awaiting')} />
            </View>
          </View>
          <InfoRow label={t('vehicles.carries')} value={t(`payload.${vehicle.type}`)} />
          {i === 0 && <Button compact variant="outline" title={t('vehicles.edit')} onPress={() => router.push('/driver-vehicle')} />}
          {i > 0 && <Button compact variant="ghost" icon="trash-outline" title={t('vehicles.remove')} onPress={() => update({ moreVehicles: (profile.moreVehicles ?? []).filter((_, j) => j !== i - 1) })} />}
        </Card>
      ))}
      {adding && (
        <Card>
          <SectionHeader title={t('vehicles.add')} />
          <FilterChips value={type} onChange={(v) => setType(v as VehicleId)} options={CLIENT_VEHICLES.map((id) => ({ value: id, label: t(`vehicle.${id}`) }))} />
          <FormField label={t('vehicles.plate')} placeholder="12345-A-6" value={plate} onChangeText={setPlate} required error={tried ? plateError : null} />
          <SelectField label={t('vehicles.city')} value={cityName(city)} icon="map-marker-outline" onPress={() => setPicking(true)} />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button compact variant="ghost" title={t('common.cancel')} onPress={() => setAdding(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                compact
                variant="accent"
                title={t('common.save')}
                onPress={() => {
                  setTried(true);
                  if (plateError) return;
                  update({ moreVehicles: [...(profile.moreVehicles ?? []), { type, plate: plate.trim().toUpperCase(), homeCity: city }] });
                  setAdding(false);
                  setPlate('');
                  setTried(false);
                }}
              />
            </View>
          </View>
        </Card>
      )}
      <PrototypeNote text={t('vehicles.prototype')} />
      <CityPicker visible={picking} title={t('vehicles.city')} selected={city} onSelect={setCity} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  image: { width: 96, height: 60 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
