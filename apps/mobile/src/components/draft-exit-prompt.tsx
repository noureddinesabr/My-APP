import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Radius, useColors } from '@/theme';

/** Bottom sheet shown when leaving the request wizard: states plainly what discarding would lose. */
export function DraftExitPrompt({
  visible,
  onKeep,
  onDiscard,
  onClose,
}: {
  visible: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <Sheet visible={visible} onClose={onClose}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="content-save-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="title" center>
            {t('request.exitTitle')}
          </Text>
          <Text muted center>
            {t('request.exitBody')}
          </Text>
          <Button title={t('request.exitKeep')} variant="accent" icon="bookmark-outline" onPress={onKeep} />
          <Button title={t('request.exitDiscard')} variant="ghost" onPress={onDiscard} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
