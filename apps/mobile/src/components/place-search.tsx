import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocationLabel } from '@/components/location-label';
import { Text } from '@/components/text';
import { getCity } from '@/constants/cities';
import { findPlaces, locationFromPlace, locationFromPoint, type Location, type Place } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';
import { searchOnline, type OnlinePlace } from '@/lib/geocode';
import type { LatLng } from '@/lib/geo';
import type { PlaceKind } from '@/lib/place-search';
import { useRecentPlaces } from '@/lib/recent-places';
import { Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const KIND_ICONS: Record<PlaceKind, IconName> = {
  city: 'city-variant-outline',
  town: 'home-group',
  district: 'home-city-outline',
  street: 'road-variant',
  landmark: 'star-four-points-outline',
  industrial: 'factory',
  port: 'ferry',
  station: 'train',
  mall: 'shopping-outline',
  market: 'storefront-outline',
  hospital: 'hospital-box-outline',
  university: 'school-outline',
  airport: 'airplane',
};

/** Wait this long after the last key press before asking the online search. */
const ONLINE_DELAY_MS = 350;

/**
 * Results for what the user is typing: many suggestions from the first letters
 * (neighbourhoods, streets, markets, towns…), nearby first, then street addresses
 * from the online search when it can be reached. With nothing typed: recent places.
 */
export function PlaceResults({ query, near, onChoose }: { query: string; near?: LatLng; onChoose: (location: Location) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { language } = useLanguage();
  const names = useLocationLabel();
  const recent = useRecentPlaces();
  const local = findPlaces(query, 20, near);
  const [online, setOnline] = useState<{ query: string; places: OnlinePlace[] }>({ query: '', places: [] });

  useEffect(() => {
    if (query.trim().length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchOnline(query, language, near).then((places) => {
        if (!cancelled) setOnline({ query, places });
      });
    }, ONLINE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, language, near]);

  const streets = online.query === query ? online.places : [];

  if (!query.trim()) {
    if (!recent.length) return null;
    return (
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.rim }]}>
        <Text variant="caption" muted style={styles.section}>
          {t('place.recent')}
        </Text>
        {recent.map((location, index) => (
          <Row key={`${location.lat},${location.lng},${index}`} icon="history" title={names.label(location)} subtitle={getCity(location.cityId).name[language]} onPress={() => onChoose(location)} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.rim }]}>
      {local.length === 0 && streets.length === 0 && (
        <Text variant="caption" muted style={{ padding: Spacing.md }}>
          {t('place.noMatch')}
        </Text>
      )}
      {local.map((place) => (
        <Row
          key={place.id}
          icon={KIND_ICONS[place.kind]}
          title={place.name[language]}
          subtitle={describe(place)}
          onPress={() => onChoose(locationFromPlace(place))}
        />
      ))}
      {streets.length > 0 && (
        <>
          <Text variant="caption" muted style={styles.section}>
            {t('place.addresses')}
          </Text>
          {streets.map((place) => (
            <Row
              key={place.id}
              icon="map-marker-outline"
              title={place.title}
              subtitle={place.subtitle}
              onPress={() => onChoose({ ...locationFromPoint(place, 'map'), label: [place.title, place.subtitle].filter(Boolean).join(', ') })}
            />
          ))}
        </>
      )}
    </View>
  );

  function describe(place: Place) {
    const kind = t(`placeKind.${place.kind}`);
    if (place.kind === 'city') return kind;
    return `${kind} · ${getCity(place.cityId).name[language]}`;
  }
}

function Row({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.primarySoft }]}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', paddingVertical: Spacing.xs },
  section: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
