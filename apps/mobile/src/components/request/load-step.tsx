import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatMoney, percentOf } from '@/components/money';
import { MediaField } from '@/components/media/media-field';
import { VoiceNoteField } from '@/components/media/voice-note-field';
import { AccessPicker, ItemOptions } from '@/components/request/access-options';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Card, Chip } from '@/components/ui';
import { FREIGHT_TYPES, WEIGHT_OPTIONS } from '@/constants/freight';
import { HELPER_FEE } from '@/lib/pricing';
import { tripEstimate, useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

export function formatWeight(t: TFunction, tons: number) {
  return tons < 1 ? t('request.weightKg', { kg: tons * 1000 }) : t('request.weightValue', { tons });
}

export function LoadStep() {
  const { t } = useTranslation();
  const colors = useColors();
  const { draft, update } = useRequestDraft();
  const { price } = tripEstimate(draft);
  const tripOnly = price.suggested - price.helpersFee;

  return (
    <>
      <Text variant="title">{t('request.loadTitle')}</Text>

      <View style={styles.grid}>
        {FREIGHT_TYPES.map((type) => {
          const selected = draft.freightType === type.id;
          return (
            <Pressable
              key={type.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => update({ freightType: type.id, tons: type.typicalTons })}
              style={[
                styles.type,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}>
              <MaterialCommunityIcons name={type.icon} size={26} color={selected ? colors.primary : colors.textMuted} />
              <Text variant="caption" center numberOfLines={2}>
                {t(`freight.${type.id}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <Text variant="label">{t('request.weight')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {WEIGHT_OPTIONS.map((tons) => (
            <Chip
              key={tons}
              label={formatWeight(t, tons)}
              selected={draft.tons === tons}
              onPress={() => update({ tons })}
            />
          ))}
        </ScrollView>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{t('request.helpers')}</Text>
            <Text variant="caption" muted>
              {t('request.helperFee', { fee: HELPER_FEE })}
            </Text>
          </View>
        </View>
        <Stepper value={draft.helpers} min={0} max={6} onChange={(helpers) => update({ helpers })} />
        {draft.helpers > 0 && (
          <View style={[styles.anchor, { backgroundColor: colors.successSoft }]}>
            <MaterialCommunityIcons name="account-hard-hat" size={18} color={colors.success} />
            <Text variant="caption" color={colors.success} style={{ flex: 1 }}>
              {t('request.helperShare', {
                fee: formatMoney(t, price.helpersFee),
                percent: percentOf(price.helpersFee, tripOnly),
              })}
            </Text>
          </View>
        )}
      </Card>

      <Card>
        <Text variant="subtitle">{t('request.accessTitle')}</Text>
        <AccessPicker
          label={t('request.atPickup')}
          icon="map-marker-outline"
          value={draft.pickup}
          onChange={(pickup) => update({ pickup })}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AccessPicker
          label={t('request.atDropoff')}
          icon="map-marker-check-outline"
          value={draft.dropoff}
          onChange={(dropoff) => update({ dropoff })}
        />
      </Card>

      <Card>
        <Text variant="subtitle">{t('request.itemsTitle')}</Text>
        <ItemOptions value={draft.itemOptions} onChange={(itemOptions) => update({ itemOptions })} />
        <Text variant="caption" muted>
          {t('request.notesMore')}
        </Text>
        <TextInput
          value={draft.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder={t('request.notesPlaceholder')}
          multiline
          style={{ minHeight: 64, textAlignVertical: 'top' }}
        />
        <Text variant="caption" muted center>
          {t('media.orSpeak')}
        </Text>
        <VoiceNoteField value={draft.voiceNote} onChange={(voiceNote) => update({ voiceNote })} />
      </Card>

      <Card>
        <Text variant="subtitle">{t('media.showLoad')}</Text>
        <Text variant="caption" muted>
          {t('media.showLoadHint')}
        </Text>
        <MediaField value={draft.media} onChange={(media) => update({ media })} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  type: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  chips: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  divider: { height: 1 },
  anchor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.sm },
});
