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
import { kindsOf } from '@/constants/freight';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PulseDot } from '@/components/motion/effects';
import { Text } from '@/components/text';
import { isExample } from '@/constants/sample-loads';
import { vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { Radius, rim, Spacing, useColors } from '@/theme';

export function LoadCard({ load, fits, offered, otherVehicle }: { load: FreightRequest; fits: boolean; offered: boolean; otherVehicle?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { rtl } = useLanguage();
  const example = isExample(load.id);

  const when = load.scheduledAt ? dates.pickupAt(load.scheduledAt) : load.pickupWindow === '1h' ? t('request.whenHour') : t('quest.whenNow');
  const photos = load.media?.length ?? 0;

  // Three things only: where, how much, and what / when. Everything else is one tap away.
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/load/[id]', params: { id: load.id } })}
      style={[
        styles.card,
        { backgroundColor: colors.surface, opacity: fits ? 1 : 0.6 },
        rim(colors),
        offered && { borderColor: colors.success, borderWidth: 1.5 },
      ]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <Image source={vehicleImage(load.vehicle)} style={[styles.vehicle, rtl && { transform: [{ scaleX: -1 }] }]} contentFit="contain" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subtitle">
            {names.shortRoute(load.from, load.to)}
          </Text>
          <Text variant="caption" muted>
            {kindsOf(load).map((kind) => t(`freight.${kind}`)).join(t('common.listSep'))} · {formatWeight(t, load.tons, load.weightKnown !== false)} · {when}
          </Text>
        </View>
        <View style={styles.price}>
          <Text variant="title" color={colors.primary}>
            {formatMoney(t, load.price)}
          </Text>
          {example ? (
            <Text variant="caption" color={colors.accent}>
              {t('driver.example')}
            </Text>
          ) : offered ? (
            <Text variant="caption" color={colors.success}>
              ✓ {t('driver.offerSent')}
            </Text>
          ) : (
            <View style={styles.extras}>
              {!!load.voiceNote && <Ionicons name="mic" size={16} color={colors.primary} accessibilityLabel={t('media.hasVoice')} />}
              {photos > 0 && <Ionicons name="images" size={16} color={colors.primary} accessibilityLabel={t('media.clientMedia', { count: photos })} />}
              <PulseDot color={colors.success} size={8} />
            </View>
          )}
        </View>
      </View>
      {!fits ? (
        <Text variant="caption" color={colors.accent}>
          {t('driver.tooHeavy')}
        </Text>
      ) : otherVehicle ? (
        // The client's vehicle is a preference: a driver going that way with another vehicle can offer too.
        <Text variant="caption" color={colors.success}>
          {t('driver.anyVehicleOk', { vehicle: t(`vehicle.${load.vehicle}`) })}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 64, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  vehicle: { width: 60, height: 40 },
  price: { alignItems: 'flex-end', gap: 2 },
  extras: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
