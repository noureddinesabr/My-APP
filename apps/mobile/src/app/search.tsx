import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DriverRoute } from '@/backend/types';
import { CityPicker, useCityName } from '@/components/city-picker';
import { isShared, useOpenRoutes } from '@/components/customer/home-discovery';
import { FilterChips, PageHeader, PrototypeNote, SelectField, StateView, ToggleRow } from '@/components/ds';
import { formatMoney } from '@/components/money';
import { RouteCard } from '@/components/route-cards';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Button, Screen } from '@/components/ui';
import type { CityId } from '@/constants/cities';
import { CLIENT_VEHICLES, LOAD_WEIGHTS } from '@/constants/vehicles';
import { remaining } from '@/lib/sharing';
import { dayKey, fromLocalString } from '@/lib/schedule';
import { Spacing } from '@/theme';

type When = 'any' | 'today' | 'tomorrow' | 'week';
type Mode = 'any' | 'dedicated' | 'shared';
type Sort = 'price' | 'earliest' | 'match';

/**
 * Find transportation (Doc 5 C06–C07): pickup, destination, date, cargo weight and
 * dedicated / shared, then matching driver routes with sorting and a filter sheet. No match →
 * publish a request instead.
 */
export default function SearchRoutes() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: Mode; kind?: 'return' }>();
  const cityName = useCityName();
  const routes = useOpenRoutes();
  const [from, setFrom] = useState<CityId | null>(null);
  const [to, setTo] = useState<CityId | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [when, setWhen] = useState<When>('any');
  const [weight, setWeight] = useState<string>('any');
  const [mode, setMode] = useState<Mode>(params.mode === 'shared' ? 'shared' : 'any');
  const [sort, setSort] = useState<Sort>('earliest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vehicle, setVehicle] = useState<string>('any');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [needSeat, setNeedSeat] = useState(false);
  const [returnsOnly, setReturnsOnly] = useState(params.kind === 'return');
  const [now] = useState(() => new Date());

  const tons = LOAD_WEIGHTS.find((w) => w.id === weight)?.tons ?? 0;
  const inWindow = (route: DriverRoute) => {
    const day = fromLocalString(route.departAt);
    if (when === 'today') return dayKey(day) === dayKey(now);
    if (when === 'tomorrow') return dayKey(day) === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    if (when === 'week') return day.getTime() - now.getTime() < 7 * 864e5;
    return true;
  };
  const score = (route: DriverRoute) => (from && route.from.cityId === from ? 2 : 0) + (to && route.to.cityId === to ? 2 : 0) + (route.stops.some((s) => s.cityId === from || s.cityId === to) ? 1 : 0);
  const results = (routes ?? [])
    .filter((route) => (!from || route.from.cityId === from || route.stops.some((s) => s.cityId === from)) && (!to || route.to.cityId === to || route.stops.some((s) => s.cityId === to)))
    .filter(inWindow)
    .filter((route) => remaining(route.capacity, route.reserved).tons >= tons)
    .filter((route) => (mode === 'shared' ? isShared(route) : mode === 'dedicated' ? route.sharing !== 'shared' : true))
    .filter((route) => vehicle === 'any' || route.vehicle === vehicle)
    .filter((route) => maxPrice === null || (mode === 'shared' ? route.sharePrice : route.price) <= maxPrice)
    .filter((route) => !needSeat || remaining(route.capacity, route.reserved).seats > 0)
    .filter((route) => !returnsOnly || route.kind === 'return')
    .sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'match' ? score(b) - score(a) : a.departAt.localeCompare(b.departAt)));
  const activeFilters = (vehicle !== 'any' ? 1 : 0) + (maxPrice !== null ? 1 : 0) + (needSeat ? 1 : 0) + (returnsOnly ? 1 : 0);

  return (
    <Screen header={<PageHeader title={t('search.title')} onBack={() => router.back()} />}>
      <View style={styles.cities}>
        <View style={{ flex: 1 }}>
          <SelectField label={t('search.from')} icon="package-variant-closed" value={from ? cityName(from) : undefined} placeholder={t('search.anyCity')} onPress={() => setPicking('from')} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField label={t('search.to')} icon="flag-checkered" value={to ? cityName(to) : undefined} placeholder={t('search.anyCity')} onPress={() => setPicking('to')} />
        </View>
      </View>
      <Text variant="caption">{t('search.date')}</Text>
      <FilterChips<When>
        value={when}
        onChange={setWhen}
        options={[
          { value: 'any', label: t('search.anyDate') },
          { value: 'today', label: t('request.today') },
          { value: 'tomorrow', label: t('request.tomorrow') },
          { value: 'week', label: t('search.thisWeek') },
        ]}
      />
      <Text variant="caption">{t('search.weight')}</Text>
      <FilterChips value={weight} onChange={setWeight} options={[{ value: 'any', label: t('search.anyWeight') }, ...LOAD_WEIGHTS.map((w) => ({ value: w.id, label: t(`weight.${w.id}`) }))]} />
      <Text variant="caption">{t('search.mode')}</Text>
      <FilterChips<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'any', label: t('search.modeAny') },
          { value: 'dedicated', label: t('search.modeDedicated') },
          { value: 'shared', label: t('search.modeShared') },
        ]}
      />

      <View style={styles.resultsHead}>
        <Text variant="subtitle" style={{ flex: 1 }}>
          {t('search.results', { count: results.length })}
        </Text>
        <Button compact variant="outline" icon="options-outline" title={activeFilters ? t('search.filtersN', { count: activeFilters }) : t('search.filters')} onPress={() => setFiltersOpen(true)} />
      </View>
      <FilterChips<Sort>
        value={sort}
        onChange={setSort}
        options={[
          { value: 'earliest', label: t('search.sortEarliest') },
          { value: 'price', label: t('search.sortPrice') },
          { value: 'match', label: t('search.sortMatch') },
        ]}
      />
      {routes === undefined ? (
        <StateView state="loading" />
      ) : results.length ? (
        results.map((route) => <RouteCard key={route.id} route={route} />)
      ) : (
        <StateView state="empty" title={t('search.none')} body={t('search.noneBody')} action={t('home2.publish')} onAction={() => router.replace('/client')} />
      )}
      <PrototypeNote text={t('search.prototype')} />

      <CityPicker visible={picking !== null} title={picking === 'to' ? t('search.to') : t('search.from')} selected={(picking === 'to' ? to : from) ?? 'casablanca'} onSelect={(city) => (picking === 'to' ? setTo(city) : setFrom(city))} onClose={() => setPicking(null)} />
      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('search.filters')} drag="handle">
        <View style={{ gap: Spacing.md }}>
          <Text variant="caption">{t('search.vehicle')}</Text>
          <FilterChips value={vehicle} onChange={setVehicle} options={[{ value: 'any', label: t('search.anyVehicle') }, ...CLIENT_VEHICLES.map((id) => ({ value: id, label: t(`vehicle.${id}`) }))]} />
          <Text variant="caption">{t('search.maxPrice')}</Text>
          <FilterChips
            value={maxPrice === null ? 'any' : String(maxPrice)}
            onChange={(value) => setMaxPrice(value === 'any' ? null : Number(value))}
            options={[{ value: 'any', label: t('search.anyPrice') }, ...[500, 1000, 2000, 3000].map((n) => ({ value: String(n), label: t('search.upTo', { price: formatMoney(t, n) }) }))]}
          />
          <ToggleRow icon="seat-passenger" label={t('search.needSeat')} hint={t('search.needSeatHint')} value={needSeat} onChange={setNeedSeat} />
          <ToggleRow icon="backup-restore" label={t('search.returnsOnly')} value={returnsOnly} onChange={setReturnsOnly} />
          <View style={styles.sheetActions}>
            <View style={{ flex: 1 }}>
              <Button
                variant="ghost"
                title={t('search.reset')}
                onPress={() => {
                  setVehicle('any');
                  setMaxPrice(null);
                  setNeedSeat(false);
                  setReturnsOnly(false);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="accent" title={t('search.show', { count: results.length })} onPress={() => setFiltersOpen(false)} />
            </View>
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cities: { flexDirection: 'row', gap: Spacing.sm },
  resultsHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm },
});
