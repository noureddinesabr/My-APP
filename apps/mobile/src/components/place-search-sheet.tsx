import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MapPicker } from '@/components/map-picker';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PlaceResults } from '@/components/place-search';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { locationFromPoint, type Location } from '@/constants/places';
import type { LatLng } from '@/lib/geo';
import { currentPosition } from '@/lib/location';
import { rememberPlace } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

/**
 * Full-height search for one place: suggestions from the first letters, recent places,
 * "Use my location" (pickup only) and "Pick on map".
 */
export function PlaceSearchSheet({
  visible,
  title,
  near,
  current,
  allowGps,
  onClose,
  onChoose,
}: {
  visible: boolean;
  title: string;
  near?: LatLng;
  /** The place chosen now, used to open the map picker there. */
  current: Location;
  allowGps?: boolean;
  onClose: () => void;
  onChoose: (location: Location) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);

  const choose = (location: Location) => {
    play('pop');
    rememberPlace(location);
    setQuery('');
    onChoose(location);
  };

  const useGps = async () => {
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
    <>
      <Sheet visible={visible && !mapOpen} onClose={onClose} title={title} drag="handle" fullHeight>
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} />
        <View style={styles.actions}>
          {allowGps && (
            <Action
              icon={locating ? undefined : 'navigate'}
              label={gpsFailed ? t('quest.gpsOff') : t('place.useMyLocation')}
              color={colors.location}
              onPress={useGps}
            />
          )}
          <Action icon="map-outline" label={t('place.pickOnMap')} color={colors.primary} onPress={() => setMapOpen(true)} />
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
          <PlaceResults query={query} near={near} onChoose={choose} />
        </ScrollView>
      </Sheet>
      <MapPicker
        visible={mapOpen}
        title={title}
        initial={current}
        onClose={() => setMapOpen(false)}
        onConfirm={(location) => {
          setMapOpen(false);
          choose(location);
        }}
      />
    </>
  );
}

function Action({ icon, label, color, onPress }: { icon?: 'navigate' | 'map-outline'; label: string; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" scaleTo={0.95} onPress={onPress} style={[styles.action, { backgroundColor: colors.surfaceMuted }]}>
      {icon ? <Ionicons name={icon} size={18} color={color} /> : <ActivityIndicator size="small" color={color} />}
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.sm },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minHeight: 44, borderRadius: Radius.pill, paddingHorizontal: Spacing.md },
});
