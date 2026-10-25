import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/theme';

/** Shown when leaving the request wizard: states plainly what discarding would lose. */
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="content-save-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="title" center>
            {t('request.exitTitle')}
          </Text>
          <Text muted center>
            {t('request.exitBody')}
          </Text>
          <Button title={t('request.exitKeep')} icon="bookmark-outline" onPress={onKeep} />
          <Button title={t('request.exitDiscard')} variant="ghost" onPress={onDiscard} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,30,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md, alignItems: 'stretch' },
  icon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
