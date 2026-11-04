import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery, useStore } from '@/backend';
import { normalizeJob } from '@/backend/actions';
import { advanceBooking, audit, resolveDispute, setRouteStatus } from '@/backend/prototype';
import type { Dispute, DriverRoute, RouteBooking } from '@/backend/types';
import { AdminPage, Panel } from '@/components/admin/shell';
import { can, useAdminSession } from '@/components/admin/session';
import { DataTable, DetailLayout, Toolbar } from '@/components/admin/table';
import { useDateFormat } from '@/components/date-format';
import { ConfirmDialog, FilterChips, InfoRow, PriceBreakdown, StatusBadge, Tag } from '@/components/ds';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { bookingStatusKind, CapacityBars, routeStatusKind, useCapacityText } from '@/components/route-cards';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { remaining, sharedSettlement } from '@/lib/sharing';
import { Spacing } from '@/theme';

const match = (text: string, query: string) => text.toLowerCase().includes(query.trim().toLowerCase());

/** All published customer requests (Doc 5 A10). */
export function Requests() {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const requests = useQuery('requests', []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'assigned' | 'completed' | 'cancelled'>('all');
  const rows = requests && [...requests].filter((r) => (status === 'all' || r.status === status) && match(`${r.clientName} ${names.shortRoute(r.from, r.to)}`, query)).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <AdminPage title={t('admin2.nav_requests')} subtitle={t('admin2.requestsSub')}>
      <Toolbar search={query} onSearch={setQuery}>
        <FilterChips value={status} onChange={setStatus} options={(['all', 'open', 'assigned', 'completed', 'cancelled'] as const).map((value) => ({ value, label: value === 'all' ? t('admin2.all') : t(`requestStatus.${value}`) }))} />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={t('admin2.noRequests')}
        columns={[
          { key: 'route', label: t('book.route'), flex: 2, render: (r) => names.shortRoute(r.from, r.to) },
          { key: 'customer', label: t('admin2.customer'), render: (r) => r.clientName },
          { key: 'cargo', label: t('book.cargo'), render: (r) => `${r.tons} t · ${t(`vehicle.${r.vehicle}`)}` },
          { key: 'when', label: t('admin2.when'), render: (r) => (r.scheduledAt ? dates.pickupShort(r.scheduledAt) : t('simple.now')) },
          { key: 'price', label: t('admin2.price'), numeric: true, render: (r) => formatMoney(t, r.price) },
          { key: 'status', label: t('admin2.status'), render: (r) => <StatusBadge status={r.status === 'open' ? 'pending' : r.status === 'assigned' ? 'confirmed' : r.status === 'completed' ? 'completed' : 'cancelled'} label={t(`requestStatus.${r.status}`)} /> },
          { key: 'share', label: t('route.sharedTag'), render: (r) => (r.allowSharing ? t('admin2.yes') : t('admin2.no')) },
        ]}
      />
    </AdminPage>
  );
}

