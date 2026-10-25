import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCityName } from '@/components/city-picker';
import { useDateFormat } from '@/components/date-format';
import { loadDistanceKm } from '@/components/driver/load-card';
import { formatMoney } from '@/components/money';
import { describePlace, ITEM_OPTIONS } from '@/components/request/access-options';
import { formatWeight } from '@/components/request/load-step';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { Button, Card, Chip, ForwardChevron, Gradient, IconButton, Screen } from '@/components/ui';
import { sampleLoads } from '@/constants/sample-loads';
import { vehicleIcon } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { COMMISSION_RATE, commissionSplit, maxTons } from '@/lib/pricing';
import { useDriver, type Eta } from '@/state/driver';
import { Gradients, Radius, Spacing, useColors } from '@/theme';

const PRICE_STEP = 10;

export default function LoadDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const dates = useDateFormat();
  const { rtl } = useLanguage();
  const { profile, setOffer } = useDriver();
  const load = useMemo(() => sampleLoads().find((item) => item.id === id), [id]);
  const sent = load ? profile.offers[load.id] : undefined;
  const [price, setPrice] = useState(sent?.price ?? load?.clientPrice ?? 0);
  const [eta, setEta] = useState<Eta>(sent?.eta ?? (load?.scheduledAt ? 'scheduled' : 60));
  const [editing, setEditing] = useState(!sent);

  if (!load) return <Redirect href="/driver" />;

  const approved = profile.status === 'approved';
  const fits = !profile.vehicle || load.tons <= maxTons(profile.vehicle.type);
  const { commission, driverKeeps } = commissionSplit(price);
  const etaOptions: { value: Eta; key: string }[] = load.scheduledAt
    ? [{ value: 'scheduled', key: 'driver.etaScheduled' }]
    : [
        { value: 30, key: 'driver.eta30' },
        { value: 60, key: 'driver.eta60' },
        { value: 120, key: 'driver.eta120' },
      ];

  const route =
    load.fromCity === load.toCity
      ? t('request.sameCity', { city: cityName(load.fromCity) })
      : t('request.resumeBody', { from: cityName(load.fromCity), to: cityName(load.toCity) });

  return (
    <Screen
      footer={
        approved && editing && fits ? (
          <Button
            title={t('driver.sendOffer', { price: formatMoney(t, price) })}
            variant="accent"
            icon="paper-plane-outline"
            onPress={() => {
              setOffer(load.id, { price, eta });
              setEditing(false);
            }}
          />
        ) : undefined
      }>
      <View style={styles.header}>
        <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
        <Text variant="subtitle" style={{ flex: 1 }}>
          {t('driver.loadTitle')}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
          <Text variant="caption" color={colors.accent}>
            {t('driver.example')}
          </Text>
        </View>
      </View>

      <Gradient colors={Gradients.primary} style={styles.hero}>
        <View style={styles.heroTop}>
          <MaterialCommunityIcons
            name={vehicleIcon(load.vehicle)}
            size={30}
            color={colors.onPrimary}
            style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
          />
          <Text variant="caption" color={colors.onPrimary}>
            {t('request.distance', { km: loadDistanceKm(load) })}
          </Text>
        </View>
        <Text variant="title" color={colors.onPrimary}>
          {route}
        </Text>
        <Text variant="caption" color={colors.onPrimary} style={{ opacity: 0.9 }}>
          {t('driver.clientOffers')}
        </Text>
        <Text variant="hero" color={colors.onPrimary}>
          {formatMoney(t, load.clientPrice)}
        </Text>
      </Gradient>

      <Card>
        <Text variant="label">{t('driver.details')}</Text>
        <Detail icon="cube-outline" value={`${t(`freight.${load.freightType}`)} · ${formatWeight(t, load.tons)}`} />
        <Detail icon="car-outline" value={t(`vehicle.${load.vehicle}`)} />
        <Detail
          icon={load.scheduledAt ? 'calendar-outline' : 'flash-outline'}
          value={load.scheduledAt ? dates.pickupAt(load.scheduledAt) : t('request.whenAsap')}
        />
        <Detail icon="arrow-up-circle-outline" value={`${t('request.atPickup')}: ${describePlace(t, load.pickup)}`} />
        <Detail icon="arrow-down-circle-outline" value={`${t('request.atDropoff')}: ${describePlace(t, load.dropoff)}`} />
        {load.helpers > 0 && <Detail icon="people-outline" value={t('driver.helpers', { count: load.helpers })} />}
        {load.itemOptions.length > 0 && (
          <View style={styles.tags}>
            {ITEM_OPTIONS.filter((option) => load.itemOptions.includes(option.id)).map((option) => (
              <View key={option.id} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name={option.icon} size={14} color={colors.accent} />
                <Text variant="caption" color={colors.accent}>
                  {t(option.key)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {!!load.notes && <Detail icon="chatbubble-ellipses-outline" value={load.notes} />}
      </Card>

      {!approved && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
          <View style={styles.row}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {t('driver.lockedTitle')}
            </Text>
          </View>
          <Text muted>
            {t('driver.lockedBody', {
              price: formatMoney(t, load.clientPrice),
              keep: formatMoney(t, commissionSplit(load.clientPrice).driverKeeps),
            })}
          </Text>
          <Button title={t('driver.lockedCta')} onPress={() => router.replace('/driver')} />
        </Card>
      )}

      {approved && !fits && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.accent }}>
          <View style={styles.row}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.accent} />
            <Text variant="label" color={colors.accent}>
              {t('driver.tooHeavy')}
            </Text>
          </View>
        </Card>
      )}

      {approved && fits && !editing && sent && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            <Text variant="subtitle" style={{ flex: 1 }}>
              {t('driver.sentTitle')}: {formatMoney(t, sent.price)}
            </Text>
          </View>
          <Text muted>{t('driver.sentBody')}</Text>
          <Button title={t('driver.updateOffer')} variant="ghost" onPress={() => setEditing(true)} />
          <Button
            title={t('driver.withdraw')}
            variant="ghost"
            onPress={() => {
              setOffer(load.id, null);
              setPrice(load.clientPrice);
              setEditing(true);
            }}
          />
        </Card>
      )}

      {approved && fits && editing && (
        <Card>
          <Text variant="label">{t('driver.yourOffer')}</Text>
          <Stepper
            value={price}
            step={PRICE_STEP}
            min={PRICE_STEP}
            onChange={setPrice}
            format={(value) => formatMoney(t, value)}
          />
          <View style={[styles.split, { backgroundColor: colors.successSoft }]}>
            <Text variant="caption" muted>
              {t('driver.commissionLine', {
                rate: Math.round(COMMISSION_RATE * 100),
                commission: formatMoney(t, commission),
                price: formatMoney(t, price),
              })}
            </Text>
            <Text variant="subtitle" color={colors.success}>
              {t('driver.keepLine', { amount: formatMoney(t, driverKeeps) })}
            </Text>
          </View>
          <Text variant="label">{t('driver.arrival')}</Text>
          <View style={styles.tags}>
            {etaOptions.map((option) => (
              <Chip key={option.value} label={t(option.key)} selected={eta === option.value} onPress={() => setEta(option.value)} />
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

function Detail({ icon, value }: { icon: ComponentProps<typeof Ionicons>['name']; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  split: { padding: Spacing.md, borderRadius: Radius.sm, gap: 2 },
});
