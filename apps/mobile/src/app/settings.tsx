import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Segmented } from '@/components/segmented';
import { ForwardChevron, IconButton, Screen } from '@/components/ui';
import { useLanguage } from '@/i18n/language-provider';
import { LANGUAGE_NAMES } from '@/i18n/languages';
import { useRole } from '@/state/role';
import { useAccount } from '@/state/account';
import { useStore } from '@/backend';
import { onSoundSetting, play, setSoundEnabled, soundEnabled } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { Radius, rim, Spacing, useColors, useTheme } from '@/theme';

export default function Settings() {
  const { t } = useTranslation();
  const colors = useColors();
  const { language } = useLanguage();
  const { setRole } = useRole();
  const { client, driver, signOut } = useAccount();
  const store = useStore();
  const { appearance, setAppearance, highContrast, reduceTransparency, setPreference } = useTheme();
  const [soundOn, setSoundOn] = useState(soundEnabled());
  useEffect(() => onSoundSetting(setSoundOn), []);

  return (
    <Screen
      header={
        <View style={styles.titleRow}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="title">{t('settings.title')}</Text>
        </View>
      }>
      <View style={[styles.group, styles.padded, { backgroundColor: colors.surface }, rim(colors)]}>
        <Text variant="label">{t('settings.appearance')}</Text>
        <Segmented
          label={t('settings.appearance')}
          value={appearance}
          onChange={setAppearance}
          options={[
            { value: 'dark', label: t('settings.dark') },
            { value: 'light', label: t('settings.light') },
            { value: 'system', label: t('settings.automatic') },
          ]}
        />
        <Toggle
          icon="contrast-outline"
          label={t('settings.highContrast')}
          hint={t('settings.highContrastHint')}
          value={highContrast}
          onChange={(on) => setPreference('highContrast', on)}
        />
        <Toggle
          icon="layers-outline"
          label={t('settings.reduceTransparency')}
          hint={t('settings.reduceTransparencyHint')}
          value={reduceTransparency}
          onChange={(on) => setPreference('reduceTransparency', on)}
        />
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface }, rim(colors)]}>
        <Row icon="person-circle-outline" label={t('profile.title')} onPress={() => router.push('/profile')} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row
          icon={soundOn ? 'volume-high-outline' : 'volume-mute-outline'}
          label={t('settings.sound')}
          value={soundOn ? t('settings.on') : t('settings.off')}
          onPress={() => {
            setSoundEnabled(!soundOn);
            if (!soundOn) play('success');
          }}
        />
      </View>

      {(client || driver) && (
        <View style={[styles.group, { backgroundColor: colors.surface }, rim(colors)]}>
          {client && (
            <Row icon="log-out-outline" label={t('settings.signOutClient')} value={client.phone} onPress={() => signOut('client')} />
          )}
          {client && driver && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          {driver && (
            <Row icon="log-out-outline" label={t('settings.signOutDriver')} value={driver.phone} onPress={() => signOut('driver')} />
          )}
        </View>
      )}

      <Text variant="caption" muted>
        {t(store.kind === 'shared' ? 'settings.dataShared' : 'settings.dataLocal')}
      </Text>
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

function Toggle({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.toggle}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" muted>
          {hint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={(on) => {
          haptic('selection');
          onChange(on);
        }}
        trackColor={{ false: colors.control, true: colors.primaryFill }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { padding: Spacing.lg, gap: Spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  group: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  divider: { height: 1, marginStart: Spacing.lg + 22 + Spacing.md },
});
