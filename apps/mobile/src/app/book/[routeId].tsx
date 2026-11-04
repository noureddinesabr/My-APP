import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDoc, useStore } from '@/backend';
import { requestBooking } from '@/backend/prototype';
import type { DriverRoute, RouteBooking } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { FilterChips, FormField, InfoRow, OptionCards, PageHeader, PriceBreakdown, PrototypeNote, StateView, StepIndicator, ToggleRow } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import { LOAD_WEIGHTS } from '@/constants/vehicles';
import { overflow, remaining } from '@/lib/sharing';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { Spacing, useColors } from '@/theme';

type Step = 'cargo' | 'sharing' | 'accompany' | 'review' | 'done';

/**
 * Booking a driver route, in short steps (Doc 2 booking flow, Doc 5 C09–C14, C18):
 * 1. the cargo (what, about how heavy, volume, items);
 * 2. dedicated: may others share the vehicle? (consent with what it means) —
 *    shared slot: the existing trip, space left and the shared terms;
 * 3. who travels with the cargo (seats are separate from cargo space);
 * 4. review with the price, cash on delivery and the terms, then an explicit confirm.
 */
export default function BookRoute() {
  const { routeId, mode: modeParam } = useLocalSearchParams<{ routeId: string; mode?: 'dedicated' | 'shared' }>();
  const { t } = useTranslation();
  const route = useDoc('routes', routeId);
  const { client } = useAccount();
  if (route === undefined) return <Screen><StateView state="loading" /></Screen>;
  if (route === null)
    return (
      <Screen header={<PageHeader title={t('book.title')} onBack={() => router.back()} />}>
        <StateView state="error" title={t('route.missing')} />
      </Screen>
    );
  if (!client)
    return (
      <Screen header={<PageHeader title={t('book.title')} onBack={() => router.back()} />}>
        <StateView state="empty" title={t('book.signIn')} body={t('book.signInBody')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'client' } })} />
      </Screen>
    );
  return <BookingFlow route={route} mode={modeParam === 'shared' ? 'shared' : 'dedicated'} customer={client} />;
}