/** Published routes and listing control (Doc 5 A11). Suspending needs a reason and is audited. */
export function Routes({ kind }: { kind?: 'return' }) {
  const { t } = useTranslation();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const capacityText = useCapacityText();
  const session = useAdminSession();
  const routes = useQuery('routes', []);
  const bookings = useQuery('bookings', []) ?? [];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [suspend, setSuspend] = useState(false);
  const [reason, setReason] = useState('');
  const rows = routes && [...routes].filter((r) => (kind ? r.kind === 'return' : true) && match(`${r.driverName} ${names.shortRoute(r.from, r.to)}`, query)).sort((a, b) => a.departAt.localeCompare(b.departAt));
  const route = routes?.find((r) => r.id === selected);
  const outbound = route?.outboundId ? routes?.find((r) => r.id === route.outboundId) : undefined;
  const allowed = can(session.role, 'operations');
  return (
    <AdminPage title={t(kind ? 'admin2.nav_returns' : 'admin2.nav_routes')} subtitle={t(kind ? 'admin2.returnsSub' : 'admin2.routesSub')}>
      <Toolbar search={query} onSearch={setQuery} />
      <DetailLayout
        table={
          <DataTable<DriverRoute>
            rows={rows}
            rowKey={(r) => r.id}
            selected={selected}
            onRowPress={(r) => setSelected(r.id)}
            empty={t('admin2.noRoutes')}
            columns={[
              { key: 'route', label: t('book.route'), flex: 2, render: (r) => names.shortRoute(r.from, r.to) },
              { key: 'driver', label: t('route.driver'), render: (r) => r.driverName },
              { key: 'depart', label: t('route.departure'), render: (r) => dates.pickupShort(r.departAt) },
              { key: 'left', label: t('admin2.capacityLeft'), flex: 2, render: (r) => capacityText(remaining(r.capacity, r.reserved)) },
              { key: 'price', label: t('admin2.price'), numeric: true, render: (r) => formatMoney(t, r.price) },
              { key: 'status', label: t('admin2.status'), render: (r) => <StatusBadge status={routeStatusKind(r.status)} label={t(`routeStatus.${r.status}`)} /> },
            ]}
          />
        }
        detail={
          route ? (
            <Panel title={names.shortRoute(route.from, route.to)}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {route.kind === 'return' && <Tag icon="backup-restore" tone="teal" label={t('route.returnTag')} />}
                <Tag icon="check-decagram" tone="green" label={t('admin2.driverConfirmed')} />
              </View>
              {outbound && <InfoRow label={t('admin2.outbound')} value={`${names.shortRoute(outbound.from, outbound.to)} · ${dates.pickupShort(outbound.departAt)}`} />}
              <InfoRow label={t('route.driver')} value={route.driverName} />
              <InfoRow label={t('route.vehicle')} value={`${t(`vehicle.${route.vehicle}`)} · ${route.plate}`} />
              <InfoRow label={t('route.departure')} value={dates.pickupShort(route.departAt)} />
              <InfoRow label={t('admin2.bookingsCount')} value={String(bookings.filter((b) => b.routeId === route.id).length)} />
              <CapacityBars route={route} />
              {route.status === 'published' && <Button compact variant="danger" title={t('admin2.suspendListing')} disabled={!allowed} onPress={() => setSuspend(true)} />}
              {!allowed && <Text variant="caption" muted>{t('admin2.needsOps')}</Text>}
              <Text variant="caption" muted>
                {t('admin2.noSilentCommit')}
              </Text>
            </Panel>
          ) : null
        }
      />
      <ConfirmDialog
        visible={suspend}
        danger
        title={t('admin2.suspendListing')}
        body={t('admin2.suspendBody')}
        confirm={t('admin2.suspendListing')}
        reason={reason}
        onReason={setReason}
        onCancel={() => setSuspend(false)}
        onConfirm={async () => {
          if (!route) return;
          setSuspend(false);
          await setRouteStatus(store, route, 'withdrawn');
          await audit(store, { actor: session.name, actorRole: session.role, action: 'route.suspend', entity: 'route', entityId: names.shortRoute(route.from, route.to), before: route.status, after: 'withdrawn', reason });
          setReason('');
        }}
      />
    </AdminPage>
  );
}

