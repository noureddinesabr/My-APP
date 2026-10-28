import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useLocationLabel } from '@/components/location-label';
import { MapPicker } from '@/components/map-picker';
import { PlaceResults } from '@/components/place-search';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { TextInput } from '@/components/text-input';
import { locationFromPoint, type Location } from '@/constants/places';
import type { LatLng } from '@/lib/geo';
import { currentPosition } from '@/lib/location';
import { rememberPlace } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

/** Location field: type for suggestions, use GPS, or pick on the map. */
export function PlaceInput({
  label,
  dotColor,
  value,
  onChange,
  near,
}: {
  label: string;
  dotColor: string;
  value: Location;
  onChange: (location: Location) => void;
  /** Rank places near this point first (e.g. the other end of the trip). */
  near?: LatLng;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  // Saved home / work addresses, offered first (smart default for repeat clients).
  const { clientRecord } = useMyRecord();
  const saved = clientRecord?.savedPlaces ?? [];

  const choose = (location: Location) => {
    play('tap');
    rememberPlace(location);
    onChange(location);
    setQuery('');
    setEditing(false);
  };

  const useMyLocation = async () => {
    setLocating(true);
    setGpsFailed(false);
    const point = await currentPosition();
    setLocating(false);
    if (point) choose(locationFromPoint(point, 'gps'));
    else {
      play('error');
      setGpsFailed(true);
    }
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { borderColor: dotColor }]} />
        <Text variant="caption" muted>
          {label}
        </Text>
      </View>

      {editing ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder={t('place.searchPlaceholder')}
          onBlur={() => !query && setEditing(false)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setEditing(true)}
          style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="label" style={{ flex: 1 }}>
            {names.label(value)}
          </Text>
          <Ionicons name="search" size={18} color={colors.textMuted} />
        </Pressable>
      )}

      {editing && query.length === 0 && saved.length > 0 && (
        <View style={styles.actions}>
          {saved.map((place) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              onPress={() => choose(place.location)}
              style={[styles.action, { backgroundColor: colors.successSoft }]}>
              <Ionicons name={place.label === 'home' ? 'home' : 'briefcase'} size={14} color={colors.success} />
              <Text variant="caption" color={colors.success}>
                {place.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {editing && <PlaceResults query={query} near={near ?? value} onChoose={choose} />}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={useMyLocation} style={[styles.action, { backgroundColor: colors.primarySoft }]}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
          )}
          <Text variant="caption" color={colors.primary}>
            {t('place.useMyLocation')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            play('tap');
            setMapOpen(true);
          }}
          style={[styles.action, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="map-search-outline" size={16} color={colors.primary} />
          <Text variant="caption" color={colors.primary}>
            {t('place.pickOnMap')}
          </Text>
        </Pressable>
      </View>
      {gpsFailed && (
        <Text variant="caption" color={colors.accent}>
          {t('place.gpsUnavailable')}
        </Text>
      )}

      <MapPicker
        visible={mapOpen}
        title={label}
        initial={value}
        onClose={() => setMapOpen(false)}
        onConfirm={(location) => {
          setMapOpen(false);
          choose(location);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 4 },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  suggestions: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
});
