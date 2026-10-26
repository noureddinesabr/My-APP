import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { CITIES, getCity, type CityId } from '@/constants/cities';
import { useLanguage } from '@/i18n/language-provider';
import { Radius, Spacing, useColors } from '@/theme';

export function useCityName() {
  const { language } = useLanguage();
  return (id: CityId) => getCity(id).name[language];
}

export function CityPicker({
  visible,
  title,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selected: CityId;
  onSelect: (city: CityId) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { language } = useLanguage();
  return (
    <Sheet visible={visible} onClose={onClose} drag="handle" fullHeight>
        <View style={styles.header}>
          <Text variant="title" style={{ flex: 1 }}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {CITIES.map((city) => {
            const isSelected = city.id === selected;
            return (
              <Pressable
                key={city.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(city.id);
                  onClose();
                }}
                style={[
                  styles.item,
                  { backgroundColor: isSelected ? colors.primarySoft : colors.surface, borderColor: colors.border },
                ]}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text variant="label" style={{ flex: 1 }}>
                  {city.name[language]}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingBottom: Spacing.xxl, gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
