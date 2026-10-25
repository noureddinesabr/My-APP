import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { locationFromPoint, type Location } from '@/constants/places';
import { play } from '@/lib/sounds';
import { Spacing, useColors } from '@/theme';

/** Full-screen map: tap to drop a pin, then confirm. */
export function MapPicker({
  visible,
  title,
  initial,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initial: Location;
  onClose: () => void;
  onConfirm: (location: Location) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  // Each opening starts from the current value.
  const [opened, setOpened] = useState<{ from: Location; picked: Location } | null>(null);
  if (visible && opened?.from !== initial) setOpened({ from: initial, picked: initial });
  const picked = opened?.picked ?? initial;
  const setPicked = (location: Location) => setOpened({ from: initial, picked: location });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="subtitle">{title}</Text>
            <Text variant="caption" muted>
              {t('place.tapToPick')}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <FreightMap
          style={{ flex: 1, marginHorizontal: Spacing.lg }}
          height={undefined}
          markers={[{ id: 'pick', kind: 'pick', lat: picked.lat, lng: picked.lng }]}
          focus={[initial]}
          focusKey={visible ? `${initial.lat},${initial.lng}` : 'closed'}
          onPick={(point) => {
            play('tap');
            setPicked(locationFromPoint(point, 'map'));
          }}
        />
        <View style={styles.footer}>
          <View style={styles.pickedRow}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {names.label(picked)}
            </Text>
          </View>
          <Button title={t('place.confirmLocation')} icon="checkmark" onPress={() => onConfirm(picked)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  footer: { padding: Spacing.lg, gap: Spacing.md },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
