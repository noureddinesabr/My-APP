import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { FreightRequest } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { formatWeight } from '@/components/request/format';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { isExample } from '@/constants/sample-loads';
import { vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { commissionSplit } from '@/lib/pricing';
import { Radius, rim, Spacing, useColors } from '@/theme';

export function LoadCard({ load, fits, offered }: { load: FreightRequest; fits: boolean; offered: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { rtl } = useLanguage();
  const { driverKeeps } = commissionSplit(load.price);
  const example = isExample(load.id);

  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/load/[id]', params: { id: load.id } })}
      style={[
        styles.card,
        { backgroundColor: colors.surface, opacity: fits ? 1 : 0.6 },
        rim(colors),
        !example && { borderWidth: 1.5, borderColor: colors.primary },
      ]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <Image source={vehicleImage(load.vehicle)} style={[styles.vehicle, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
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
          {!!load.voiceNote && <Ionicons name="mic" size={15} color={colors.primary} accessibilityLabel={t('media.hasVoice')} />}
          {(load.media?.length ?? 0) > 0 && (
            <View style={styles.when} accessibilityLabel={t('media.clientMedia', { count: load.media?.length ?? 0 })}>
              <Ionicons name="images" size={15} color={colors.primary} />
              <Text variant="caption" color={colors.primary}>
                {load.media?.length}
              </Text>
            </View>
          )}
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 64, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  vehicle: { width: 60, height: 38 },
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
