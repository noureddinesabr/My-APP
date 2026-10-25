import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CityPicker, useCityName } from '@/components/city-picker';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Card } from '@/components/ui';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

export function RouteStep({ km }: { km: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const { draft, update } = useRequestDraft();
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const sameCity = draft.fromCity === draft.toCity;

  return (
    <>
      <Text variant="title">{t('request.routeTitle')}</Text>
      <Card>
        <CityField
          dotColor={colors.primary}
          label={t('request.from')}
          value={cityName(draft.fromCity)}
          onPress={() => setPicking('from')}
        />
        <TextInput
          value={draft.fromDetails}
          onChangeText={(fromDetails) => update({ fromDetails })}
          placeholder={t('request.detailsPlaceholder')}
        />

        <View style={styles.middle}>
          <View style={[styles.line, { borderColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              update({
                fromCity: draft.toCity,
                toCity: draft.fromCity,
                fromDetails: draft.toDetails,
                toDetails: draft.fromDetails,
              })
            }
            style={[styles.swap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>
              {t('request.swap')}
            </Text>
          </Pressable>
        </View>

        <CityField
          dotColor={colors.accent}
          label={t('request.to')}
          value={cityName(draft.toCity)}
          onPress={() => setPicking('to')}
        />
        <TextInput
          value={draft.toDetails}
          onChangeText={(toDetails) => update({ toDetails })}
          placeholder={t('request.detailsPlaceholder')}
        />
      </Card>

      <View style={[styles.distance, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="navigate-outline" size={20} color={colors.primary} />
        <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
          {sameCity ? t('request.sameCity', { city: cityName(draft.fromCity) }) : `${cityName(draft.fromCity)} – ${cityName(draft.toCity)}`}
        </Text>
        <Text variant="label" color={colors.primary}>
          {t('request.distance', { km })}
        </Text>
      </View>

      <CityPicker
        visible={picking !== null}
        title={picking === 'to' ? t('request.to') : t('request.from')}
        selected={picking === 'to' ? draft.toCity : draft.fromCity}
        onSelect={(city) => update(picking === 'to' ? { toCity: city } : { fromCity: city })}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

function CityField({
  dotColor,
  label,
  value,
  onPress,
}: {
  dotColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.cityField}>
      <View style={[styles.dot, { borderColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="subtitle">{value}</Text>
      </View>
      <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cityField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 5 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed' },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.md,
  },
});
