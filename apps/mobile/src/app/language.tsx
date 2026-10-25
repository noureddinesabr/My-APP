import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Screen } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '@/i18n/languages';
import { Radius, Spacing, useColors } from '@/theme';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { language, followsDevice, setLanguage } = useLanguage();

  const options: { value: Language | 'device'; label: string; selected: boolean }[] = [
    { value: 'device', label: t('language.device'), selected: followsDevice },
    ...LANGUAGES.map((value) => ({
      value,
      label: LANGUAGE_NAMES[value],
      selected: !followsDevice && language === value,
    })),
  ];

  return (
    <Screen>
      <View style={{ gap: Spacing.xs }}>
        <Text variant="title">{t('language.title')}</Text>
        <Text muted>{t('language.subtitle')}</Text>
      </View>

      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.selected }}
          onPress={() => setLanguage(option.value)}
          style={[
            styles.option,
            {
              backgroundColor: option.selected ? colors.primarySoft : colors.surface,
              borderColor: option.selected ? colors.primary : colors.border,
            },
          ]}>
          <Ionicons
            name={option.value === 'device' ? 'phone-portrait-outline' : 'language-outline'}
            size={22}
            color={colors.primary}
          />
          <Text variant="label" style={{ flex: 1 }}>
            {option.label}
          </Text>
          {option.selected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </Pressable>
      ))}

      <Button title={t('common.continue')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
});
