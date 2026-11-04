import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDoc, useStore } from '@/backend';
import { defaultCapacity, publishRoute } from '@/backend/prototype';
import type { DriverRoute } from '@/backend/types';
import { CityPicker, useCityName } from '@/components/city-picker';
import { useDateFormat } from '@/components/date-format';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { FilterChips, FormField, InfoRow, OptionCards, PageHeader, PrototypeNote, SelectField, StateView, StepIndicator } from '@/components/ds';
import { FreightMap } from '@/components/map/freight-map';
import { formatMoney } from '@/components/money';
import { TimeWheels } from '@/components/request/time-wheels';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Button, Card, Screen } from '@/components/ui';
import type { CityId } from '@/constants/cities';
import { locationFromCity } from '@/constants/places';
import { roadKm } from '@/lib/geo';
import { estimateDurationMinutes, estimatePrice, maxTons, type VehicleId } from '@/lib/pricing';
import { ensureBookable, fromLocalString, toLocalString } from '@/lib/schedule';
import { remaining, suggestedReturnPrice } from '@/lib/sharing';
import { play } from '@/lib/sounds';
import { useDriver } from '@/state/driver';
import { Spacing, useColors } from '@/theme';

type Step = 'route' | 'schedule' | 'capacity' | 'price' | 'preview';
const STEPS: Step[] = ['route', 'schedule', 'capacity', 'price', 'preview'];

/**
 * Publish a route (Doc 5 D12–D15) or a return journey (D20–D21, `?returnOf=<route>`):
 * 1. origin, destination and optional stops; 2. departure and estimated arrival;
 * 3. vehicle and capacity — total, already occupied, what is left (weight, volume, seats);
 * 4. price set by the driver (a market reference is shown, never imposed) and whether the
 *    vehicle can be shared; 5. preview on the map, then publish.
 */
