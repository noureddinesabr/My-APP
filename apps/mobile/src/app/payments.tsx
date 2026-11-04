import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useDateFormat } from '@/components/date-format';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { ListRow, PageHeader, StateView, StatusBadge } from '@/components/ds';
import { formatMoney } from '@/components/money';
import { Screen } from '@/components/ui';
import { useAccount } from '@/state/account';

/** Payment history (Doc 5 D38): every payment reported and every payment the company verified. */
export default function Payments() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { driver } = useAccount();
  const { invoices, loaded } = useDriverInvoices(driver);
  const payments = invoices.filter((i) => i.status !== 'open').sort((a, b) => (b.paidAt ?? b.paymentSentAt ?? 0) - (a.paidAt ?? a.paymentSentAt ?? 0));
  return (
    <Screen header={<PageHeader title={t('payments.title')} onBack={() => router.back()} />}>
      {!loaded ? (
        <StateView state="loading" />
      ) : payments.length === 0 ? (
        <StateView state="empty" title={t('payments.empty')} />
      ) : (
        payments.map((invoice) => (
          <ListRow
            key={invoice.id}
            icon={invoice.status === 'paid' ? 'cash-check' : 'progress-clock'}
            title={`${invoice.number} · ${formatMoney(t, invoice.totalShare)}`}
            subtitle={`${t(invoice.paymentMethod === 'cash' ? 'invoice.methodCash' : 'invoice.methodTransfer')} · ${invoice.paymentReference || '—'} · ${dates.dayMonth(invoice.paidAt ?? invoice.paymentSentAt ?? invoice.issuedAt)}`}
            right={<StatusBadge status={invoice.status === 'paid' ? 'paid' : 'pending'} label={t(`invoice.state_${invoice.status === 'paid' ? 'paid' : 'paymentSent'}`, { date: '' })} />}
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })}
          />
        ))
      )}
    </Screen>
  );
}
