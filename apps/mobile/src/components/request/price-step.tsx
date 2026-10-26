import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { currencyUnit, formatMoney } from '@/components/money';
import { describePlace, ITEM_OPTIONS } from '@/components/request/access-options';
import { formatWeight } from '@/components/request/load-step';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { Card, Gradient } from '@/components/ui';
import { vehicleIcon } from '@/constants/vehicles';
import { estimateDurationMinutes } from '@/lib/pricing';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

const PRICE_STEP = 10;
const MAX_PRICE = 200_000;

/** Final step: value preview (estimate) shown before any sign-up, then the client's own price. */
export function PriceStep() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const { km, price } = tripEstimate(draft);
  const minutes = estimateDurationMinutes(km);
  const duration =
    minutes >= 60
      ? t('request.hours', { h: Math.floor(minutes / 60), m: minutes % 60 })
      : t('request.minutes', { m: minutes });

  const position = draft.price < price.low ? 'low' : draft.price > price.high ? 'high' : 'in';
  const positionStyles: Record<
    typeof position,
    { color: string; background: string; icon: ComponentProps<typeof Ionicons>['name'] }
  > = {
    low: { color: colors.accent, background: colors.accentSoft, icon: 'alert-circle-outline' },
    in: { color: colors.success, background: colors.successSoft, icon: 'checkmark-circle-outline' },
    high: { color: colors.primary, background: colors.primarySoft, icon: 'flash-outline' },
  };
  const positionStyle = positionStyles[position];

  return (
    <>
      <Text variant="title">{t('request.priceTitle')}</Text>

      <Gradient colors={Gradients.primary} style={styles.preview}>
        <View style={styles.previewTop}>
          <View style={styles.estimateBadge}>
            <Text variant="caption" color={colors.onPrimary}>
              {t('request.estimateLabel')}
            </Text>
          </View>
          <MaterialCommunityIcons name={vehicleIcon(draft.vehicle)} size={30} color={colors.onPrimary} />
        </View>
        <Text variant="hero" color={colors.onPrimary}>
          {formatMoney(t, price.suggested)}
        </Text>
        <Text color={colors.onPrimary} style={{ opacity: 0.9 }}>
          {t('request.typicalRange', { low: price.low.toLocaleString('fr-FR'), high: price.high.toLocaleString('fr-FR') })}
        </Text>
        <View style={styles.metrics}>
          <Metric icon="navigate-outline" label={t('request.distance', { km })} />
          <Metric icon="time-outline" label={t('request.duration', { time: duration })} />
          <Metric icon="cube-outline" label={formatWeight(t, draft.tons)} />
        </View>
      </Gradient>
      <Text variant="caption" muted>
        {t('request.estimateNote')}
      </Text>

      <Card>
        <Text variant="label">{t('request.yourPrice')}</Text>
        <Stepper
          value={draft.price}
          step={PRICE_STEP}
          min={PRICE_STEP}
          max={MAX_PRICE}
          onChange={(value) => update({ price: value, priceChosen: true })}
          format={(value) => formatMoney(t, value)}
          editable
          unit={currencyUnit(t)}
        />
        <View style={[styles.position, { backgroundColor: positionStyle.background }]}>
          <Ionicons name={positionStyle.icon} size={18} color={positionStyle.color} />
          <Text variant="caption" color={positionStyle.color} style={{ flex: 1 }}>
            {t(position === 'low' ? 'request.priceLow' : position === 'high' ? 'request.priceHigh' : 'request.priceInRange')}
          </Text>
        </View>
      </Card>

      <Card>
        <Text variant="label">{t('request.summary')}</Text>
        <SummaryRow
          icon="location-outline"
          value={names.route(draft.from, draft.to)}
        />
        <SummaryRow icon="cube-outline" value={`${t(`freight.${draft.freightType}`)} · ${formatWeight(t, draft.tons)}`} />
        <SummaryRow icon="car-outline" value={t(`vehicle.${draft.vehicle}`)} />
        {draft.helpers > 0 && (
          <SummaryRow icon="people-outline" value={`${t('request.helpers')}: ${draft.helpers}`} />
        )}
        <SummaryRow
          icon="calendar-outline"
          value={draft.when === 'now' ? t('request.whenAsap') : dates.pickupAt(draft.scheduledAt)}
        />
        <SummaryRow icon="arrow-up-circle-outline" value={`${t('request.atPickup')}: ${describePlace(t, draft.pickup)}`} />
        <SummaryRow icon="arrow-down-circle-outline" value={`${t('request.atDropoff')}: ${describePlace(t, draft.dropoff)}`} />
        {draft.itemOptions.length > 0 && (
          <SummaryRow
            icon="information-circle-outline"
            value={ITEM_OPTIONS.filter((option) => draft.itemOptions.includes(option.id))
              .map((option) => t(option.key))
              .join(' · ')}
          />
        )}
        {!!draft.notes.trim() && <SummaryRow icon="create-outline" value={draft.notes.trim()} />}
        {(!!draft.voiceNote || draft.media.length > 0) && (
          <SummaryRow
            icon="attach-outline"
            value={[draft.voiceNote ? t('media.hasVoice') : '', draft.media.length ? t('media.clientMedia', { count: draft.media.length }) : '']
              .filter(Boolean)
              .join(' · ')}
          />
        )}
      </Card>
    </>
  );
}

function Metric({ icon, label }: { icon: ComponentProps<typeof Ionicons>['name']; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color={colors.onPrimary} />
      <Text variant="caption" color={colors.onPrimary}>
        {label}
      </Text>
    </View>
  );
}

function SummaryRow({ icon, value }: { icon: ComponentProps<typeof Ionicons>['name']; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.xs },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estimateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  position: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
