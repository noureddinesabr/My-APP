import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { confirmInvoicePaid, rejectInvoicePayment, reportInvoicePayment } from '@/backend/actions';
import { useDoc, useStore } from '@/backend';
import type { Invoice } from '@/backend/types';
import { canBePaid, missingLegalDetails } from '@/constants/company';
import { useDateFormat } from '@/components/date-format';
import { StatePill, useInvoicePeriod } from '@/components/invoice-parts';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { useCompany } from '@/components/use-company';
import { Button, Card, Chip, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { pausesAt } from '@/lib/invoices';
import { Radius, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * One weekly invoice: who bills whom, the trips of the week with the app's share of each,
 * the amount, how to pay it, and (for the driver) "I've paid" or (for the company) confirm.
 */
export default function InvoiceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id, as } = useLocalSearchParams<{ id: string; as?: string }>();
  const admin = as === 'admin';
  const doc = useDoc('invoices', id);
  const { company } = useCompany();

  return (
    <Screen
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="title" style={{ flex: 1 }}>
            {t('invoice.title')}
          </Text>
        </View>
      }>
      {doc === undefined ? null : doc === null ? (
        <Text muted center>
          {t('invoice.missing')}
        </Text>
      ) : (
        <Body invoice={doc} admin={admin} terms={company} />
      )}
    </Screen>
  );
}

function Body({ invoice, admin, terms }: { invoice: Invoice; admin: boolean; terms: { dueDays: number; graceDays: number } }) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const names = useLocationLabel();
  const period = useInvoicePeriod();
  const [now] = useState(() => Date.now());
  const firm = invoice.company;
  const missing = missingLegalDetails(firm);
  const rate = invoice.totalPrice ? Math.round((invoice.totalShare / invoice.totalPrice) * 100) : 0;

  return (
    <>
      <View style={[styles.hero, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}55` }]}>
        <Text variant="caption" color={colors.primary}>
          {invoice.number}
          {invoice.test ? ` · ${t('invoice.testTag')}` : ''}
        </Text>
        <Text variant="caption" muted>
          {t('invoice.amountDue')}
        </Text>
        <Text variant="display">{formatMoney(t, invoice.totalShare)}</Text>
        <StatePill invoice={invoice} terms={terms} now={now} />
        <Text variant="caption" muted>
          {t('invoice.period', { period: period(invoice) })} · {t('invoice.dueOn', { date: dates.dayMonth(invoice.dueAt) })}
        </Text>
        {invoice.status === 'open' && (
          <Text variant="caption" muted>
            {t('invoice.pauseRule', { date: dates.dayMonth(pausesAt(invoice, terms)) })}
          </Text>
        )}
      </View>

      <Card>
        <Section icon="domain" title={t('invoice.from')} />
        {firm.legalName || firm.tradeName ? (
          <>
            <Text variant="label">{[firm.tradeName, firm.legalName].filter(Boolean).join(' · ')}</Text>
            {firm.legalForm ? <Text muted>{firm.legalForm}</Text> : null}
            {firm.address ? <Text muted>{[firm.address, firm.city].filter(Boolean).join(', ')}</Text> : null}
            <Field label="ICE" value={firm.ice} />
            <Field label="RC" value={firm.rc} />
            <Field label="IF" value={firm.taxId} />
          </>
        ) : null}
        {missing.length > 0 && (
          <View style={[styles.warn, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}66` }]}>
            <MaterialCommunityIcons name="alert-outline" size={20} color={colors.accent} />
            <Text variant="caption" style={{ flex: 1 }}>
              {t('invoice.draftWarning')}
            </Text>
          </View>
        )}
        <Section icon="account" title={t('invoice.to')} />
        <Text variant="label">{invoice.driverName}</Text>
        <Text muted>{invoice.driverPhone}</Text>
      </Card>

      <Card>
        <Section icon="truck-check" title={t('invoice.tripsTitle', { count: invoice.lines.length })} />
        {invoice.lines.map((line) => (
          <View key={line.jobId} style={[styles.line, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{names.shortRoute(line.from, line.to)}</Text>
              <Text variant="caption" muted>
                {dates.dayMonth(line.completedAt)} · {t('invoice.cashTrip', { amount: formatMoney(t, line.price) })}
              </Text>
            </View>
            <Text variant="label" color={colors.primary}>
              {formatMoney(t, line.share)}
            </Text>
          </View>
        ))}
        <Total label={t('invoice.cashTotal')} value={formatMoney(t, invoice.totalPrice)} />
        <Total label={t('invoice.shareTotal', { rate })} value={formatMoney(t, invoice.totalShare)} strong />
        <Text variant="caption" muted>
          {t('invoice.taxNote')}
        </Text>
      </Card>

      <HowToPay invoice={invoice} />
      {admin ? <AdminActions invoice={invoice} /> : <DriverActions invoice={invoice} />}
    </>
  );
}

