import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { PlaceInput } from '@/components/place-input';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Card } from '@/components/ui';
import { play } from '@/lib/sounds';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

export function RouteStep({ km }: { km: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { draft, update } = useRequestDraft();

  return (
    <>
      <Text variant="title">{t('request.routeTitle')}</Text>

      <FreightMap
        height={200}
        markers={[
          { id: 'from', kind: 'pickup', lat: draft.from.lat, lng: draft.from.lng },
          { id: 'to', kind: 'dropoff', lat: draft.to.lat, lng: draft.to.lng },
        ]}
        route={[draft.from, draft.to]}
        focus={[draft.from, draft.to]}
        focusKey={`${draft.from.lat},${draft.from.lng},${draft.to.lat},${draft.to.lng}`}
      />

      <Card>
        <PlaceInput
          label={t('request.from')}
          dotColor={colors.primary}
          value={draft.from}
          onChange={(from) => update({ from })}
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
            onPress={() => {
              play('tap');
              update({ from: draft.to, to: draft.from, fromDetails: draft.toDetails, toDetails: draft.fromDetails });
            }}
            style={[styles.swap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>
              {t('request.swap')}
            </Text>
          </Pressable>
        </View>

        <PlaceInput label={t('request.to')} dotColor={colors.accent} value={draft.to} onChange={(to) => update({ to })} />
        <TextInput
          value={draft.toDetails}
          onChangeText={(toDetails) => update({ toDetails })}
          placeholder={t('request.detailsPlaceholder')}
        />
      </Card>

      <View style={[styles.distance, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="navigate-outline" size={20} color={colors.primary} />
        <Text variant="label" color={colors.primary} style={{ flex: 1 }} numberOfLines={2}>
          {names.cityRoute(draft.from, draft.to)}
        </Text>
        <Text variant="label" color={colors.primary}>
          {t('request.distance', { km })}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
