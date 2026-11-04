import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDoc, useQuery, useStore } from '@/backend';
import { advanceBooking, originalDecide, raiseDispute, sharingPolicy } from '@/backend/prototype';
import type { RouteBooking } from '@/backend/types';
import { ContactButtons } from '@/components/contact-buttons';
import { useDateFormat } from '@/components/date-format';
import { ConfirmDialog, FilterChips, InfoRow, PageHeader, PriceBreakdown, PrototypeNote, SectionHeader, StateView, StatusBadge, Tag } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { FreightMap } from '@/components/map/freight-map';
import { formatMoney } from '@/components/money';
import { bookingStatusKind } from '@/components/route-cards';
import { Text } from '@/components/text';
import { useCompany } from '@/components/use-company';
import { Button, Card, Screen } from '@/components/ui';
import { sharedDiscount } from '@/lib/sharing';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { Spacing, useColors } from '@/theme';

const STEPS: RouteBooking['status'][] = ['requested', 'confirmed', 'inTransit', 'delivered', 'completed'];

/**
 * One route booking (Doc 5 C15–C17, C20, C22): reference, status, driver, vehicle, map,
 * price with any shared discount, cash on delivery and payment status, the shared trip's
 * status, approval of another customer joining, delivery confirmation and "report a problem".
 */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const booking = useDoc('bookings', id);
  if (booking === undefined) return <Screen><StateView state="loading" /></Screen>;
  if (booking === null)
    return (
      <Screen header={<PageHeader title={t('booking.title')} onBack={() => router.back()} />}>
        <StateView state="error" title={t('booking.missing')} />
      </Screen>
    );
  return <BookingView booking={booking} />;
}

