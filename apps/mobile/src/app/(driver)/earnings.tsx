import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import { normalizeJob } from '@/backend/actions';
import { useDateFormat } from '@/components/date-format';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { InfoRow, ListRow, PageHeader, PrototypeNote, SectionHeader, Stat, StateView } from '@/components/ds';
import { InvoiceRow } from '@/components/invoice-parts';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { Card, Screen } from '@/components/ui';
import { weekKey, weekRange } from '@/lib/invoices';
import { useAccount } from '@/state/account';
import { Spacing, useColors } from '@/theme';

/**
 * Earnings tab (Doc 2 §4, Doc 5 D34): an accounting view, NOT a wallet — revenue from completed
 * trips, cash collected, app share accrued this week, outstanding invoices, the last invoice and
 * when the next one comes. Nothing is ever topped up or deducted here.
 */
export default function Earnings() {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const { driver } = useAccount();
  const rawJobs = useQuery('jobs', driver ? [['driverId', driver.id]] : null);
  const bookings = useQuery('bookings', driver ? [['driverId', driver.id]] : null);
  const { invoices, thisWeek, unpaid, owed, company, now } = useDriverInvoices(driver);
  if (!driver)
    return (
      <Screen header={<PageHeader title={t('tabs.earnings')} />}>
        <StateView state="empty" title={t('driver.signInTitle')} action={t('driver.signIn')} onAction={() => router.push({ pathname: '/login', params: { role: 'driver' } })} />
      </Screen>
    );
  const done = (rawJobs ?? []).map(normalizeJob).filter((j) => j.status === 'completed');
  const gross = done.reduce((sum, j) => sum + j.price, 0);
  const routeCash = (bookings ?? []).filter((b) => b.payment === 'cashConfirmed').reduce((sum, b) => sum + b.price, 0);
  const paid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.totalShare, 0);
  const last = invoices[0];
  const next = weekRange(weekKey(now)).end;

  return (
    <Screen header={<PageHeader title={t('tabs.earnings')} />}>
      <View style={styles.stats}>
        <Stat label={t('earnings.gross')} value={formatMoney(t, gross)} />
        <Stat label={t('earnings.cash')} value={formatMoney(t, gross)} tone={colors.success} />
        <Stat label={t('earnings.accrued')} value={formatMoney(t, thisWeek.share)} tone={colors.primary} />
        <Stat label={t('earnings.outstanding')} value={formatMoney(t, owed)} tone={owed ? colors.accent : colors.text} />
      </View>
      <Card>
        <InfoRow label={t('earnings.rate')} value={`${Math.round(company.commissionRate * 100)}%`} />
        <InfoRow label={t('earnings.paidTotal')} value={formatMoney(t, paid)} />
        <InfoRow label={t('earnings.nextInvoice')} value={dates.dayMonth(next)} />
        <Text variant="caption" muted>
          {t('earnings.notWallet')}
        </Text>
      </Card>
      {routeCash > 0 && (
        <Card>
          <InfoRow label={t('earnings.routeCash')} value={formatMoney(t, routeCash)} />
          <PrototypeNote inline />
        </Card>
      )}
      <SectionHeader title={t('earnings.lastInvoice')} action={t('home2.seeAll')} onAction={() => router.push('/invoices')} />
      {last ? <InvoiceRow invoice={last} terms={company} now={now} /> : <StateView state="empty" compact title={t('invoice.none')} />}
      <ListRow icon="receipt" title={t('invoice.listTitle')} subtitle={unpaid.length ? t('invoice.toPay', { amount: formatMoney(t, owed) }) : undefined} onPress={() => router.push('/invoices')} />
      <ListRow icon="history" title={t('payments.title')} onPress={() => router.push('/payments')} />
      <ListRow icon="bank-outline" title={t('invoice.howToPay')} onPress={() => (last ? router.push({ pathname: '/invoice/[id]', params: { id: last.id } }) : router.push('/invoices'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
