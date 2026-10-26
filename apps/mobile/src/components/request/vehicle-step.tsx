import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { WhenPicker } from '@/components/request/when-picker';
import { Text } from '@/components/text';
import { VEHICLE_GROUPS, VEHICLE_SPACE, vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { estimatePrice, maxTons, suggestVehicle, suitableVehicles } from '@/lib/pricing';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Radius, rim, Spacing, useColors } from '@/theme';

/**
 * Vehicles that can carry the load, in four size groups. Each card says what it
 * typically carries ("a fridge and a few boxes") and its cargo space in metres, so
 * nobody has to think in tonnes.
 */
export function VehicleStep({ showWhen = true }: { showWhen?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl, language } = useLanguage();
  const { draft, update } = useRequestDraft();
  const { km } = tripEstimate(draft);
  const recommended = suggestVehicle(draft.tons, draft.freightType === 'food');
  const suitable = new Set(suitableVehicles(draft.tons));
  const decimal = (n: number) => (language === 'fr' ? String(n).replace('.', ',') : String(n));

  return (
    <>
      <Text variant="title">{t('request.vehicleTitle')}</Text>

      {VEHICLE_GROUPS.map((group) => {
        const vehicles = group.vehicles.filter((vehicle) => suitable.has(vehicle));
        if (!vehicles.length) return null;
        return (
          <View key={group.id} style={{ gap: Spacing.sm }}>
            <Text variant="caption" muted style={styles.group}>
              {t(`vehicleGroup.${group.id}`)}
            </Text>
            {vehicles.map((vehicle) => {
              const selected = draft.vehicle === vehicle;
              const estimate = estimatePrice(vehicle, km, draft.helpers);
              const [l, w, h] = VEHICLE_SPACE[vehicle];
              return (
                <PressableScale
                  key={vehicle}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  feedback="selection"
                  scaleTo={0.98}
                  onPress={() => update({ vehicle, vehicleChosen: true, priceChosen: false })}
                  style={[
                    styles.vehicle,
                    { backgroundColor: selected ? colors.primarySoft : colors.surface },
                    rim(colors),
                    selected && { borderColor: colors.primary, borderWidth: 2 },
                  ]}>
                  <View style={styles.top}>
                    <View style={[styles.photo, { backgroundColor: selected ? colors.surface : colors.surfaceMuted }]}>
                      <Image
                        source={vehicleImage(vehicle)}
                        style={[styles.photoImage, rtl && { transform: [{ scaleX: -1 }] }]}
                        contentFit="contain"
                        accessibilityIgnoresInvertColors
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.nameRow}>
                        <Text variant="label">{t(`vehicle.${vehicle}`)}</Text>
                        {vehicle === recommended && (
                          <View style={[styles.badge, { backgroundColor: colors.successFill }]}>
                            <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 11, lineHeight: 16 }}>
                              {t('request.recommended')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text variant="caption" muted>
                        {t('request.upTo', { tons: decimal(maxTons(vehicle)) })}
                      </Text>
                    </View>
                    <Text variant="label" color={selected ? colors.primary : colors.text}>
                      ≈ {formatMoney(t, estimate.suggested)}
                    </Text>
                  </View>
                  <Text variant="caption">{t(`vehicleFits.${vehicle}`)}</Text>
                  <View style={[styles.size, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name="cube-scan" size={16} color={colors.primary} />
                    <Text variant="caption" style={{ writingDirection: 'ltr' }}>
                      {t('request.cargoSpace', { l: decimal(l), w: decimal(w), h: decimal(h) })}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        );
      })}

      {showWhen && (
        <>
          <Text variant="subtitle">{t('request.when')}</Text>
          <WhenPicker when={draft.when} window={draft.pickupWindow} scheduledAt={draft.scheduledAt} onChange={update} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.xs },
  vehicle: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  photo: { width: 104, height: 66, borderRadius: Radius.md, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  badge: { paddingHorizontal: Spacing.sm, borderRadius: Radius.pill },
  size: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
});
