import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ListRow, SectionHeader, Tag } from '@/components/ds';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Button } from '@/components/ui';
import { LANGUAGE_NAMES } from '@/i18n/languages';
import { useLanguage } from '@/i18n/language-provider';
import { useAccount } from '@/state/account';
import { useRole } from '@/state/role';
import { Radius, rim, Spacing, useColors } from '@/theme';

type Item = { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; href: Href; value?: string };

/**
 * The account page shared by the customer (Account tab) and driver (Profile tab): who is signed
 * in, the role's own items, then language, settings, notifications, help and legal, switching
 * role and signing out. One list, no second menu elsewhere.
 */
export function AccountMenu({ items, extra }: { items: Item[]; extra?: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { side, account, driverRecord, clientRecord } = useMyRecord();
  const { signOut } = useAccount();
  const { setRole } = useRole();
  const { language } = useLanguage();
  const rating = side === 'driver' ? driverRecord?.rating : clientRecord?.rating;
  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.hero }, rim(colors)]}>
        <View style={[styles.avatar, { backgroundColor: colors.heroControl }]}>
          <Text variant="title" color={colors.onHero}>
            {(account?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subtitle" color={colors.onHero}>
            {account?.name ?? t('account.guest')}
          </Text>
          <Text variant="caption" color={colors.onHeroMuted}>
            {account?.phone ?? t('account.notSignedIn')}
          </Text>
          {rating !== undefined && (
            <Text variant="caption" color={colors.onHeroMuted}>
              ★ {rating.toFixed(1)}
            </Text>
          )}
        </View>
        {account ? (
          <Button compact variant="ghost" title={t('account.edit')} onPress={() => router.push('/profile')} />
        ) : (
          <Button compact variant="primary" title={t('driver.signIn')} onPress={() => router.push({ pathname: '/login', params: { role: side } })} />
        )}
      </View>
      {extra}
      {items.map((item) => (
        <ListRow key={item.label} icon={item.icon} title={item.label} subtitle={item.value} onPress={() => router.push(item.href)} />
      ))}
      <SectionHeader title={t('account.preferences')} />
      <ListRow icon="translate" title={t('settings.language')} subtitle={LANGUAGE_NAMES[language]} onPress={() => router.push('/language')} />
      <ListRow icon="bell-outline" title={t('notif.title')} onPress={() => router.push('/notifications')} />
      <ListRow icon="cog-outline" title={t('menu.settings')} onPress={() => router.push('/settings')} />
      <SectionHeader title={t('account.helpLegal')} />
      <ListRow icon="lifebuoy" title={t('help.title')} subtitle={t('help.subtitle')} onPress={() => router.push('/help')} />
      <ListRow icon="file-document-outline" title={t('help.legal')} onPress={() => router.push({ pathname: '/help', params: { section: 'legal' } })} />
      <ListRow
        icon="swap-horizontal"
        title={side === 'driver' ? t('menu.switchToClient') : t('menu.switchToDriver')}
        onPress={() => {
          const next = side === 'driver' ? 'client' : 'driver';
          setRole(next);
          router.replace(`/${next}`);
        }}
      />
      {account && <Button variant="outline" icon="log-out-outline" title={t('account.signOut')} onPress={() => signOut(side)} />}
      <View style={{ alignItems: 'center' }}>
        <Tag icon="information-outline" tone="neutral" label={t('account.version')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
