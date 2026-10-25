import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useLanguage } from '@/i18n/language-provider';
import { LANGUAGE_NAMES } from '@/i18n/languages';
import { Radius, Spacing, useColors } from '@/theme';

export function LanguageButton() {
  const colors = useColors();
  const { language } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/language')}
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="globe-outline" size={18} color={colors.primary} />
      <Text variant="caption">{LANGUAGE_NAMES[language]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
