import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { LanguageButton } from '@/components/language-button';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { ForwardChevron, Gradient, Screen } from '@/components/ui';
import { vehicleImage } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { useRole, type Role } from '@/state/role';
import { Gradients, Radius, rim, Spacing, useColors } from '@/theme';

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
    <Screen glow>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Gradient colors={Gradients.primary} style={styles.logo}>
            <MaterialCommunityIcons name="truck-fast" size={22} color={colors.onPrimary} />
          </Gradient>
          <Text variant="title">{t('appName')}</Text>
        </View>
        <LanguageButton />
      </View>

      <Gradient colors={Gradients.hero} style={[styles.hero, rim(colors)]}>
        <Text variant="hero" color={colors.onHero}>
          {t('welcome.tagline')}
        </Text>
        <Text color={colors.onHeroMuted}>{t('welcome.subtitle')}</Text>
        <Image
          source={vehicleImage('semi')}
          style={[styles.heroImage, rtl && { transform: [{ scaleX: -1 }] }]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Gradient>

      <Text variant="subtitle">{t('welcome.chooseRole')}</Text>

      {ROLE_OPTIONS.map(({ role: option, icon }) => (
        <PressableScale
          key={option}
          accessibilityRole="button"
          scaleTo={0.97}
          feedback="medium"
          onPress={() => choose(option)}
          style={[styles.roleCard, { backgroundColor: colors.surface }, rim(colors)]}>
          <View style={[styles.roleIcon, { backgroundColor: option === 'client' ? colors.accentSoft : colors.primarySoft }]}>
            <MaterialCommunityIcons name={icon} size={28} color={option === 'client' ? colors.accent : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{t(ROLE_KEYS[option][0])}</Text>
            <Text variant="caption" muted>
              {t(ROLE_KEYS[option][1])}
            </Text>
          </View>
          <ForwardChevron color={colors.textMuted} />
        </PressableScale>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm, overflow: 'hidden' },
  heroImage: { width: '100%', height: 120, marginTop: Spacing.sm },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  roleIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
