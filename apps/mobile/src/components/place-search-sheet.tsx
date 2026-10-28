import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MapPicker } from '@/components/map-picker';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePanelHeight } from '@/components/motion/quest';
import { PlaceResults } from '@/components/place-search';
import { Sheet } from '@/components/sheet';
import { TextInput } from '@/components/text-input';
import { locationFromPoint, type Location } from '@/constants/places';
import type { LatLng } from '@/lib/geo';
import { currentPosition } from '@/lib/location';
import { rememberPlace } from '@/lib/recent-places';
import { play } from '@/lib/sounds';
import { Spacing, useColors } from '@/theme';

/**
 * Search for one place in the bottom third of the screen, so the map stays in view above:
 * suggestions from the first letters (the best one shown on the map as you type, through
 * `onPreview`), recent places, "Use my location" (pickup only) and "Pick on map".
 */
export function PlaceSearchSheet({
  visible,
  title,
  near,
  current,
  allowGps,
  onClose,
  onChoose,
  onPreview,
}: {
  visible: boolean;
  title: string;
  near?: LatLng;
  /** The place chosen now, used to open the map picker there. */
  current: Location;
  allowGps?: boolean;
  onClose: () => void;
  onChoose: (location: Location) => void;
  onPreview?: (location: Location | null) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);

  const height = usePanelHeight();
  const close = () => {
    onPreview?.(null);
    setQuery('');
    onClose();
  };
  const choose = (location: Location) => {
    onPreview?.(location);
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
      <Sheet visible={visible && !mapOpen} onClose={close} drag="handle" height={height} scrim={false}>
        <View style={styles.searchRow}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={title}
            accessibilityLabel={`${title} ${t('home.searchPlaceholder')}`}
            style={{ flex: 1, minHeight: 50 }}
          />
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
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.sm }}>
          <PlaceResults query={query} near={near} onChoose={choose} onPreview={onPreview} />
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

/** A round button next to the field (its words are read out, not shown, to save room). */
function Action({ icon, label, color, onPress }: { icon?: 'navigate' | 'map-outline'; label: string; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.9} onPress={onPress} style={[styles.action, { backgroundColor: colors.surfaceMuted, borderColor: color }]}>
      {icon ? <Ionicons name={icon} size={22} color={color} /> : <ActivityIndicator size="small" color={color} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  action: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