function Section({ icon, title }: { icon: IconName; title: string }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text variant="caption" color={colors.primary} style={{ flex: 1 }}>
        {title}
      </Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  return (
    <Text variant="caption" muted>
      {label}: {value || t('invoice.notSet')}
    </Text>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.total}>
      <Text variant={strong ? 'label' : 'body'} muted={!strong} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'subtitle' : 'label'} color={strong ? colors.primary : undefined}>
        {value}
      </Text>
    </View>
  );
}

function HowToPay({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const colors = useColors();
  const firm = invoice.company;
  if (invoice.status === 'paid') return null;
  return (
    <Card>
      <Section icon="bank-transfer" title={t('invoice.howToPay')} />
      {canBePaid(firm) ? (
        <>
          {firm.rib ? (
            <>
              <Text variant="caption" muted>
                {t('invoice.transferTo', { bank: firm.bankName || t('invoice.bank') })}
              </Text>
              <Text variant="label" selectable style={styles.rib}>
                {firm.rib}
              </Text>
              <Text variant="caption" muted>
                {t('invoice.referenceHint', { number: invoice.number })}
              </Text>
            </>
          ) : null}
          {firm.payInstructions ? <Text userText>{firm.payInstructions}</Text> : null}
        </>
      ) : (
        <Text variant="caption" color={colors.accent}>
          {t('invoice.noPayDetails')}
        </Text>
      )}
    </Card>
  );
}

function DriverActions({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const [method, setMethod] = useState<'transfer' | 'cash'>('transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  if (invoice.status === 'paid')
    return (
      <Card>
        <Text variant="label" color={colors.success}>
          {t('invoice.paidOn', { date: dates.dayMonth(invoice.paidAt ?? invoice.issuedAt) })}
        </Text>
      </Card>
    );
  if (invoice.status === 'paymentSent')
    return (
      <Card>
        <Text variant="label" color={colors.location}>
          {t('invoice.checking')}
        </Text>
        <Text muted>{t('invoice.checkingBody', { reference: invoice.paymentReference || '—' })}</Text>
      </Card>
    );

  return (
    <Card>
      <Section icon="check-circle-outline" title={t('invoice.paidQuestion')} />
      {invoice.rejectedAt ? (
        <Text variant="caption" color={colors.accent}>
          {t('invoice.rejectedBody')}
        </Text>
      ) : null}
      <View style={styles.chips}>
        <Chip label={t('invoice.methodTransfer')} selected={method === 'transfer'} onPress={() => setMethod('transfer')} />
        <Chip label={t('invoice.methodCash')} selected={method === 'cash'} onPress={() => setMethod('cash')} />
      </View>
      <TextInput value={reference} onChangeText={setReference} placeholder={t('invoice.referencePlaceholder')} />
      <Button
        variant="accent"
        icon="checkmark-done"
        sound="send"
        title={t('invoice.iPaid', { amount: formatMoney(t, invoice.totalShare) })}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await reportInvoicePayment(store, invoice, method, reference);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Text variant="caption" muted center>
        {t('invoice.iPaidHint')}
      </Text>
    </Card>
  );
}

function AdminActions({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  if (invoice.status === 'paid')
    return (
      <Card>
        <Text variant="label" color={colors.success}>
          {t('invoice.paidOn', { date: dates.dayMonth(invoice.paidAt ?? invoice.issuedAt) })}
        </Text>
      </Card>
    );
  return (
    <Card>
      <Section icon="shield-check" title={t('admin.confirmTitle')} />
      {invoice.status === 'paymentSent' ? (
        <Text muted>
          {t('admin.reported', {
            method: t(invoice.paymentMethod === 'cash' ? 'invoice.methodCash' : 'invoice.methodTransfer'),
            reference: invoice.paymentReference || '—',
            date: dates.dayMonth(invoice.paymentSentAt ?? invoice.issuedAt),
          })}
        </Text>
      ) : (
        <Text muted>{t('admin.notReported')}</Text>
      )}
      <Button variant="accent" icon="checkmark-circle" sound="success" title={t('admin.markPaid')} onPress={() => confirmInvoicePaid(store, invoice)} />
      {invoice.status === 'paymentSent' && (
        <Button variant="ghost" icon="close-circle-outline" sound="error" title={t('admin.notReceived')} onPress={() => rejectInvoicePayment(store, invoice)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  hero: { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.lg, gap: Spacing.xs, alignItems: 'flex-start' },
  section: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  warn: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, alignItems: 'flex-start' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  total: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rib: { letterSpacing: 1 },
  chips: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
});
