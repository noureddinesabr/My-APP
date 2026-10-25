import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { ForwardChevron, Screen } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { LANGUAGE_NAMES } from '@/i18n/languages';
import { useRole } from '@/state/role';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

export default function Settings() {
  const { t } = useTranslation();
  const colors = useColors();
  const { language } = useLanguage();
  const { setRole } = useRole();

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()}>
          <ForwardChevron color={colors.text} flip />
        </Pressable>
        <Text variant="title">{t('settings.title')}</Text>
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface }, softShadow(colors.shadow)]}>
        <Row
          icon="globe-outline"
          label={t('settings.language')}
          value={LANGUAGE_NAMES[language]}
          onPress={() => router.push('/language')}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row
          icon="swap-horizontal-outline"
          label={t('settings.changeRole')}
          onPress={() => {
            setRole(null);
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text variant="label" style={{ flex: 1 }}>
        {label}
      </Text>
      {value && <Text muted>{value}</Text>}
      <ForwardChevron color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  group: { borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  divider: { height: 1, marginStart: Spacing.lg + 22 + Spacing.md },
});
