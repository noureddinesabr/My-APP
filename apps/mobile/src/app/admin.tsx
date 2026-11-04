import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { issueInvoices, normalizeJob, saveCompanySettings } from '@/backend/actions';
import { useQuery, useStore } from '@/backend';
import type { CompanySettings, Invoice } from '@/backend/types';
import { InvoiceRow } from '@/components/invoice-parts';
import { formatMoney } from '@/components/money';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { useCompany } from '@/components/use-company';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { invoiceState } from '@/lib/invoices';
import { Radius, Spacing, useColors } from '@/theme';

type Tab = 'invoices' | 'company';

/**
 * The operating company's desk: drivers' weekly invoices (confirm payments that arrived) and
 * the company's own details and terms. Open to anyone in this test build; real sign-in with
 * an admin role comes with the hosted backend.
 */
export default function Admin() {
  const { t } = useTranslation();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('invoices');
  return (
    <Screen
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Text variant="title" style={{ flex: 1 }}>
            {t('admin.title')}
          </Text>
        </View>
      }>
      <View style={[styles.test, { backgroundColor: `${colors.star}1F`, borderColor: `${colors.star}66` }]}>
        <MaterialCommunityIcons name="flask-outline" size={18} color={colors.star} />
        <Text variant="caption" style={{ flex: 1 }}>
          {t('admin.testAccess')}
        </Text>
      </View>
      <Segmented
        label={t('admin.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'invoices', label: t('admin.tabInvoices') },
          { value: 'company', label: t('admin.tabCompany') },
        ]}
      />
      {tab === 'invoices' ? <InvoicesDesk /> : <CompanyForm />}
    </Screen>
  );
}

function InvoicesDesk() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { company } = useCompany();
  const invoices = useQuery('invoices', []);
  const jobs = useQuery('jobs', []);
  const drivers = useQuery('drivers', []);
  const [issuing, setIssuing] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const list = [...(invoices ?? [])].sort((a, b) => b.issuedAt - a.issuedAt);
  const groups: { key: string; title: string; items: Invoice[] }[] = [
    { key: 'check', title: t('admin.toConfirm'), items: list.filter((i) => i.status === 'paymentSent') },
    { key: 'unpaid', title: t('admin.unpaid'), items: list.filter((i) => i.status === 'open') },
    { key: 'paid', title: t('admin.paid'), items: list.filter((i) => i.status === 'paid') },
  ];
  const sum = (items: Invoice[]) => items.reduce((total, i) => total + i.totalShare, 0);
  const overdue = list.filter((i) => ['overdue', 'paused'].includes(invoiceState(i, now, company)));

  const issueAll = async () => {
    if (!jobs || !drivers) return;
    setIssuing(-1);
    let count = 0;
    try {
      for (const driver of drivers) {
        const theirs = jobs.filter((job) => job.driverId === driver.id).map(normalizeJob);
        count += (await issueInvoices(store, driver, theirs)).length;
      }
    } finally {
      setIssuing(count);
    }
  };

  return (
    <>
      <View style={styles.stats}>
        <Stat label={t('admin.billed')} value={formatMoney(t, sum(list))} tone={colors.primary} />
        <Stat label={t('admin.received')} value={formatMoney(t, sum(groups[2].items))} tone={colors.success} />
        <Stat label={t('admin.outstanding')} value={formatMoney(t, sum(groups[0].items) + sum(groups[1].items))} tone={colors.star} />
        <Stat label={t('admin.overdue')} value={String(overdue.length)} tone={colors.accent} />
      </View>
      <Button variant="ghost" icon="receipt-outline" title={t('admin.issueNow')} disabled={issuing === -1} onPress={issueAll} />
      {issuing !== null && issuing >= 0 && (
        <Text variant="caption" muted center>
          {t('admin.issued', { count: issuing })}
        </Text>
      )}
      {invoices && list.length === 0 && (
        <Text muted center>
          {t('admin.noInvoices')}
        </Text>
      )}
      {groups
        .filter((group) => group.items.length)
        .map((group) => (
          <View key={group.key} style={{ gap: Spacing.sm }}>
            <Text variant="subtitle">
              {group.title} · {formatMoney(t, sum(group.items))}
            </Text>
            {group.items.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} terms={company} now={now} admin />
            ))}
          </View>
        ))}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: `${tone}1A`, borderColor: `${tone}55` }]}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="subtitle" color={tone === colors.star ? colors.text : tone}>
        {value}
      </Text>
    </View>
  );
}

const TEXT_FIELDS: (keyof CompanySettings)[] = ['tradeName', 'legalName', 'legalForm', 'ice', 'rc', 'taxId', 'address', 'city', 'phone', 'email', 'bankName', 'rib', 'payInstructions'];

function CompanyForm() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { company, loaded } = useCompany();
  const [draft, setDraft] = useState<CompanySettings | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!loaded) return null;
  const value = draft ?? company;
  const rateText = rate ?? String(Math.round(value.commissionRate * 1000) / 10);
  const rateNumber = Number(rateText.replace(',', '.'));
  const rateOk = Number.isFinite(rateNumber) && rateNumber >= 0 && rateNumber <= 30;
  const set = (patch: Partial<CompanySettings>) => {
    setSaved(false);
    setDraft({ ...value, ...patch });
  };
  const days = (text: string) => Math.max(0, Math.min(60, Math.round(Number(text.replace(/[^0-9]/g, '')) || 0)));

  return (
    <>
      <Card>
        <Text variant="label">{t('admin.identityTitle')}</Text>
        <Text variant="caption" muted>
          {t('admin.identityBody')}
        </Text>
        {TEXT_FIELDS.map((key) => (
          <View key={key} style={{ gap: 4 }}>
            <Text variant="caption">{t(`admin.field_${key}`)}</Text>
            <TextInput
              value={String(value[key] ?? '')}
              onChangeText={(text) => set({ [key]: text } as Partial<CompanySettings>)}
              multiline={key === 'payInstructions' || key === 'address'}
              autoCapitalize={key === 'email' ? 'none' : 'sentences'}
              keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
            />
          </View>
        ))}
      </Card>
      <Card>
        <Text variant="label">{t('admin.termsTitle')}</Text>
        <Text variant="caption">{t('admin.field_rate')}</Text>
        <TextInput
          value={rateText}
          keyboardType="decimal-pad"
          onChangeText={(text) => {
            setSaved(false);
            setRate(text);
          }}
        />
        {!rateOk && (
          <Text variant="caption" color={colors.accent}>
            {t('admin.rateInvalid')}
          </Text>
        )}
        <Text variant="caption" muted>
          {t('admin.rateNote')}
        </Text>
        <Text variant="caption">{t('admin.field_dueDays')}</Text>
        <TextInput value={String(value.dueDays)} keyboardType="number-pad" onChangeText={(text) => set({ dueDays: days(text) })} />
        <Text variant="caption">{t('admin.field_graceDays')}</Text>
        <TextInput value={String(value.graceDays)} keyboardType="number-pad" onChangeText={(text) => set({ graceDays: days(text) })} />
      </Card>
      <Button
        variant="accent"
        icon="save-outline"
        sound="success"
        title={t('admin.save')}
        disabled={!rateOk}
        onPress={async () => {
          await saveCompanySettings(store, { ...value, commissionRate: Math.round(rateNumber * 10) / 1000 });
          setDraft(null);
          setRate(null);
          setSaved(true);
        }}
      />
      {saved && (
        <Text variant="caption" center color={colors.success}>
          {t('admin.saved')}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  test: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexGrow: 1, flexBasis: '45%', padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: 2 },
});
