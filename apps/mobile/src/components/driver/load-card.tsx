import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FreightRequest } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { formatWeight } from '@/components/request/load-step';
import { Text } from '@/components/text';
import { isExample } from '@/constants/sample-loads';
import { vehicleIcon } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { commissionSplit } from '@/lib/pricing';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

export function LoadCard({ load, fits, offered }: { load: FreightRequest; fits: boolean; offered: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { rtl } = useLanguage();
  const { driverKeeps } = commissionSplit(load.price);
  const example = isExample(load.id);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/load/[id]', params: { id: load.id } })}
      style={[
        styles.card,
        { backgroundColor: colors.surface, opacity: fits ? 1 : 0.6 },
        !example && { borderWidth: 1.5, borderColor: colors.primary },
        softShadow(colors.shadow, 0.6),
      ]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons
            name={vehicleIcon(load.vehicle)}
            size={24}
            color={colors.primary}
            style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {names.cityRoute(load.from, load.to)}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {t(`freight.${load.freightType}`)} · {formatWeight(t, load.tons)} · {t('request.distance', { km: load.km })}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: example ? colors.accentSoft : colors.successSoft }]}>
          <Text variant="caption" color={example ? colors.accent : colors.success} style={styles.badgeText}>
            {example ? t('driver.example') : t('driver.live')}
          </Text>
        </View>
      </View>

      <View style={[styles.bottom, { borderTopColor: colors.border }]}>
        <View style={styles.when}>
          <Ionicons name={load.scheduledAt ? 'calendar-outline' : 'flash-outline'} size={16} color={colors.textMuted} />
          <Text variant="caption" muted>
            {load.scheduledAt ? dates.pickupAt(load.scheduledAt) : t('request.whenAsap')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="subtitle" color={colors.primary}>
            {formatMoney(t, load.price)}
          </Text>
          <Text variant="caption" color={offered ? colors.success : fits ? colors.textMuted : colors.accent}>
            {offered
              ? `✓ ${t('driver.offerSent')}`
              : fits
                ? t('driver.youKeep', { amount: formatMoney(t, driverKeeps) })
                : t('driver.tooHeavy')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: Spacing.sm, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, lineHeight: 18 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  when: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
});