export default function NewRoute() {
  const { returnOf } = useLocalSearchParams<{ returnOf?: string }>();
  const outbound = useDoc('routes', returnOf ?? null);
  const { t } = useTranslation();
  const { account } = useDriverRecord();
  if (returnOf && outbound === undefined) return <Screen><StateView state="loading" /></Screen>;
  if (!account)
    return (
      <Screen header={<PageHeader title={t('routeNew.title')} onBack={() => router.back()} />}>
        <StateView state="empty" title={t('driver.signInTitle')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
      </Screen>
    );
  return <RouteForm outbound={outbound ?? null} />;
}

function RouteForm({ outbound }: { outbound: DriverRoute | null }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const cityName = useCityName();
  const dates = useDateFormat();
  const { account, record } = useDriverRecord();
  const { profile } = useDriver();
  const vehicles: VehicleId[] = Array.from(new Set([profile.vehicle?.type ?? record?.vehicle ?? 'truck35', ...(profile.moreVehicles ?? []).map((v) => v.type)]));
  const [step, setStep] = useState<Step>('route');
  const [tried, setTried] = useState(false);
  const [from, setFrom] = useState<CityId | null>(outbound ? outbound.to.cityId : (profile.vehicle?.homeCity ?? null));
  const [to, setTo] = useState<CityId | null>(outbound ? outbound.from.cityId : null);
  const [stops, setStops] = useState<CityId[]>([]);
  const [picking, setPicking] = useState<'from' | 'to' | 'stop' | null>(null);
  const [now] = useState(() => new Date());
  const [departAt, setDepartAt] = useState(() =>
    ensureBookable(outbound ? toLocalString(new Date(fromLocalString(outbound.arriveAt).getTime() + 2 * 3600e3)) : toLocalString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0)), now),
  );
  const [wheelOpen, setWheelOpen] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleId>(outbound?.vehicle ?? vehicles[0]);
  const base = outbound ? outbound.capacity : defaultCapacity(vehicle);
  const [tons, setTons] = useState(String(base.tons));
  const [volume, setVolume] = useState(String(base.volumeM3));
  const [seats, setSeats] = useState(String(base.seats));
  const [occTons, setOccTons] = useState('0');
  const [occVolume, setOccVolume] = useState('0');
  const [price, setPrice] = useState(outbound ? String(suggestedReturnPrice(outbound.price)) : '');
  const [sharePrice, setSharePrice] = useState(outbound ? String(suggestedReturnPrice(outbound.sharePrice)) : '');
  const [sharing, setSharing] = useState<DriverRoute['sharing']>(outbound?.sharing ?? 'both');
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const num = (s: string) => Number(s.replace(',', '.'));
  const fromLoc = from ? locationFromCity(from) : null;
  const toLoc = to ? locationFromCity(to) : null;
  const km = fromLoc && toLoc ? roadKm(fromLoc, toLoc) : 0;
  const arriveAt = toLocalString(new Date(fromLocalString(departAt).getTime() + estimateDurationMinutes(km) * 60e3));
  const reference = estimatePrice(vehicle, km, 0).suggested;
  const capacity = { tons: num(tons), volumeM3: num(volume), seats: Math.round(num(seats)) };
  const occupied = { tons: num(occTons), volumeM3: num(occVolume), seats: 0 };
  const left = remaining(capacity, occupied);
  const index = STEPS.indexOf(step) + 1;

  const errors = {
    from: !from ? t('routeNew.errFrom') : null,
    to: !to ? t('routeNew.errTo') : to === from ? t('routeNew.errSame') : null,
    tons: !(capacity.tons > 0) ? t('book.errNumber') : capacity.tons > maxTons(vehicle) ? t('routeNew.errOverPayload', { max: maxTons(vehicle) }) : null,
    volume: !(capacity.volumeM3 > 0) ? t('book.errNumber') : null,
    seats: !Number.isInteger(capacity.seats) || capacity.seats < 0 ? t('book.errNumber') : null,
    occupied: !(occupied.tons >= 0 && occupied.volumeM3 >= 0) || left.tons < 0 || left.volumeM3 < 0 ? t('routeNew.errOccupied') : null,
    price: sharing !== 'shared' && !(num(price) > 0) ? t('routeNew.errPrice') : null,
    sharePrice: sharing !== 'dedicated' && !(num(sharePrice) > 0) ? t('routeNew.errPrice') : null,
  };
  const valid: Record<Step, boolean> = {
    route: !errors.from && !errors.to,
    schedule: true,
    capacity: !errors.tons && !errors.volume && !errors.seats && !errors.occupied,
    price: !errors.price && !errors.sharePrice,
    preview: true,
  };

  const next = () => {
    setTried(true);
    if (!valid[step]) return;
    setTried(false);
    setStep(STEPS[index] ?? 'preview');
  };

  const publish = async () => {
    if (!account || !fromLoc || !toLoc) return;
    setBusy(true);
    try {
      const id = await publishRoute(
        store,
        { ...account, ...(record ?? {}) },
        {
          from: fromLoc,
          to: toLoc,
          stops: stops.map((c) => locationFromCity(c)),
          departAt,
          arriveAt,
          vehicle,
          plate: profile.vehicle?.plate ?? record?.plate ?? '',
          capacity,
          occupied,
          price: sharing === 'shared' ? num(sharePrice) : num(price),
          sharePrice: sharing === 'dedicated' ? Math.round(num(price) / 3) : num(sharePrice),
          sharing,
        },
        outbound ? 'return' : 'outbound',
        outbound?.id ?? null,
      );
      play('success');
      setPublished(id);
    } finally {
      setBusy(false);
    }
  };

  if (published)
    return (
      <Screen header={<PageHeader title={outbound ? t('routeNew.returnDone') : t('routeNew.done')} />}>
        <StateView state="success" title={outbound ? t('routeNew.returnDone') : t('routeNew.done')} body={t('routeNew.doneBody')} action={t('routeNew.open')} onAction={() => router.replace({ pathname: '/route/[id]', params: { id: published } })} />
        {!outbound && <Button variant="outline" icon="return-down-back-outline" title={t('route.publishReturn')} onPress={() => router.replace({ pathname: '/route-new', params: { returnOf: published } })} />}
        <PrototypeNote text={t('routeNew.prototype')} />
      </Screen>
    );

  const labels: Record<Step, string> = {
    route: t('routeNew.stepRoute'),
    schedule: t('routeNew.stepSchedule'),
    capacity: t('routeNew.stepCapacity'),
    price: t('routeNew.stepPrice'),
    preview: t('routeNew.stepPreview'),
  };

  return (
    <Screen
      header={<PageHeader title={outbound ? t('routeNew.returnTitle') : t('routeNew.title')} onBack={() => (index > 1 ? setStep(STEPS[index - 2]) : router.back())} />}
      footer={step === 'preview' ? <Button variant="accent" icon="send" title={t('routeNew.publish')} disabled={busy} onPress={publish} /> : <Button variant="accent" title={t('quest.continue')} onPress={next} />}>
      <StepIndicator step={index} total={STEPS.length} label={labels[step]} />
      {outbound && (
        <Card>
          <Text variant="caption" color={colors.teal}>
            {t('routeNew.returnNote')}
          </Text>
        </Card>
      )}

      {step === 'route' && (
        <>
          <SelectField label={t('search.from')} icon="package-variant-closed" value={from ? cityName(from) : undefined} placeholder={t('routeNew.chooseCity')} onPress={() => setPicking('from')} error={tried ? errors.from : null} />
          <SelectField label={t('search.to')} icon="flag-checkered" value={to ? cityName(to) : undefined} placeholder={t('routeNew.chooseCity')} onPress={() => setPicking('to')} error={tried ? errors.to : null} />
          <Text variant="caption">{t('routeNew.stops')}</Text>
          {stops.map((stop, i) => (
            <View key={`${stop}-${i}`} style={styles.stop}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.primary} />
              <Text variant="label" style={{ flex: 1 }}>
                {cityName(stop)}
              </Text>
              <Button compact variant="ghost" icon="close" title={t('routeNew.remove')} onPress={() => setStops(stops.filter((_, j) => j !== i))} />
            </View>
          ))}
          <Button compact variant="outline" icon="add" title={t('routeNew.addStop')} onPress={() => setPicking('stop')} />
        </>
      )}

      {step === 'schedule' && (
        <>
          <SelectField label={t('route.departure')} icon="calendar-clock" value={dates.pickupShort(departAt)} onPress={() => setWheelOpen(true)} />
          <Card>
            <InfoRow label={t('route.arrival')} value={dates.pickupShort(arriveAt)} />
            <InfoRow label={t('routeNew.distance')} value={`≈ ${km} km`} />
            <Text variant="caption" muted>
              {t('routeNew.arrivalNote')}
            </Text>
          </Card>
        </>
      )}

      {step === 'capacity' && (
        <>
          <Text variant="caption">{t('route.vehicle')}</Text>
          <FilterChips
            value={vehicle}
            onChange={(v) => {
              setVehicle(v as VehicleId);
              const c = defaultCapacity(v as VehicleId);
              setTons(String(c.tons));
              setVolume(String(c.volumeM3));
              setSeats(String(c.seats));
            }}
            options={vehicles.map((id) => ({ value: id, label: t(`vehicle.${id}`) }))}
          />
          <Text variant="label">{t('routeNew.total')}</Text>
          <View style={styles.trio}>
            <View style={{ flex: 1 }}>
              <FormField label={t('cap.weight')} value={tons} onChangeText={setTons} keyboardType="decimal-pad" suffix="t" error={tried ? errors.tons : null} />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label={t('cap.volume')} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" suffix="m³" error={tried ? errors.volume : null} />
            </View>
          </View>
          <FormField label={t('routeNew.seats')} value={seats} onChangeText={setSeats} keyboardType="number-pad" hint={t('routeNew.seatsHint')} error={tried ? errors.seats : null} />
          <Text variant="label">{t('routeNew.occupied')}</Text>
          <View style={styles.trio}>
            <View style={{ flex: 1 }}>
              <FormField label={t('cap.weight')} value={occTons} onChangeText={setOccTons} keyboardType="decimal-pad" suffix="t" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label={t('cap.volume')} value={occVolume} onChangeText={setOccVolume} keyboardType="decimal-pad" suffix="m³" />
            </View>
          </View>
          <Card>
            <Text variant="label" color={errors.occupied ? colors.accent : colors.teal}>
              {errors.occupied ?? t('routeNew.left', { tons: left.tons, volume: left.volumeM3, seats: left.seats })}
            </Text>
            <Text variant="caption" muted>
              {t('routeNew.validate')}
            </Text>
          </Card>
        </>
      )}

      {step === 'price' && (
        <>
          <Text variant="caption">{t('routeNew.sharingQ')}</Text>
          <OptionCards
            value={sharing}
            onChange={setSharing}
            options={[
              { value: 'both', icon: 'swap-horizontal', title: t('routeNew.both'), body: t('routeNew.bothBody') },
              { value: 'dedicated', icon: 'truck-outline', title: t('routeNew.dedicated'), body: t('routeNew.dedicatedBody') },
              { value: 'shared', icon: 'account-multiple-outline', title: t('routeNew.sharedOnly'), body: t('routeNew.sharedOnlyBody') },
            ]}
          />
          {sharing !== 'shared' && <FormField label={t('route.priceWhole')} value={price} onChangeText={setPrice} keyboardType="number-pad" suffix="DH" required error={tried ? errors.price : null} />}
          {sharing !== 'dedicated' && <FormField label={t('route.priceShared')} value={sharePrice} onChangeText={setSharePrice} keyboardType="number-pad" suffix="DH" required error={tried ? errors.sharePrice : null} hint={t('routeNew.sharePriceHint')} />}
          <Card>
            <InfoRow label={t('routeNew.reference')} value={formatMoney(t, reference)} />
            <Text variant="caption" muted>
              {t('routeNew.referenceNote')}
            </Text>
            <Button compact variant="ghost" title={t('routeNew.useReference')} onPress={() => setPrice(String(reference))} />
          </Card>
        </>
      )}

      {step === 'preview' && fromLoc && toLoc && (
        <>
          <FreightMap
            height={200}
            markers={[
              { id: 'from', kind: 'pickup', lat: fromLoc.lat, lng: fromLoc.lng, label: t('map.pickup') },
              ...stops.map((c, i) => ({ id: `s${i}`, kind: 'pick' as const, ...locationFromCity(c) })),
              { id: 'to', kind: 'dropoff', lat: toLoc.lat, lng: toLoc.lng, label: t('map.dropoff') },
            ]}
            route={[fromLoc, ...stops.map((c) => locationFromCity(c)), toLoc]}
            focus={[fromLoc, toLoc]}
            focusKey={`${from}-${to}-${stops.join()}`}
          />
          <Card>
            <InfoRow label={t('book.route')} value={`${cityName(from!)} → ${cityName(to!)}`} />
            {stops.length > 0 && <InfoRow label={t('route.stops')} value={stops.map(cityName).join(' · ')} />}
            <InfoRow label={t('route.departure')} value={dates.pickupShort(departAt)} />
            <InfoRow label={t('route.arrival')} value={dates.pickupShort(arriveAt)} />
            <InfoRow label={t('route.vehicle')} value={t(`vehicle.${vehicle}`)} />
            <InfoRow label={t('routeNew.leftShort')} value={`${left.tons} t · ${left.volumeM3} m³ · ${left.seats}`} />
            {sharing !== 'shared' && <InfoRow label={t('route.priceWhole')} value={formatMoney(t, num(price))} strong />}
            {sharing !== 'dedicated' && <InfoRow label={t('route.priceShared')} value={formatMoney(t, num(sharePrice))} />}
          </Card>
          <PrototypeNote text={t('routeNew.prototype')} />
        </>
      )}

      <CityPicker
        visible={picking !== null}
        title={picking === 'to' ? t('search.to') : picking === 'stop' ? t('routeNew.addStop') : t('search.from')}
        selected={(picking === 'to' ? to : picking === 'from' ? from : null) ?? 'casablanca'}
        onSelect={(city) => (picking === 'to' ? setTo(city) : picking === 'from' ? setFrom(city) : setStops([...stops, city]))}
        onClose={() => setPicking(null)}
      />
      <Sheet visible={wheelOpen} onClose={() => setWheelOpen(false)} title={t('route.departure')} drag="handle">
        <TimeWheels mode="date" value={departAt} onChange={setDepartAt} />
        <Button variant="accent" icon="checkmark" title={dates.pickupShort(departAt)} onPress={() => setWheelOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trio: { flexDirection: 'row', gap: Spacing.sm },
});
