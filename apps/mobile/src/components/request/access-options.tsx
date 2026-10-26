import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Chip } from '@/components/ui';
import type { ItemOption, Place } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const FLOORS = [0, 1, 2, 3, 4, 5];

export const ITEM_OPTIONS: { id: ItemOption; icon: IconName; key: string }[] = [
  { id: 'fragile', icon: 'glass-fragile', key: 'request.itemFragile' },
  { id: 'heavy', icon: 'weight-kilogram', key: 'request.itemHeavy' },
  { id: 'disassembly', icon: 'screwdriver', key: 'request.itemDisassembly' },
  { id: 'packing', icon: 'package-variant', key: 'request.itemPacking' },
  { id: 'narrowStreet', icon: 'road-variant', key: 'request.itemNarrowStreet' },
  { id: 'longCarry', icon: 'walk', key: 'request.itemLongCarry' },
];

/** "Ground floor" or "Floor 3 · Stairs only". */
export function describePlace(t: TFunction, place: Place) {
  if (place.floor === 0) return t('request.floorGroundLong');
  const floor = t('request.floorN', { n: place.floor === 5 ? '5+' : place.floor });
  return `${floor} · ${t(place.access === 'elevator' ? 'request.accessElevator' : 'request.accessStairs')}`;
}

/** Floor chips, then elevator / stairs once the floor is above ground. */
export function AccessPicker({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: IconName;
  value: Place;
  onChange: (place: Place) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.labelRow}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text variant="label">{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FLOORS.map((floor) => (
          <Chip
            key={floor}
            label={floor === 0 ? t('request.floorGround') : floor === 5 ? '5+' : String(floor)}
            selected={value.floor === floor}
            onPress={() => onChange({ ...value, floor })}
          />
        ))}
      </ScrollView>
      {value.floor > 0 && (
        <View style={styles.accessRow}>
          {(['elevator', 'stairs'] as const).map((access) => {
            const selected = value.access === access;
            return (
              <Pressable
                key={access}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange({ ...value, access })}
                style={[
                  styles.access,
                  {
                    backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                    borderColor: selected ? colors.primary : 'transparent',
                  },
                ]}>
                <MaterialCommunityIcons
                  name={access === 'elevator' ? 'elevator-passenger-outline' : 'stairs'}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text variant="caption" color={selected ? colors.primary : colors.text}>
                  {t(access === 'elevator' ? 'request.accessElevator' : 'request.accessStairs')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Multi-select item options with icons. */
export function ItemOptions({ value, onChange }: { value: ItemOption[]; onChange: (value: ItemOption[]) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.items}>
      {ITEM_OPTIONS.map((option) => {
        const selected = value.includes(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? value.filter((id) => id !== option.id) : [...value, option.id])}
            style={[
              styles.item,
              {
                backgroundColor: selected ? colors.primaryFill : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}>
            <MaterialCommunityIcons name={option.icon} size={18} color={selected ? colors.onPrimary : colors.primary} />
            <Text variant="caption" color={selected ? colors.onPrimary : colors.text}>
              {t(option.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  chips: { gap: Spacing.sm },
  accessRow: { flexDirection: 'row', gap: Spacing.sm },
  access: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
});
