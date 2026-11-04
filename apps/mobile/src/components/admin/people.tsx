import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery, useStore } from '@/backend';
import { normalizeDriver } from '@/backend/actions';
import { setDriverVerification } from '@/backend/prototype';
import type { DriverRecord } from '@/backend/types';
import { AdminPage, Panel } from '@/components/admin/shell';
import { can, useAdminSession, type Permission } from '@/components/admin/session';
import { DataTable, DetailLayout, Toolbar } from '@/components/admin/table';
import { useCityName } from '@/components/city-picker';
import { useDateFormat } from '@/components/date-format';
import { ConfirmDialog, FilterChips, InfoRow, PrototypeNote, StatusBadge, Tag } from '@/components/ds';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { reliability } from '@/lib/trip';
import { Spacing } from '@/theme';

const match = (text: string, query: string) => text.toLowerCase().includes(query.trim().toLowerCase());
type Verif = NonNullable<DriverRecord['verification']>;

/** Drivers (Doc 5 A04–A05, A09): search, verify, suspend or reactivate — each with a reason. */
export function Drivers({ vehiclesView }: { vehiclesView?: boolean }) {
  const { t } = useTranslation();
  const store = useStore();
  const cityName = useCityName();
  const dates = useDateFormat();
  const session = useAdminSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const drivers = useQuery('drivers', []);
  const invoices = useQuery('invoices', []) ?? [];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Verif>('all');
  const [selected, setSelected] = useState<string | null>(params.id ?? null);
  const [action, setAction] = useState<Verif | null>(null);
  const [reason, setReason] = useState('');
  const state = (d: DriverRecord): Verif => d.verification ?? 'verified';
  const rows = drivers && drivers.map(normalizeDriver).filter((d) => (filter === 'all' || state(d) === filter) && match(`${d.name} ${d.phone} ${d.plate}`, query));
  const driver = rows?.find((d) => d.id === selected);
  const owed = (id: string) => invoices.filter((i) => i.driverId === id && i.status !== 'paid').reduce((s, i) => s + i.totalShare, 0);
  const allowed = can(session.role, 'verify');
  return (
    <AdminPage title={t(vehiclesView ? 'admin2.nav_vehicles' : 'admin2.nav_drivers')} subtitle={t(vehiclesView ? 'admin2.vehiclesSub' : 'admin2.driversSub')}>
      <Toolbar search={query} onSearch={setQuery}>
        <FilterChips value={filter} onChange={setFilter} options={(['all', 'pending', 'verified', 'suspended'] as const).map((value) => ({ value, label: value === 'all' ? t('admin2.all') : t(`dprofile.ver_${value}`) }))} />
      </Toolbar>
      <DetailLayout
        table={
          <DataTable<DriverRecord>
            rows={rows}
            rowKey={(d) => d.id}
            selected={selected}
            onRowPress={(d) => setSelected(d.id)}
            empty={t('admin2.noDrivers')}
            columns={
              vehiclesView
                ? [
                    { key: 'vehicle', label: t('route.vehicle'), flex: 2, render: (d) => t(`vehicle.${d.vehicle}`) },
                    { key: 'plate', label: t('vehicles.plate'), numeric: true, render: (d) => d.plate },
                    { key: 'driver', label: t('route.driver'), flex: 2, render: (d) => d.name },
                    { key: 'payload', label: t('vehicles.carries'), flex: 2, render: (d) => t(`payload.${d.vehicle}`) },
                    { key: 'state', label: t('admin2.status'), render: (d) => <StatusBadge status={state(d) === 'pending' ? 'pending' : state(d)} label={t(`dprofile.ver_${state(d)}`)} /> },
                  ]
                : [
                    { key: 'name', label: t('admin2.name'), flex: 2, render: (d) => d.name },
                    { key: 'phone', label: t('admin2.phone'), numeric: true, render: (d) => d.phone },
                    { key: 'vehicle', label: t('route.vehicle'), render: (d) => t(`vehicle.${d.vehicle}`) },
                    { key: 'rating', label: t('admin2.rating'), numeric: true, render: (d) => `★ ${d.rating.toFixed(1)} · ${d.trips}` },
                    { key: 'owed', label: t('admin2.outstanding'), numeric: true, render: (d) => formatMoney(t, owed(d.id)) },
                    { key: 'state', label: t('admin2.status'), render: (d) => <StatusBadge status={state(d) === 'pending' ? 'pending' : state(d)} label={t(`dprofile.ver_${state(d)}`)} /> },
                  ]
            }
          />
        }
        detail={
          driver ? (
            <Panel title={driver.name}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <StatusBadge status={state(driver) === 'pending' ? 'pending' : state(driver)} label={t(`dprofile.ver_${state(driver)}`)} />
                {driver.id.startsWith('proto-') && <Tag icon="flask-outline" tone="gold" label={t('ds.prototype')} />}
              </View>
              <InfoRow label={t('admin2.phone')} value={driver.phone} />
              <InfoRow label={t('route.vehicle')} value={`${t(`vehicle.${driver.vehicle}`)} · ${driver.plate}`} />
              <InfoRow label={t('vehicles.city')} value={cityName(driver.homeCity as never)} />
              <InfoRow label={t('admin2.rating')} value={`★ ${driver.rating.toFixed(1)} (${driver.ratingCount})`} />
              <InfoRow label={t('admin2.reliability')} value={`${reliability(driver.stats)}%`} />
              <InfoRow label={t('admin2.joined')} value={dates.dayMonth(driver.joinedAt)} />
              <InfoRow label={t('admin2.outstanding')} value={formatMoney(t, owed(driver.id))} />
              <Text variant="caption" muted>
                {t('admin2.docsNote')}
              </Text>
              <View style={{ gap: Spacing.sm }}>
                {state(driver) !== 'verified' && <Button compact variant="accent" title={t('admin2.approve')} disabled={!allowed} onPress={() => setAction('verified')} />}
                {state(driver) === 'pending' && <Button compact variant="ghost" title={t('admin2.reject')} disabled={!allowed} onPress={() => setAction('suspended')} />}
                {state(driver) === 'verified' && <Button compact variant="danger" title={t('admin2.suspend')} disabled={!allowed} onPress={() => setAction('suspended')} />}
              </View>
              {!allowed && <Text variant="caption" muted>{t('admin2.needsVerify')}</Text>}
            </Panel>
          ) : null
        }
      />
      <ConfirmDialog
        visible={action !== null}
        danger={action === 'suspended'}
        title={action === 'verified' ? t('admin2.approve') : t('admin2.suspend')}
        body={t('admin2.verifyBody', { name: driver?.name ?? '' })}
        confirm={action === 'verified' ? t('admin2.approve') : t('admin2.suspend')}
        reason={reason}
        onReason={setReason}
        onCancel={() => setAction(null)}
        onConfirm={async () => {
          if (!driver || !action) return;
          const next = action;
          setAction(null);
          await setDriverVerification(store, driver, next, { id: session.name, name: session.name, phone: '' }, session.role, reason);
          setReason('');
        }}
      />
    </AdminPage>
  );
}