function BookingView({ booking }: { booking: RouteBooking }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const { company } = useCompany();
  const route = useDoc('routes', booking.routeId);
  const { client } = useAccount();
  const mine = client?.id === booking.customerId;
  const joiners = useQuery('bookings', booking.role === 'original' ? [['joinOf', booking.id]] : null);
  const pending = (joiners ?? []).filter((j) => j.status === 'awaitingOriginal');
  const joined = (joiners ?? []).filter((j) => ['confirmed', 'inTransit', 'delivered', 'completed'].includes(j.status));
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemKind, setProblemKind] = useState<'damage' | 'late' | 'cash' | 'other'>('damage');
  const [problemText, setProblemText] = useState('');
  const [problemSent, setProblemSent] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const stepIndex = STEPS.indexOf(booking.status);
  const policy = sharingPolicy(company);

  return (
    <Screen header={<PageHeader title={booking.ref} subtitle={names.shortRoute(booking.from, booking.to)} onBack={() => router.back()} />}>
      <FreightMap
        height={180}
        markers={[
          { id: 'from', kind: 'pickup', lat: booking.from.lat, lng: booking.from.lng, label: t('map.pickup') },
          { id: 'to', kind: 'dropoff', lat: booking.to.lat, lng: booking.to.lng, label: t('map.dropoff') },
        ]}
        route={[booking.from, booking.to]}
        focus={[booking.from, booking.to]}
        focusKey={booking.id}
      />
      <View style={styles.tags}>
        <StatusBadge status={bookingStatusKind(booking.status)} label={t(`bookingStatus.${booking.status}`)} />
        <Tag icon={booking.mode === 'shared' ? 'account-multiple-outline' : 'truck-outline'} label={booking.mode === 'shared' ? t('book.modeShared') : t('book.modeDedicated')} />
        {booking.role === 'joiner' && <Tag icon="account-plus-outline" label={t('booking.joiner')} />}
      </View>

      {/* Progress: one bar, the steps a booking goes through. */}
      {stepIndex >= 0 && (
        <View style={styles.progress}>
          {STEPS.map((step, i) => (
            <View key={step} style={{ flex: 1, gap: 4 }}>
              <View style={[styles.progressBar, { backgroundColor: i <= stepIndex ? colors.primaryFill : colors.surfaceMuted }]} />
              <Text variant="caption" muted={i > stepIndex} style={styles.progressLabel}>
                {t(`bookingStatus.${step}`)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {booking.status === 'awaitingOriginal' && <StateView state="loading" compact title={t('booking.waitOriginal')} />}

      <Card>
        <SectionHeader title={t('booking.details')} />
        <InfoRow label={t('booking.reference')} value={booking.ref} />
        <InfoRow label={t('route.departure')} value={route ? dates.pickupShort(route.departAt) : '—'} />
        <InfoRow label={t('route.driver')} value={booking.driverName} />
        <InfoRow label={t('route.vehicle')} value={route ? t(`vehicle.${route.vehicle}`) : '—'} />
        <InfoRow label={t('book.cargo')} value={`${booking.cargo.description} · ${booking.cargo.tons} t · ${booking.cargo.volumeM3} m³`} />
        <InfoRow label={t('book.accompanyLabel')} value={t(`accompany.${booking.accompaniment}`)} />
      </Card>

      <PriceBreakdown
        lines={[
          { label: t('booking.originalPrice'), amount: booking.originalPrice },
          ...(booking.discount > 0 ? [{ label: t('booking.sharedDiscount'), amount: booking.discount, negative: true }] : []),
        ]}
        total={booking.price}
        totalLabel={t('booking.toPay')}
        note={booking.discountPolicy ? t('booking.policyNote', { version: booking.discountPolicy }) : undefined}
      />
      <Card>
        <InfoRow label={t('booking.paymentMethod')} value={t('booking.cashOnDelivery')} />
        <InfoRow label={t('booking.payment')} value={t(`payment.${booking.payment}`)} />
      </Card>

      {booking.role === 'original' && booking.allowSharing && (
        <Card>
          <SectionHeader title={t('booking.sharedStatus')} />
          <Text variant="caption" muted>
            {joined.length ? t('booking.joinedCount', { count: joined.length }) : t('booking.noneJoined')}
          </Text>
          {booking.discount > 0 && (
            <Text variant="label" color={colors.success}>
              {t('booking.saved', { amount: formatMoney(t, booking.discount) })}
            </Text>
          )}
        </Card>
      )}

      {mine &&
        pending.map((joiner) => {
          const discount = sharedDiscount(booking.price, joiner.price, policy);
          return (
            <Card key={joiner.id}>
              <View style={styles.headRow}>
                <MaterialCommunityIcons name="account-plus" size={22} color={colors.primary} />
                <Text variant="label" style={{ flex: 1 }}>
                  {t('booking.joinAsk')}
                </Text>
              </View>
              <InfoRow label={t('booking.extraPickup')} value={names.short(joiner.from)} />
              <InfoRow label={t('booking.extraDrop')} value={names.short(joiner.to)} />
              <InfoRow label={t('book.cargo')} value={joiner.cargo.description} />
              <InfoRow label={t('booking.revisedSchedule')} value={joiner.extraStops ? t('booking.mayChange') : t('booking.unchanged')} />
              <PriceBreakdown
                lines={[
                  { label: t('booking.originalPrice'), amount: booking.price },
                  { label: t('booking.sharedDiscount'), amount: discount, negative: true },
                ]}
                total={booking.price - discount}
                totalLabel={t('booking.newPrice')}
                note={t('booking.discountOnlyIfConfirmed')}
              />
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button compact variant="ghost" title={t('booking.decline')} onPress={() => originalDecide(store, joiner, false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    compact
                    variant="accent"
                    title={t('booking.approve')}
                    onPress={async () => {
                      play('success');
                      await originalDecide(store, joiner, true);
                    }}
                  />
                </View>
              </View>
            </Card>
          );
        })}

      {['confirmed', 'inTransit', 'delivered'].includes(booking.status) && route && (
        <Card>
          <SectionHeader title={t('booking.contact')} />
          <ContactButtons phone={route.driverPhone} />
        </Card>
      )}

      {mine && booking.status === 'delivered' && (
        <Card>
          <SectionHeader title={t('booking.confirmDelivery')} />
          <Text variant="caption" muted>
            {t('booking.confirmDeliveryBody', { amount: formatMoney(t, booking.price) })}
          </Text>
          <Button variant="accent" icon="checkmark-done" title={t('booking.goodsReceived')} onPress={() => advanceBooking(store, booking, 'completed')} />
        </Card>
      )}

      {mine && ['confirmed', 'inTransit', 'delivered', 'completed'].includes(booking.status) && (
        <Button variant="outline" icon="alert-circle-outline" title={t('booking.reportProblem')} onPress={() => setProblemOpen(true)} />
      )}
      {problemSent && <StateView state="success" compact title={t('booking.problemSent')} />}
      {mine && ['requested', 'confirmed'].includes(booking.status) && <Button variant="danger" icon="close-circle-outline" title={t('booking.cancel')} onPress={() => setCancelOpen(true)} />}
      <PrototypeNote />

      <ConfirmDialog
        visible={problemOpen}
        title={t('booking.reportProblem')}
        confirm={t('booking.send')}
        onCancel={() => setProblemOpen(false)}
        reason={problemText}
        onReason={setProblemText}
        reasonLabel={t('booking.problemWhat')}
        onConfirm={async () => {
          setProblemOpen(false);
          await raiseDispute(store, { ref: booking.ref, raisedBy: 'customer', raisedByName: booking.customerName, kind: problemKind, text: problemText.trim() });
          setProblemText('');
          setProblemSent(true);
        }}>
        <FilterChips
          value={problemKind}
          onChange={setProblemKind}
          options={(['damage', 'late', 'cash', 'other'] as const).map((value) => ({ value, label: t(`dispute.${value}`) }))}
        />
      </ConfirmDialog>
      <ConfirmDialog
        visible={cancelOpen}
        danger
        title={t('booking.cancelTitle')}
        body={t('booking.cancelBody')}
        confirm={t('booking.cancel')}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          setCancelOpen(false);
          await advanceBooking(store, booking, 'cancelled');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  progress: { flexDirection: 'row', gap: 4 },
  progressBar: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, lineHeight: 15 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