function BookingFlow({ route, mode, customer }: { route: DriverRoute; mode: 'dedicated' | 'shared'; customer: { id: string; name: string; phone: string } }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const [step, setStep] = useState<Step>('cargo');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState<string | null>(null);
  const [volume, setVolume] = useState('');
  const [items, setItems] = useState('1');
  const [allowSharing, setAllowSharing] = useState<'yes' | 'no' | null>(null);
  const [extraStops, setExtraStops] = useState(false);
  const [sharedTerms, setSharedTerms] = useState(false);
  const [accompany, setAccompany] = useState<RouteBooking['accompaniment'] | null>('none');
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const left = remaining(route.capacity, route.reserved);
  const tons = LOAD_WEIGHTS.find((w) => w.id === weight)?.tons ?? 0;
  const volumeNumber = Number(volume.replace(',', '.'));
  const seats = accompany && accompany !== 'none' ? 1 : 0;
  const over = overflow(route.capacity, route.reserved, { tons, volumeM3: Number.isFinite(volumeNumber) ? volumeNumber : 0, seats });
  const price = mode === 'shared' ? route.sharePrice : route.price;
  const steps: Step[] = ['cargo', 'sharing', 'accompany', 'review'];
  const index = steps.indexOf(step) + 1;

  const errors = {
    description: description.trim().length < 3 ? t('book.errDescription') : null,
    weight: !weight ? t('book.errWeight') : over.includes('tons') ? t('book.errTooHeavy', { left: left.tons }) : null,
    volume: !volume.trim() ? t('book.errVolume') : !Number.isFinite(volumeNumber) || volumeNumber <= 0 ? t('book.errNumber') : over.includes('volumeM3') ? t('book.errTooBig', { left: left.volumeM3 }) : null,
    items: !/^\d+$/.test(items) || Number(items) < 1 ? t('book.errNumber') : null,
  };
  const cargoValid = !errors.description && !errors.weight && !errors.volume && !errors.items;

  const next = () => {
    setTried(true);
    if (step === 'cargo' && !cargoValid) return;
    if (step === 'sharing' && (mode === 'dedicated' ? !allowSharing : !sharedTerms)) return;
    if (step === 'accompany' && (!accompany || over.includes('seats'))) return;
    setTried(false);
    setStep(steps[index] ?? 'review');
  };

  const confirm = async () => {
    setTried(true);
    if (!terms) return;
    setBusy(true);
    try {
      const id = await requestBooking(store, customer, route, {
        from: route.from,
        to: route.to,
        cargo: { description: description.trim(), tons, volumeM3: volumeNumber, items: Number(items) },
        mode,
        allowSharing: mode === 'dedicated' && allowSharing === 'yes',
        accompaniment: accompany ?? 'none',
        extraStops,
        price,
      });
      play('send');
      setBookingId(id);
      setStep('done');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done' && bookingId)
    return (
      <Screen header={<PageHeader title={t('book.sentTitle')} />}>
        <StateView state="success" title={t('book.sentTitle')} body={mode === 'shared' ? t('book.sentShared') : t('book.sentBody')} action={t('book.open')} onAction={() => router.replace({ pathname: '/booking/[id]', params: { id: bookingId } })} />
        <PrototypeNote text={t('book.prototype')} />
      </Screen>
    );

  const back = () => (index > 1 ? setStep(steps[index - 2]) : router.back());
  const labels: Record<Exclude<Step, 'done'>, string> = {
    cargo: t('book.stepCargo'),
    sharing: mode === 'shared' ? t('book.stepJoin') : t('book.stepSharing'),
    accompany: t('book.stepAccompany'),
    review: t('book.stepReview'),
  };

  return (
    <Screen
      header={<PageHeader title={mode === 'shared' ? t('book.titleShared') : t('book.title')} subtitle={`${names.shortRoute(route.from, route.to)} · ${dates.pickupShort(route.departAt)}`} onBack={back} />}
      footer={
        step === 'review' ? (
          <Button variant="accent" icon="checkmark-done" title={t('book.confirm', { price: formatMoney(t, price) })} disabled={busy} onPress={confirm} />
        ) : (
          <Button variant="accent" title={t('quest.continue')} onPress={next} />
        )
      }>
      <StepIndicator step={index} total={steps.length} label={labels[step as Exclude<Step, 'done'>]} />

      {step === 'cargo' && (
        <>
          <FormField label={t('book.description')} placeholder={t('book.descriptionHint')} value={description} onChangeText={setDescription} required error={tried ? errors.description : null} />
          <Text variant="caption">
            {t('book.weight')} <Text variant="caption" color={colors.accent}>*</Text>
          </Text>
          <FilterChips value={weight ?? ''} onChange={setWeight} options={LOAD_WEIGHTS.map((w) => ({ value: w.id, label: t(`weight.${w.id}`) }))} />
          {tried && errors.weight && (
            <Text variant="caption" color={colors.accent}>
              {errors.weight}
            </Text>
          )}
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <FormField label={t('book.volume')} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" suffix="m³" required error={tried ? errors.volume : null} hint={t('book.volumeHint')} />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label={t('book.items')} value={items} onChangeText={setItems} keyboardType="number-pad" required error={tried ? errors.items : null} />
            </View>
          </View>
          <Text variant="caption" color={colors.teal}>
            {t('book.spaceLeft', { tons: left.tons, volume: left.volumeM3 })}
          </Text>
        </>
      )}

      {step === 'sharing' && mode === 'dedicated' && (
        <>
          <Text variant="subtitle">{t('book.shareQ')}</Text>
          <OptionCards
            value={allowSharing}
            onChange={setAllowSharing}
            options={[
              { value: 'yes', icon: 'account-multiple-outline', title: t('book.shareYes'), body: t('book.shareYesBody') },
              { value: 'no', icon: 'truck-outline', title: t('book.shareNo'), body: t('book.shareNoBody') },
            ]}
          />
          {allowSharing === 'yes' && (
            <Card>
              <Text variant="label">{t('book.shareMeans')}</Text>
              {(['goods', 'stops', 'time', 'price'] as const).map((key) => (
                <View key={key} style={styles.point}>
                  <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
                  <Text variant="caption" style={{ flex: 1 }}>
                    {t(`book.share_${key}`)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
          {tried && !allowSharing && (
            <Text variant="caption" color={colors.accent}>
              {t('book.errChoose')}
            </Text>
          )}
        </>
      )}

      {step === 'sharing' && mode === 'shared' && (
        <>
          <Card>
            <Text variant="label">{t('book.existingTrip')}</Text>
            <InfoRow label={t('route.departure')} value={dates.pickupShort(route.departAt)} />
            <InfoRow label={t('book.spaceLeftShort')} value={`${left.tons} t · ${left.volumeM3} m³`} />
            <InfoRow label={t('book.seatsLeft')} value={String(left.seats)} />
            <InfoRow label={t('route.priceShared')} value={formatMoney(t, route.sharePrice)} strong />
          </Card>
          <ToggleRow icon="map-marker-plus-outline" label={t('book.offRoute')} hint={t('book.offRouteHint')} value={extraStops} onChange={setExtraStops} />
          <ToggleRow icon="file-document-check-outline" label={t('book.sharedTerms')} hint={t('book.sharedTermsHint')} value={sharedTerms} onChange={setSharedTerms} />
          {tried && !sharedTerms && (
            <Text variant="caption" color={colors.accent}>
              {t('book.errTerms')}
            </Text>
          )}
        </>
      )}

      {step === 'accompany' && (
        <>
          <Text variant="subtitle">{t('book.accompanyQ')}</Text>
          <OptionCards
            value={accompany}
            onChange={setAccompany}
            options={[
              { value: 'none', icon: 'package-variant-closed', title: t('accompany.none'), body: t('accompany.noneBody') },
              { value: 'me', icon: 'seat-passenger', title: t('accompany.me'), body: left.seats > 0 ? t('accompany.seatOk') : t('accompany.noSeat') },
              { value: 'someone', icon: 'account-arrow-right-outline', title: t('accompany.someone'), body: left.seats > 0 ? t('accompany.seatOk') : t('accompany.noSeat') },
            ]}
          />
          {over.includes('seats') && (
            <Text variant="caption" color={colors.accent}>
              {t('accompany.noSeat')}
            </Text>
          )}
        </>
      )}

      {step === 'review' && (
        <>
          <Card>
            <InfoRow label={t('book.route')} value={names.shortRoute(route.from, route.to)} />
            <InfoRow label={t('route.departure')} value={dates.pickupShort(route.departAt)} />
            <InfoRow label={t('route.driver')} value={route.driverName} />
            <InfoRow label={t('route.vehicle')} value={t(`vehicle.${route.vehicle}`)} />
            <InfoRow label={t('book.cargo')} value={`${description} · ${t(`weight.${weight}`)} · ${volume} m³`} />
            <InfoRow label={t('book.modeLabel')} value={mode === 'shared' ? t('book.modeShared') : allowSharing === 'yes' ? t('book.modeDedicatedSharing') : t('book.modeDedicated')} />
            <InfoRow label={t('book.accompanyLabel')} value={t(`accompany.${accompany ?? 'none'}`)} />
          </Card>
          <PriceBreakdown
            lines={[{ label: mode === 'shared' ? t('route.priceShared') : t('route.priceWhole'), amount: price }]}
            total={price}
            totalLabel={t('book.youPay')}
            note={mode === 'dedicated' && allowSharing === 'yes' ? t('book.discountNote') : undefined}
          />
          <Card>
            <View style={styles.point}>
              <MaterialCommunityIcons name="cash" size={20} color={colors.success} />
              <Text variant="label" style={{ flex: 1 }}>
                {t('book.cash')}
              </Text>
            </View>
            <Text variant="caption" muted>
              {t('book.cancelPolicy')}
            </Text>
          </Card>
          <ToggleRow icon="file-document-check-outline" label={t('book.acceptTerms')} value={terms} onChange={setTerms} />
          {tried && !terms && (
            <Text variant="caption" color={colors.accent}>
              {t('book.errTerms')}
            </Text>
          )}
          <PrototypeNote text={t('book.prototype')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: Spacing.sm },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
});
