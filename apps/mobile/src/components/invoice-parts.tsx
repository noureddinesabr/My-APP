import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Invoice } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { ForwardChevron } from '@/components/ui';
import { invoiceState, weekLastDay, weekRange, type InvoiceState, type InvoiceTerms } from '@/lib/invoices';
import { Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICONS: Record<InvoiceState, IconName> = {
  paid: 'check-decagram',
  paymentSent: 'progress-clock',
  due: 'calendar-clock',
  overdue: 'alert-circle',
  paused: 'pause-octagon',
};

export function useStateTone() {
  const colors = useColors();
  return (state: InvoiceState) =>
    ({ paid: colors.success, paymentSent: colors.location, due: colors.star, overdue: colors.accent, paused: colors.accent })[state];
}

/** "Paid" / "Due Mon 9 Nov" / "Offers paused", with its colour and icon. */
export function StatePill({ invoice, terms, now }: { invoice: Invoice; terms: InvoiceTerms; now: number }) {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const state = invoiceState(invoice, now, terms);
  const tone = useStateTone()(state);
  return (
    <View style={[styles.pill, { backgroundColor: `${tone}22`, borderColor: `${tone}88` }]}>
      <MaterialCommunityIcons name={ICONS[state]} size={16} color={tone} />
      <Text variant="caption" color={tone} style={styles.pillText}>
        {t(`invoice.state_${state}`, { date: dates.dayMonth(invoice.dueAt) })}
      </Text>
    </View>
  );
}

export function useInvoicePeriod() {
  const dates = useDateFormat();
  return (invoice: Pick<Invoice, 'week'>) => dates.period(weekRange(invoice.week).start, weekLastDay(invoice.week));
}

/** One invoice in a list: the week, the amount, how it stands. */
export function InvoiceRow({ invoice, terms, now, admin }: { invoice: Invoice; terms: InvoiceTerms; now: number; admin?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const period = useInvoicePeriod();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id, ...(admin ? { as: 'admin' } : {}) } })}
      style={[styles.row, { backgroundColor: colors.surface }, rim(colors)]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name="receipt" size={22} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text variant="label">{admin ? invoice.driverName : period(invoice)}</Text>
        <Text variant="caption" muted>
          {admin ? period(invoice) : t('invoice.trips', { count: invoice.lines.length })}
        </Text>
        <StatePill invoice={invoice} terms={terms} now={now} />
      </View>
      <Text variant="subtitle">{formatMoney(t, invoice.totalShare)}</Text>
      <ForwardChevron color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1 },
  pillText: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 4 },
});