/** Every booking — route bookings and request-based trips — with full financial details (A12–A13). */
export function Bookings() {
  const { t } = useTranslation();
  const store = useStore();
  const names = useLocationLabel();
  const session = useAdminSession();
  const bookings = useQuery('bookings', []);
  const jobs = (useQuery('jobs', []) ?? []).map(normalizeJob);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  type Row = { id: string; ref: string; route: string; driver: string; customer: string; price: number; status: string; badge: ReturnType<typeof bookingStatusKind>; payment: string; booking?: RouteBooking };
  const rows: Row[] | undefined =
    bookings &&
    [
      ...bookings.map((b) => ({ id: b.id, ref: b.ref, route: names.shortRoute(b.from, b.to), driver: b.driverName, customer: b.customerName, price: b.price, status: t(`bookingStatus.${b.status}`), badge: bookingStatusKind(b.status), payment: t(`payment.${b.payment}`), booking: b })),
      ...jobs.map((j) => ({ id: j.id, ref: j.id.slice(-8).toUpperCase(), route: names.shortRoute(j.from, j.to), driver: j.driverName, customer: j.clientName, price: j.price, status: t(`status.${j.status}`), badge: (j.status === 'completed' ? 'completed' : j.status === 'cancelled' ? 'cancelled' : j.status === 'scheduled' ? 'confirmed' : 'inTransit') as ReturnType<typeof bookingStatusKind>, payment: j.status === 'completed' ? t('payment.cashConfirmed') : t('payment.notDue') })),
    ].filter((r) => match(`${r.ref} ${r.route} ${r.driver} ${r.customer}`, query));
  const row = rows?.find((r) => r.id === selected);
  const b = row?.booking;
  const allowed = can(session.role, 'operations');
  return (
    <AdminPage title={t('admin2.nav_bookings')} subtitle={t('admin2.bookingsSub')}>
      <Toolbar search={query} onSearch={setQuery} />
      <DetailLayout
        table={
          <DataTable<Row>
            rows={rows}
            rowKey={(r) => r.id}
            selected={selected}
            onRowPress={(r) => setSelected(r.id)}
            empty={t('admin2.noBookings')}
            columns={[
              { key: 'ref', label: t('booking.reference'), render: (r) => r.ref },
              { key: 'route', label: t('book.route'), flex: 2, render: (r) => r.route },
              { key: 'people', label: t('admin2.driverCustomer'), flex: 2, render: (r) => `${r.driver} · ${r.customer}` },
              { key: 'price', label: t('admin2.price'), numeric: true, render: (r) => formatMoney(t, r.price) },
              { key: 'status', label: t('admin2.status'), render: (r) => <StatusBadge status={r.badge} label={r.status} /> },
              { key: 'pay', label: t('booking.payment'), render: (r) => r.payment },
            ]}
          />
        }
        detail={
          row ? (
            <Panel title={row.ref}>
              <InfoRow label={t('book.route')} value={row.route} />
              <InfoRow label={t('route.driver')} value={row.driver} />
              <InfoRow label={t('admin2.customer')} value={row.customer} />
              {b ? (
                <>
                  <InfoRow label={t('book.cargo')} value={`${b.cargo.description} · ${b.cargo.tons} t · ${b.cargo.volumeM3} m³`} />
                  <InfoRow label={t('book.modeLabel')} value={b.mode === 'shared' ? t('book.modeShared') : b.allowSharing ? t('book.modeDedicatedSharing') : t('book.modeDedicated')} />
                  <PriceBreakdown
                    lines={[{ label: t('booking.originalPrice'), amount: b.originalPrice }, ...(b.discount ? [{ label: t('booking.sharedDiscount'), amount: b.discount, negative: true }] : [])]}
                    total={b.price}
                    totalLabel={t('booking.toPay')}
                  />
                  <InfoRow label={t('admin2.rateSnapshot')} value={b.commissionRate === null ? t('admin2.notConfirmed') : `${Math.round(b.commissionRate * 100)}%`} />
                  <InfoRow label={t('admin2.commission')} value={b.commissionRate === null ? '—' : formatMoney(t, Math.round(b.price * b.commissionRate))} />
                  <InfoRow label={t('booking.payment')} value={row.payment} />
                  {['requested', 'confirmed', 'inTransit'].includes(b.status) && <Button compact variant="danger" title={t('admin2.cancel')} disabled={!allowed} onPress={() => setCancel(true)} />}
                </>
              ) : (
                <Button compact variant="outline" title={t('admin2.openTrip')} onPress={() => router.push({ pathname: '/track/[id]', params: { id: jobs.find((j) => j.id === row.id)?.requestId ?? '' } })} />
              )}
            </Panel>
          ) : null
        }
      />
      <ConfirmDialog
        visible={cancel}
        danger
        title={t('admin2.cancelBooking', { ref: b?.ref ?? '' })}
        body={t('admin2.cancelBody')}
        confirm={t('booking.cancel')}
        reason={reason}
        onReason={setReason}
        onCancel={() => setCancel(false)}
        onConfirm={async () => {
          if (!b) return;
          setCancel(false);
          await advanceBooking(store, b, 'cancelled');
          await audit(store, { actor: session.name, actorRole: session.role, action: 'booking.cancel', entity: 'booking', entityId: b.ref, before: b.status, after: 'cancelled', reason });
          setReason('');
        }}
      />
    </AdminPage>
  );
}