/** Customers (Doc 5 A06–A07): who books, how often, and their open complaints. */
export function Customers() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const clients = useQuery('clients', []);
  const bookings = useQuery('bookings', []) ?? [];
  const requests = useQuery('requests', []) ?? [];
  const disputes = useQuery('disputes', []) ?? [];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = clients && clients.filter((c) => match(`${c.name} ${c.phone} ${c.company ?? ''}`, query));
  const client = rows?.find((c) => c.id === selected);
  return (
    <AdminPage title={t('admin2.nav_customers')} subtitle={t('admin2.customersSub')}>
      <Toolbar search={query} onSearch={setQuery} />
      <DetailLayout
        table={
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            selected={selected}
            onRowPress={(c) => setSelected(c.id)}
            empty={t('admin2.noCustomers')}
            columns={[
              { key: 'name', label: t('admin2.name'), flex: 2, render: (c) => c.name },
              { key: 'phone', label: t('admin2.phone'), numeric: true, render: (c) => c.phone },
              { key: 'type', label: t('admin2.customerType'), render: (c) => (c.company ? t('admin2.business') : t('admin2.individual')) },
              { key: 'trips', label: t('admin2.trips'), numeric: true, render: (c) => String((c.trips ?? 0) + bookings.filter((b) => b.customerId === c.id).length) },
              { key: 'rating', label: t('admin2.rating'), numeric: true, render: (c) => `★ ${c.rating.toFixed(1)}` },
            ]}
          />
        }
        detail={
          client ? (
            <Panel title={client.name}>
              <InfoRow label={t('admin2.phone')} value={client.phone} />
              <InfoRow label={t('admin2.customerType')} value={client.company ? `${t('admin2.business')} · ${client.company}` : t('admin2.individual')} />
              <InfoRow label={t('admin2.joined')} value={client.joinedAt ? dates.dayMonth(client.joinedAt) : '—'} />
              <InfoRow label={t('admin2.requestsCount')} value={String(requests.filter((r) => r.clientId === client.id).length)} />
              <InfoRow label={t('admin2.bookingsCount')} value={String(bookings.filter((b) => b.customerId === client.id).length)} />
              <InfoRow label={t('admin2.complaints')} value={String(disputes.filter((d) => d.raisedByName === client.name).length)} />
            </Panel>
          ) : null
        }
      />
    </AdminPage>
  );
}

const PERMISSIONS: Permission[] = ['finance', 'operations', 'verify', 'settings', 'staff'];

/** Administrator accounts and permissions (Doc 5 A30): who can do what, by role. */
export function Admins() {
  const { t } = useTranslation();
  const session = useAdminSession();
  return (
    <AdminPage title={t('admin2.nav_admins')} subtitle={t('admin2.adminsSub')}>
      <Panel title={t('admin2.signedInAs', { name: session.name })}>
        <Tag icon="shield-account" label={t(`admin2.role_${session.role}`)} />
      </Panel>
      <DataTable
        rows={(['superAdmin', 'financeAdmin', 'operationsAdmin'] as const).map((role) => ({ role }))}
        rowKey={(r) => r.role}
        empty=""
        columns={[
          { key: 'role', label: t('admin2.role'), flex: 2, render: (r) => t(`admin2.role_${r.role}`) },
          ...PERMISSIONS.map((p) => ({ key: p, label: t(`admin2.perm_${p}`), render: (r: { role: 'superAdmin' | 'financeAdmin' | 'operationsAdmin' }) => (can(r.role, p) ? '✓' : '—') })),
        ]}
      />
      <PrototypeNote text={t('admin2.adminsPrototype')} />
    </AdminPage>
  );
}
