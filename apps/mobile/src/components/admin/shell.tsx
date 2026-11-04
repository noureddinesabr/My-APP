import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useQuery } from '@/backend';
import { useAdmin } from '@/components/admin/session';
import { Tag } from '@/components/ds';
import { LanguageButton } from '@/components/language-button';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** The admin sections in the sidebar, grouped as in Doc 5 C2. */
export const ADMIN_NAV: { group: string; items: { key: string; icon: IconName }[] }[] = [
  { group: 'monitor', items: [{ key: 'overview', icon: 'view-dashboard-outline' }, { key: 'map', icon: 'map-outline' }, { key: 'active', icon: 'truck-fast-outline' }] },
  {
    group: 'marketplace',
    items: [
      { key: 'requests', icon: 'bullhorn-outline' },
      { key: 'routes', icon: 'map-marker-path' },
      { key: 'bookings', icon: 'clipboard-text-outline' },
      { key: 'shared', icon: 'account-multiple-outline' },
      { key: 'returns', icon: 'backup-restore' },
      { key: 'disputes', icon: 'alert-octagon-outline' },
    ],
  },
  { group: 'people', items: [{ key: 'drivers', icon: 'card-account-details-outline' }, { key: 'customers', icon: 'account-group-outline' }, { key: 'vehicles', icon: 'truck-check-outline' }] },
  {
    group: 'finance',
    items: [
      { key: 'invoices', icon: 'receipt-text-outline' },
      { key: 'payments', icon: 'cash-check' },
      { key: 'commission', icon: 'percent-outline' },
      { key: 'reports', icon: 'chart-line' },
    ],
  },
  {
    group: 'system',
    items: [
      { key: 'policies', icon: 'scale-balance' },
      { key: 'company', icon: 'domain' },
      { key: 'notifications', icon: 'bell-cog-outline' },
      { key: 'audit', icon: 'history' },
      { key: 'admins', icon: 'shield-account-outline' },
    ],
  },
];

const hrefOf = (key: string) => (key === 'overview' ? '/admin' : `/admin/${key}`) as Href;

/**
 * Desktop-first admin layout (Doc 5 C1): sidebar navigation on the reading-start side, a top
 * bar with search, open disputes, language and the signed-in administrator, and the page.
 * Under 900 px the sidebar folds into a menu button.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [menu, setMenu] = useState(false);
  const { session, signOut } = useAdmin();
  const disputes = useQuery('disputes', [['status', 'open']]);
  const current = pathname === '/admin' ? 'overview' : pathname.replace('/admin/', '').split('/')[0];

  const nav = (
    <ScrollView style={[styles.sidebar, { backgroundColor: colors.hero }]} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primaryFill }]}>
          <Text variant="label" color={colors.onPrimary}>
            X
          </Text>
        </View>
        <Text variant="label" color={colors.onHero}>
          {t('admin2.brand')}
        </Text>
      </View>
      {ADMIN_NAV.map((group) => (
        <View key={group.group} style={{ gap: 2 }}>
          <Text variant="caption" color={colors.onHeroMuted} style={styles.group}>
            {t(`admin2.group_${group.group}`)}
          </Text>
          {group.items.map((item) => {
            const active = current === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setMenu(false);
                  router.push(hrefOf(item.key));
                }}
                style={[styles.navItem, active && { backgroundColor: colors.heroControl }]}>
                <MaterialCommunityIcons name={item.icon} size={20} color={colors.onHero} />
                <Text variant="caption" color={colors.onHero} style={[styles.navLabel, active && { fontFamily: Fonts.bold }]}>
                  {t(`admin2.nav_${item.key}`)}
                </Text>
                {item.key === 'disputes' && !!disputes?.length && (
                  <View style={[styles.count, { backgroundColor: colors.accentFill }]}>
                    <Text variant="caption" color={colors.onPrimary} style={styles.countText}>
                      {disputes.length}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={styles.navItem}>
        <MaterialCommunityIcons name="cellphone" size={20} color={colors.onHeroMuted} />
        <Text variant="caption" color={colors.onHeroMuted} style={styles.navLabel}>
          {t('admin2.backToApp')}
        </Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {desktop && nav}
      <View style={{ flex: 1 }}>
        <View style={[styles.topbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {!desktop && (
            <PressableScale accessibilityRole="button" accessibilityLabel={t('admin2.menu')} onPress={() => setMenu(true)} style={styles.menuButton}>
              <MaterialCommunityIcons name="menu" size={24} color={colors.text} />
            </PressableScale>
          )}
          <Text variant="label" style={{ flex: 1 }}>
            {t(`admin2.nav_${current}`, { defaultValue: t('admin2.brand') })}
          </Text>
          <Tag icon="flask-outline" tone="gold" label={t('ds.prototype')} />
          {!!disputes?.length && (
            <Pressable accessibilityRole="link" onPress={() => router.push('/admin/disputes')}>
              <Tag icon="alert-octagon-outline" tone="red" label={t('admin2.openDisputes', { count: disputes.length })} />
            </Pressable>
          )}
          <LanguageButton />
          <View style={[styles.who, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="shield-account" size={18} color={colors.primary} />
            <Text variant="caption">
              {session?.name} · {t(`admin2.role_${session?.role}`)}
            </Text>
          </View>
          <Button compact variant="ghost" icon="log-out-outline" title={t('account.signOut')} onPress={signOut} />
        </View>
        <ScrollView contentContainerStyle={[styles.page, desktop && styles.pageDesktop]}>{children}</ScrollView>
      </View>
      {!desktop && menu && (
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => setMenu(false)} accessibilityLabel={t('common.close')}>
          <View style={styles.drawer}>{nav}</View>
        </Pressable>
      )}
    </View>
  );
}

/** A page title with an optional action, then the page body. */
export function AdminPage({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.pageHead}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text variant="title" style={styles.pageTitle}>
            {title}
          </Text>
          {!!subtitle && <Text muted>{subtitle}</Text>}
        </View>
        {actions}
      </View>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      {children}
    </View>
  );
}

/** A white panel with a title for grouping a table, a chart or a form on admin pages. */
export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }, rim(colors)]}>
      {(title || action) && (
        <View style={styles.panelHead}>
          {!!title && (
            <Text variant="label" style={{ flex: 1 }}>
              {title}
            </Text>
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 248, flexGrow: 0 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  logo: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  group: { textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8, fontFamily: Fonts.semibold, paddingHorizontal: Spacing.sm },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: Radius.sm },
  navLabel: { flex: 1, fontSize: 14 },
  count: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { fontSize: 11, lineHeight: 13, fontFamily: Fonts.bold },
  topbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  page: { padding: Spacing.lg, gap: Spacing.md },
  pageDesktop: { padding: Spacing.xl, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  pageHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md },
  pageTitle: { fontSize: 26, lineHeight: 34 },
  rule: { height: StyleSheet.hairlineWidth },
  panel: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  drawer: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 260 },
});