/** Shared trips (Doc 5 A14–A15): original and joining customers, capacity, prices, discounts, revenue. */
export function SharedTrips() {
  const { t } = useTranslation();
  const names = useLocationLabel();
  const routes = useQuery('routes', []);
  const bookings = useQuery('bookings', []) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const shared = routes?.filter((r) => r.sharing !== 'dedicated' && bookings.some((b) => b.routeId === r.id && (b.allowSharing || b.role === 'joiner')));
  const route = shared?.find((r) => r.id === selected);
  const list = route ? bookings.filter((b) => b.routeId === route.id && b.status !== 'declined') : [];
  const original = list.find((b) => b.role === 'original');
  const joiners = list.filter((b) => b.role === 'joiner' && ['confirmed', 'inTransit', 'delivered', 'completed'].includes(b.status));
  const gross = list.filter((b) => ['confirmed', 'inTransit', 'delivered', 'completed'].includes(b.status)).reduce((s, b) => s + b.price, 0);
  const commission = list.reduce((s, b) => s + (b.commissionRate ? Math.round(b.price * b.commissionRate) : 0), 0);
  const check = original && joiners[0] ? sharedSettlement(original.originalPrice, joiners[0].price, original.commissionRate ?? 0.1) : null;
  return (
    <AdminPage title={t('admin2.nav_shared')} subtitle={t('admin2.sharedSub')}>
      <DetailLayout
        table={
          <DataTable<DriverRoute>
            rows={shared}
            rowKey={(r) => r.id}
            selected={selected}
            onRowPress={(r) => setSelected(r.id)}
            empty={t('admin2.noShared')}
            columns={[
              { key: 'route', label: t('book.route'), flex: 2, render: (r) => names.shortRoute(r.from, r.to) },
              { key: 'driver', label: t('route.driver'), render: (r) => r.driverName },
              { key: 'bookings', label: t('admin2.bookingsCount'), numeric: true, render: (r) => String(bookings.filter((b) => b.routeId === r.id && b.status !== 'declined').length) },
              { key: 'used', label: t('admin2.allocated'), render: (r) => `${r.reserved.tons} / ${r.capacity.tons} t` },
            ]}
          />
        }
        detail={
          route ? (
            <Panel title={names.shortRoute(route.from, route.to)}>
              <CapacityBars route={route} />
              {list.map((b) => (
                <View key={b.id} style={{ gap: 2 }}>
                  <Text variant="label">
                    {b.ref} · {b.customerName}
                  </Text>
                  <Text variant="caption" muted>
                    {b.role === 'original' ? t('admin2.original') : t('booking.joiner')} · {t(`bookingStatus.${b.status}`)} · {formatMoney(t, b.originalPrice)}
                    {b.discount ? ` → ${formatMoney(t, b.price)} (−${formatMoney(t, b.discount)})` : ''}
                  </Text>
                </View>
              ))}
              <InfoRow label={t('admin2.driverGross')} value={formatMoney(t, gross)} />
              <InfoRow label={t('admin2.commission')} value={formatMoney(t, commission)} />
              <InfoRow label={t('admin2.driverKeeps')} value={formatMoney(t, gross - commission)} strong />
              {check && (
                <Text variant="caption" muted>
                  {t('admin2.policyCheck', { discount: formatMoney(t, check.discount), commission: formatMoney(t, check.commission) })}
                </Text>
              )}
            </Panel>
          ) : null
        }
      />
    </AdminPage>
  );
}

