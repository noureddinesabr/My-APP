import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LanguageButton } from '@/components/language-button';
import { Text } from '@/components/text';
import { ForwardChevron, Screen } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { useRole, type Role } from '@/state/role';
import { Radius, Spacing, useColors } from '@/theme';

const ROLE_OPTIONS: { role: Role; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { role: 'client', icon: 'package-variant-closed' },
  { role: 'driver', icon: 'truck-fast' },
  { role: 'company', icon: 'domain' },
];

const ROLE_KEYS = {
  client: ['welcome.roleClient', 'welcome.roleClientHint'],
  driver: ['welcome.roleDriver', 'welcome.roleDriverHint'],
  company: ['welcome.roleCompany', 'welcome.roleCompanyHint'],
} as const;

export default function Welcome() {
  const { t } = useTranslation();
  const colors = useColors();
  const { role, setRole } = useRole();
  const { rtl } = useLanguage();

  if (role) return <Redirect href={`/${role}`} />;

  const choose = (next: Role) => {
    setRole(next);
    router.replace(`/${next}`);
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="truck-fast" size={22} color={colors.onPrimary} />
          </View>
          <Text variant="title">{t('appName')}</Text>
        </View>
        <LanguageButton />
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <Text variant="hero" color={colors.onPrimary}>
          {t('welcome.tagline')}
        </Text>
        <Text color={colors.onPrimary} style={{ opacity: 0.9 }}>
          {t('welcome.subtitle')}
        </Text>
        <View style={styles.heroIcons}>
          {(['van-utility', 'truck', 'truck-trailer'] as const).map((name) => (
            <View key={name} style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <MaterialCommunityIcons
                name={name}
                size={30}
                color={colors.onPrimary}
                style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </View>
          ))}
        </View>
      </View>

      <Text variant="subtitle">{t('welcome.chooseRole')}</Text>

      {ROLE_OPTIONS.map(({ role: option, icon }) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          onPress={() => choose(option)}
          style={({ pressed }) => [
            styles.roleCard,
            { backgroundColor: colors.surface, borderColor: pressed ? colors.primary : colors.border },
          ]}>
          <View
            style={[
              styles.roleIcon,
              { backgroundColor: option === 'client' ? colors.accentSoft : colors.primarySoft },
            ]}>
            <MaterialCommunityIcons
              name={icon}
              size={28}
              color={option === 'client' ? colors.accent : colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{t(ROLE_KEYS[option][0])}</Text>
            <Text variant="caption" muted>
              {t(ROLE_KEYS[option][1])}
            </Text>
          </View>
          <ForwardChevron color={colors.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  heroIcons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  heroIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  roleIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
