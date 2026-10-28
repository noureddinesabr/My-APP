import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useDateFormat } from '@/components/date-format';
import { formatMoney } from '@/components/money';
import { formatWeight } from '@/components/request/format';
import { Text } from '@/components/text';
import { FREIGHT_TYPES } from '@/constants/freight';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { vehicleImage } from '@/constants/vehicles';
import { QUESTIONS, type RequestDraft } from '@/state/request-draft';
import { Radius, rim, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Each answer pops onto the map as a small sticker once it is given (what, how heavy, which
 * vehicle, when, helpers, photos, note), so the trip builds up in front of the client's eyes.
 */
export function AnswersOnMap({ draft }: { draft: RequestDraft }) {
  const { t } = useTranslation();
  const { rtl } = useLanguage();
  const dates = useDateFormat();
  const answered = (question: (typeof QUESTIONS)[number]) => QUESTIONS.indexOf(question) < draft.step;
  const kind = FREIGHT_TYPES.find((type) => type.id === draft.freightType);
  const chips: { key: string; icon?: IconName; image?: number; text: string }[] = [];
  if (answered('what') && kind) chips.push({ key: 'what', icon: kind.icon, text: t(`freight.${kind.id}`) });
  if (answered('size')) chips.push({ key: 'size', icon: 'weight-kilogram', text: draft.weightKnown ? `≈ ${formatWeight(t, draft.tons)}` : t('quest.weightUnknown') });
  if (answered('vehicle')) chips.push({ key: 'vehicle', image: vehicleImage(draft.vehicle), text: t(`vehicle.${draft.vehicle}`) });
  if (answered('when'))
    chips.push({
      key: 'when',
      icon: draft.when === 'scheduled' ? 'calendar-month-outline' : 'lightning-bolt',
      text: draft.when === 'scheduled' ? dates.pickupAt(draft.scheduledAt) : t(draft.pickupWindow === '1h' ? 'request.whenHour' : 'quest.whenNow'),
    });
  if (answered('helpers') && draft.helpers > 0) chips.push({ key: 'helpers', icon: 'account-hard-hat', text: t(`quest.helpers${Math.min(draft.helpers, 3)}`) });
  if (answered('media') && (draft.media.length || draft.voiceNote))
    chips.push({
      key: 'media',
      icon: draft.media.length ? 'camera' : 'microphone',
      text: [draft.media.length ? t('map.photos', { count: draft.media.length }) : null, draft.voiceNote ? t('map.voice') : null].filter(Boolean).join(' · '),
    });
  if (answered('note') && draft.notes.trim()) chips.push({ key: 'note', icon: 'note-text-outline', text: t('map.noteAdded') });
  if (answered('price')) chips.push({ key: 'price', icon: 'cash', text: formatMoney(t, draft.price) });
  if (!chips.length) return null;
  return (
    // On the side away from the ☰ button (which sits on the reading side).
    <View style={[styles.column, { [physical(rtl ? 'left' : 'right')]: Spacing.md }, rtl ? { alignItems: 'flex-start' } : null]} pointerEvents="none">
      {chips.map((chip) => (
        <Chip key={chip.key} icon={chip.icon} image={chip.image} text={chip.text} />
      ))}
    </View>
  );
}

function Chip({ icon, image, text }: { icon?: IconName; image?: number; text: string }) {
  const colors = useColors();
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.chip, { backgroundColor: colors.surfaceFloating }, rim(colors), softShadow(colors.shadow, 0.8)]}>
      {image ? (
        <Image source={image} style={styles.image} contentFit="contain" />
      ) : icon ? (
        <View style={[styles.icon, { backgroundColor: colors.primaryFill }]}>
          <MaterialCommunityIcons name={icon} size={13} color={colors.onPrimary} />
        </View>
      ) : null}
      <Text variant="caption" numberOfLines={1} style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', top: Spacing.md, alignItems: 'flex-end', gap: 5, maxWidth: '58%' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 4, paddingEnd: Spacing.sm + 2, paddingVertical: 3, borderRadius: Radius.pill, maxWidth: '100%' },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  image: { width: 34, height: 22 },
  text: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
});