/** Disputes and incidents (Doc 5 A18–A19): investigate, then resolve with a written outcome. */
export function Disputes() {
  const { t } = useTranslation();
  const store = useStore();
  const dates = useDateFormat();
  const session = useAdminSession();
  const disputes = useQuery('disputes', []);
  const [status, setStatus] = useState<'open' | 'investigating' | 'resolved' | 'all'>('open');
  const [selected, setSelected] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');
  const rows = disputes && [...disputes].filter((d) => status === 'all' || d.status === status).sort((a, b) => b.createdAt - a.createdAt);
  const dispute = disputes?.find((d) => d.id === selected);
  const allowed = can(session.role, 'operations') || (dispute?.kind === 'invoice' && can(session.role, 'finance'));
  return (
    <AdminPage title={t('admin2.nav_disputes')} subtitle={t('admin2.disputesSub')}>
      <FilterChips value={status} onChange={setStatus} options={(['open', 'investigating', 'resolved', 'all'] as const).map((value) => ({ value, label: value === 'all' ? t('admin2.all') : t(`dispute.status_${value}`) }))} />
      <DetailLayout
        table={
          <DataTable<Dispute>
            rows={rows}
            rowKey={(d) => d.id}
            selected={selected}
            onRowPress={(d) => setSelected(d.id)}
            empty={t('admin2.noDisputes')}
            columns={[
              { key: 'ref', label: t('booking.reference'), render: (d) => d.ref },
              { key: 'kind', label: t('admin2.type'), render: (d) => t(`dispute.${d.kind}`) },
              { key: 'by', label: t('admin2.raisedBy'), render: (d) => `${d.raisedByName} (${t(`admin2.side_${d.raisedBy}`)})` },
              { key: 'at', label: t('admin2.when'), render: (d) => dates.dayTime(new Date(d.createdAt)) },
              { key: 'status', label: t('admin2.status'), render: (d) => <StatusBadge status={d.status === 'resolved' ? 'completed' : 'disputed'} label={t(`dispute.status_${d.status}`)} /> },
            ]}
          />
        }
        detail={
          dispute ? (
            <Panel title={dispute.ref}>
              <Text userText>{dispute.text}</Text>
              <InfoRow label={t('admin2.type')} value={t(`dispute.${dispute.kind}`)} />
              <InfoRow label={t('admin2.raisedBy')} value={dispute.raisedByName} />
              {dispute.resolution ? <InfoRow label={t('admin2.resolution')} value={dispute.resolution} /> : null}
              {dispute.status === 'open' && <Button compact variant="outline" title={t('admin2.investigate')} disabled={!allowed} onPress={() => store.update('disputes', dispute.id, { status: 'investigating' })} />}
              {dispute.status !== 'resolved' && <Button compact variant="accent" title={t('admin2.resolve')} disabled={!allowed} onPress={() => setResolving(true)} />}
              {!allowed && <Text variant="caption" muted>{t('admin2.needsOps')}</Text>}
            </Panel>
          ) : null
        }
      />
      <View style={{ gap: Spacing.sm }}>
        <ConfirmDialog
          visible={resolving}
          title={t('admin2.resolve')}
          body={t('admin2.resolveBody')}
          confirm={t('admin2.resolve')}
          reason={resolution}
          onReason={setResolution}
          reasonLabel={t('admin2.resolution')}
          onCancel={() => setResolving(false)}
          onConfirm={async () => {
            if (!dispute) return;
            setResolving(false);
            await resolveDispute(store, dispute, { id: session.name, name: session.name, phone: '' }, session.role, resolution);
            setResolution('');
          }}
        />
      </View>
    </AdminPage>
  );
}
