import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStore } from '@/backend';
import { raiseDispute } from '@/backend/prototype';
import { FilterChips, FormField, PageHeader, PrototypeNote, SectionHeader, StateView } from '@/components/ds';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Button, Card, Screen } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/theme';

const FAQ = ['cash', 'cancel', 'share', 'invoice', 'safety'] as const;
const LEGAL = ['terms', 'privacy', 'cancellation', 'cash'] as const;

/**
 * Help and complaints (Doc 5 C28 / D46): answers to common questions, a complaint form that
 * opens a case for the operations team (with an optional booking reference) and the legal
 * pages. Complaints in the prototype go to the admin desk's Disputes list.
 */
export default function Help() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { side, account } = useMyRecord();
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<'damage' | 'late' | 'cash' | 'invoice' | 'other'>('other');
  const [ref, setRef] = useState('');
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const textError = text.trim().length < 10 ? t('help.errText') : null;
  const refError = ref && !/^[A-Z]{2}-[A-Z0-9-]+$/i.test(ref.trim()) ? t('help.errRef') : null;

  const submit = async () => {
    setTried(true);
    if (textError || refError) return;
    await raiseDispute(store, { ref: ref.trim().toUpperCase() || '—', raisedBy: side === 'driver' ? 'driver' : 'customer', raisedByName: account?.name ?? t('account.guest'), kind, text: text.trim() });
    setSent(true);
    setText('');
    setRef('');
    setTried(false);
  };

  return (
    <Screen header={<PageHeader title={section === 'legal' ? t('help.legal') : t('help.title')} onBack={() => router.back()} />}>
      {section !== 'legal' && (
        <>
          <SectionHeader title={t('help.faq')} />
          {FAQ.map((key) => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ expanded: open === key }} onPress={() => setOpen(open === key ? null : key)} style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.faqHead}>
                <Text variant="label" style={{ flex: 1 }}>
                  {t(`help.q_${key}`)}
                </Text>
                <MaterialCommunityIcons name={open === key ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
              </View>
              {open === key && <Text variant="caption" muted>{t(`help.a_${key}`)}</Text>}
            </Pressable>
          ))}

          <SectionHeader title={t('help.complaint')} />
          {sent ? (
            <StateView state="success" title={t('help.sent')} body={t('help.sentBody')} action={t('help.another')} onAction={() => setSent(false)} />
          ) : (
            <Card>
              <Text variant="caption">{t('help.kind')}</Text>
              <FilterChips value={kind} onChange={setKind} options={(['damage', 'late', 'cash', 'invoice', 'other'] as const).map((value) => ({ value, label: t(`dispute.${value}`) }))} />
              <FormField label={t('help.ref')} placeholder="XB-261104-A1B2" value={ref} onChangeText={setRef} hint={t('help.refHint')} error={tried ? refError : null} />
              <FormField label={t('help.what')} value={text} onChangeText={setText} multiline required error={tried ? textError : null} />
              <Button variant="accent" icon="send" title={t('help.send')} onPress={submit} />
            </Card>
          )}
        </>
      )}
      <SectionHeader title={t('help.legal')} />
      {LEGAL.map((key) => (
        <Card key={key}>
          <Text variant="label">{t(`help.legal_${key}`)}</Text>
          <Text variant="caption" muted>
            {t(`help.legal_${key}Body`)}
          </Text>
        </Card>
      ))}
      <PrototypeNote text={t('help.prototype')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  faq: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
