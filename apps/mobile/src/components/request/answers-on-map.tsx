import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useDateFormat } from '@/components/date-format';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { physical } from '@/i18n/direction';
import { useLanguage } from '@/i18n/language-provider';
import { vehicleImage, weightKey } from '@/constants/vehicles';
import { QUESTIONS, type RequestDraft } from '@/state/request-draft';
import { Radius, rim, softShadow, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type AnswerChip = { key: string; icon?: IconName; image?: number; text: string };

/**
 * The answers given so far, as map stickers: the weight, the vehicle, then helpers,
 * riding along, photos / voice / note, and when — each one pops on as soon as it is given.
 */
export function useAnswerChips(draft: RequestDraft) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const answered = (question: (typeof QUESTIONS)[number]) => QUESTIONS.indexOf(question) < draft.step;
  const chips: AnswerChip[] = [];
  if (answered('weight')) chips.push({ key: 'weight', icon: 'weight-kilogram', text: t(`weight.${weightKey(draft.tons)}`) });
  if (draft.vehicleChosen) chips.push({ key: 'vehicle', image: vehicleImage(draft.vehicle), text: t(`vehicle.${draft.vehicle}`) });
  // The extras show as they are added, while the client is still on that page.
  if (draft.helpers > 0) chips.push({ key: 'helpers', icon: 'account-hard-hat', text: t('simple.helpers', { count: draft.helpers }) });
  if (draft.accompaniment && draft.accompaniment !== 'none') chips.push({ key: 'ride', icon: 'seat-passenger', text: t(`accompany.${draft.accompaniment}`) });
  if (draft.media.length) chips.push({ key: 'media', icon: 'camera', text: t('map.photos', { count: draft.media.length }) });
  if (draft.voiceNote) chips.push({ key: 'voice', icon: 'microphone', text: t('map.voice') });
  if (draft.notes.trim()) chips.push({ key: 'note', icon: 'note-text-outline', text: t('map.noteAdded') });
  if (answered('when'))
    chips.push({
      key: 'when',
      icon: draft.when === 'scheduled' ? 'calendar-month-outline' : 'lightning-bolt',
      text: draft.when === 'scheduled' ? dates.pickupShort(draft.scheduledAt) : t('quest.whenNow'),
    });
  if (answered('sharing')) chips.push({ key: 'sharing', icon: draft.allowSharing ? 'account-multiple-outline' : 'truck-outline', text: draft.allowSharing ? t('route.sharedTag') : t('route.dedicatedTag') });
  if (answered('price')) chips.push({ key: 'price', icon: 'cash', text: formatMoney(t, draft.price) });
  return chips;
}

/** Height of one sticker plus the gap under it. */
export const CHIP_ROW = 35;
/** How wide a column of stickers is, for keeping the map's pins clear of it. */
export const CHIP_COLUMN = 150;

/**
 * Each answer pops onto the map as a small sticker once it is given, so the trip builds up in
 * front of the client's eyes. They stack on the side away from the ☰ button; when that side
 * is full (down to the trip chip), they carry on in a second column under the ☰ button.
 */
export function AnswersOnMap({ chips, perColumn }: { chips: AnswerChip[]; perColumn: number }) {
  const { rtl } = useLanguage();
  if (!chips.length) return null;
  const first = chips.slice(0, perColumn);
  const second = chips.slice(perColumn, perColumn * 2);
  const away = physical(rtl ? 'left' : 'right');
  const menuSide = physical(rtl ? 'right' : 'left');
  return (
    <>
      {/* flex-end hugs the screen edge on the far side in both reading directions; flex-start on the ☰ side. */}
      <View style={[styles.column, { top: Spacing.md, [away]: Spacing.md }]} pointerEvents="none">
        {first.map((chip) => (
          <Chip key={chip.key} icon={chip.icon} image={chip.image} text={chip.text} />
        ))}
      </View>
      {second.length > 0 && (
        // Under the ☰ button (it is 48 high, plus its margin).
        <View style={[styles.column, styles.alignStart, { top: Spacing.md + 56, [menuSide]: Spacing.md }]} pointerEvents="none">
          {second.map((chip) => (
            <Chip key={chip.key} icon={chip.icon} image={chip.image} text={chip.text} />
          ))}
        </View>
      )}
    </>
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
      <Text variant="caption" style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', alignItems: 'flex-end', gap: 5, maxWidth: CHIP_COLUMN },
  alignStart: { alignItems: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 4, paddingEnd: Spacing.sm + 2, paddingVertical: 3, borderRadius: Radius.pill, maxWidth: '100%' },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  image: { width: 34, height: 22 },
  text: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
});
