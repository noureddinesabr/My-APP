import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { issueInvoices } from '@/backend/actions';
import { useStore } from '@/backend';
import { useDateFormat } from '@/components/date-format';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { InvoiceRow } from '@/components/invoice-parts';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { useMyRecord } from '@/components/use-my-record';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { weekRange, weekKey } from '@/lib/invoices';
import { Radius, Spacing, useColors } from '@/theme';

/**
 * The driver's side of the cash model: no wallet and nothing to pay in advance. This week's
 * trips add up here, and every Monday the week becomes an invoice for the app's share.
 */
export default function Invoices() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const { account } = useMyRecord();
  const { invoices, thisWeek, unpaid, owed, company, now, paused, loaded } = useDriverInvoices(account);
  const [busy, setBusy] = useState(false);
  const rate = Math.round(company.commissionRate * 100);
  const nextMonday = weekRange(weekKey(now)).end;

  const closeNow = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await issueInvoices(store, account, thisWeek.jobs, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
          <Text variant="title">{t('invoice.listTitle')}</Text>
        </View>
      }>
      {!account ? (
        <Text muted center>
          {t('history.signIn')}
        </Text>
      ) : (
        <>
          <View style={[styles.week, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}55` }]}>
            <View style={styles.weekHead}>
              <MaterialCommunityIcons name="calendar-week" size={22} color={colors.primary} />
              <Text variant="label" color={colors.primary} style={{ flex: 1 }}>
                {t('invoice.thisWeek')}
              </Text>
            </View>
            <Text variant="display" color={colors.text}>
              {formatMoney(t, thisWeek.share)}
            </Text>
            <Text muted>
              {t('invoice.thisWeekBody', { count: thisWeek.trips, cash: formatMoney(t, thisWeek.price), rate })}
            </Text>
            <Text variant="caption" color={colors.primary}>
              {t('invoice.nextInvoice', { date: dates.dayMonth(nextMonday) })}
            </Text>
          </View>

          <Card>
            <View style={styles.weekHead}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.success} />
              <Text variant="label" style={{ flex: 1 }}>
                {t('invoice.howTitle')}
              </Text>
            </View>
            <Text muted>{t('invoice.howBody', { rate })}</Text>
          </Card>

          {paused && (
            <Card>
              <Text variant="label" color={colors.accent}>
                {t('invoice.pausedTitle')}
              </Text>
              <Text muted>{t('invoice.pausedBody')}</Text>
            </Card>
          )}

          {unpaid.length > 0 && (
            <Text variant="subtitle">{t('invoice.toPay', { amount: formatMoney(t, owed) })}</Text>
          )}
          {loaded && invoices.length === 0 && (
            <Text muted center>
              {t('invoice.none')}
            </Text>
          )}
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} terms={company} now={now} />
          ))}

          {thisWeek.trips > 0 && (
            <View style={{ gap: Spacing.xs }}>
              <Button variant="ghost" icon="flask-outline" title={t('invoice.testClose')} disabled={busy} onPress={closeNow} />
              <Text variant="caption" muted center>
                {t('invoice.testCloseHint')}
              </Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  week: { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.lg, gap: Spacing.xs },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
