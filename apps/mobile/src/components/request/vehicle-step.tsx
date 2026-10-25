import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney } from '@/components/money';
import { WhenPicker } from '@/components/request/when-picker';
import { Text } from '@/components/text';
import { vehicleIcon } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { estimatePrice, maxTons, suggestVehicle, suitableVehicles } from '@/lib/pricing';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

export function VehicleStep() {
  const { t } = useTranslation();
  const colors = useColors();
  const { rtl } = useLanguage();
  const { draft, update } = useRequestDraft();
  const { km } = tripEstimate(draft);
  const recommended = suggestVehicle(draft.tons, draft.freightType === 'food');

  return (
    <>
      <Text variant="title">{t('request.vehicleTitle')}</Text>

      {suitableVehicles(draft.tons).map((vehicle) => {
        const selected = draft.vehicle === vehicle;
        const estimate = estimatePrice(vehicle, km, draft.helpers);
        return (
          <Pressable
            key={vehicle}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => update({ vehicle, vehicleChosen: true, priceChosen: false })}
            style={[
              styles.vehicle,
              {
                backgroundColor: selected ? colors.primarySoft : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}>
            <View style={[styles.icon, { backgroundColor: selected ? colors.primary : colors.surfaceMuted }]}>
              <MaterialCommunityIcons
                name={vehicleIcon(vehicle)}
                size={28}
                color={selected ? colors.onPrimary : colors.primary}
                style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.nameRow}>
                <Text variant="label">{t(`vehicle.${vehicle}`)}</Text>
                {vehicle === recommended && (
                  <View style={[styles.badge, { backgroundColor: colors.success }]}>
                    <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 11, lineHeight: 16 }}>
                      {t('request.recommended')}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="caption" muted>
                {t('request.upTo', { tons: maxTons(vehicle) })}
              </Text>
            </View>
            <Text variant="label" color={selected ? colors.primary : colors.text}>
              ≈ {formatMoney(t, estimate.suggested)}
            </Text>
          </Pressable>
        );
      })}

      <Text variant="subtitle">{t('request.when')}</Text>
      <WhenPicker when={draft.when} scheduledAt={draft.scheduledAt} onChange={update} />
    </>
  );
}

const styles = StyleSheet.create({
  vehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  icon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  badge: { paddingHorizontal: Spacing.sm, borderRadius: Radius.pill },
});
