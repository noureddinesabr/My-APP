import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { agreeRules } from '@/backend/actions';
import { useStore } from '@/backend';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { Text } from '@/components/text';
import { Button, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/theme';

export const RULES = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6', 'rule7', 'rule8', 'rule9', 'rule10', 'rule11'];

/**
 * «Our promises to each other»: the 11 rules a driver reads once before taking loads (Xapp
 * Simple). Gentle and fair: no fines, warnings or suspensions anywhere.
 */
export default function DriverRules() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { record } = useDriverRecord();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/driver'));
  return (
    <Screen
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={leave} />
          <Text variant="subtitle" style={{ flex: 1 }}>
            {t('rules.title')}
          </Text>
        </View>
      }
      footer={
        record?.rulesAt ? undefined : (
          <Button
            title={t('rules.agree')}
            variant="accent"
            icon="checkmark-circle"
            sound="success"
            disabled={!record}
            onPress={async () => {
              if (!record) return;
              await agreeRules(store, record.id);
              leave();
            }}
          />
        )
      }>
      <Text muted>{t('rules.sub')}</Text>
      {RULES.map((rule, index) => (
        <View key={rule} style={[styles.rule, { backgroundColor: colors.surface, borderColor: colors.rim }]}>
          <View style={[styles.number, { backgroundColor: colors.primaryFill }]}>
            <Text variant="label" color={colors.onPrimary}>
              {index + 1}
            </Text>
          </View>
          <Text style={{ flex: 1 }}>{t(`rules.${rule}`)}</Text>
        </View>
      ))}
      <View style={styles.terms}>
        <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.textMuted} />
        <Text variant="caption" muted style={{ flex: 1 }}>
          {t('rules.terms')}
        </Text>
      </View>
      {!!record?.rulesAt && (
        <Text variant="label" color={colors.success} center>
          ✓ {t('rules.agreed')}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  terms: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
