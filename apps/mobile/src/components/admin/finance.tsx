import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { useQuery, useStore } from "@/backend";
import {
  changeCommission,
  changeSettings,
  recordPayment,
} from "@/backend/prototype";
import type { Invoice } from "@/backend/types";
import { CompanyForm, InvoicesDesk } from "@/components/admin/company-desk";
import { AdminPage, Panel } from "@/components/admin/shell";
import { can, useAdminSession } from "@/components/admin/session";
import { DataTable, DetailLayout, Toolbar } from "@/components/admin/table";
import { useDateFormat } from "@/components/date-format";
import {
  ConfirmDialog,
  FilterChips,
  FormField,
  InfoRow,
  PrototypeNote,
  Stat,
  StatusBadge,
  ToggleRow,
} from "@/components/ds";
import { formatMoney } from "@/components/money";
import { Text } from "@/components/text";
import { useCompany } from "@/components/use-company";
import { Button } from "@/components/ui";
import { invoiceState, weekRange } from "@/lib/invoices";
import { Spacing, useColors } from "@/theme";

const paidOf = (i: Invoice) =>
  (i.payments ?? []).reduce((s, p) => s + p.amount, 0);

/** Invoices (Doc 5 A20–A21): every driver invoice, its lines, and recorded payments (finance role). */
export function Invoices() {
  const { t } = useTranslation();
  const store = useStore();
  const dates = useDateFormat();
  const { company } = useCompany();
  const session = useAdminSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const invoices = useQuery("invoices", []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "due" | "paymentSent" | "overdue" | "paid"
  >("all");
  const [selected, setSelected] = useState<string | null>(params.id ?? null);
  const [recording, setRecording] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"transfer" | "cash" | "agent">(
    "transfer",
  );
  const [reference, setReference] = useState("");
  const [now] = useState(() => Date.now());
  const state = (i: Invoice) => invoiceState(i, now, company);
  const rows =
    invoices &&
    [...invoices]
      .filter(
        (i) =>
          (filter === "all"
            ? true
            : filter === "overdue"
              ? ["overdue", "paused"].includes(state(i))
              : state(i) === filter) &&
          `${i.number} ${i.driverName}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) => b.issuedAt - a.issuedAt);
  const invoice = invoices?.find((i) => i.id === selected);
  const finance = can(session.role, "finance");
  const left = invoice ? invoice.totalShare - paidOf(invoice) : 0;
  const amountError = !(Number(amount) > 0)
    ? t("book.errNumber")
    : Number(amount) > left
      ? t("admin2.errOverpay", { left: formatMoney(t, left) })
      : null;

  return (
    <AdminPage
      title={t("admin2.nav_invoices")}
      subtitle={t("admin2.invoicesSub")}
    >
      <Toolbar search={query} onSearch={setQuery}>
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={(
            ["all", "due", "paymentSent", "overdue", "paid"] as const
          ).map((value) => ({
            value,
            label:
              value === "all"
                ? t("admin2.all")
                : t(`invoice.state_${value}`, { date: "" }),
          }))}
        />
      </Toolbar>
      <DetailLayout
        table={
          <DataTable<Invoice>
            rows={rows}
            rowKey={(i) => i.id}
            selected={selected}
            onRowPress={(i) => setSelected(i.id)}
            empty={t("admin.noInvoices")}
            columns={[
              {
                key: "number",
                label: t("admin2.invoiceNo"),
                numeric: true,
                render: (i) => i.number,
              },
              {
                key: "driver",
                label: t("route.driver"),
                flex: 2,
                render: (i) => i.driverName,
              },
              {
                key: "week",
                label: t("admin2.period"),
                render: (i) => dates.dayMonth(weekRange(i.week).start),
              },
              {
                key: "total",
                label: t("admin2.total"),
                numeric: true,
                render: (i) => formatMoney(t, i.totalShare),
              },
              {
                key: "paid",
                label: t("admin2.paidAmount"),
                numeric: true,
                render: (i) =>
                  formatMoney(
                    t,
                    i.status === "paid" && !i.payments?.length
                      ? i.totalShare
                      : paidOf(i),
                  ),
              },
              {
                key: "status",
                label: t("admin2.status"),
                render: (i) => (
                  <StatusBadge
                    status={
                      state(i) === "paid"
                        ? "paid"
                        : ["overdue", "paused"].includes(state(i))
                          ? "overdue"
                          : "pending"
                    }
                    label={t(`invoice.state_${state(i)}`, {
                      date: dates.dayMonth(i.dueAt),
                    })}
                  />
                ),
              },
            ]}
          />
        }
        detail={
          invoice ? (
            <Panel title={invoice.number}>
              <InfoRow label={t("route.driver")} value={invoice.driverName} />
              <InfoRow
                label={t("admin2.period")}
                value={dates.period(
                  weekRange(invoice.week).start,
                  weekRange(invoice.week).end - 1,
                )}
              />
              <InfoRow
                label={t("invoice.dueOn", { date: "" })}
                value={dates.dayMonth(invoice.dueAt)}
              />
              {invoice.lines.map((line) => (
                <InfoRow
                  key={line.jobId}
                  label={`${dates.dayMonth(line.completedAt)} · ${formatMoney(t, line.price)} × ${Math.round((line.share / line.price) * 100)}%`}
                  value={formatMoney(t, line.share)}
                />
              ))}
              <InfoRow
                label={t("admin2.total")}
                value={formatMoney(t, invoice.totalShare)}
                strong
              />
              {(invoice.payments ?? []).map((p, i) => (
                <InfoRow
                  key={i}
                  label={`${dates.dayMonth(p.at)} · ${t(`admin2.method_${p.method}`)} · ${p.reference} · ${p.by}`}
                  value={`− ${formatMoney(t, p.amount)}`}
                />
              ))}
              {invoice.status === "paymentSent" && (
                <Text variant="caption">
                  {t("admin.reported", {
                    method: t(
                      invoice.paymentMethod === "cash"
                        ? "invoice.methodCash"
                        : "invoice.methodTransfer",
                    ),
                    reference: invoice.paymentReference || "—",
                    date: dates.dayMonth(
                      invoice.paymentSentAt ?? invoice.issuedAt,
                    ),
                  })}
                </Text>
              )}
              {invoice.status !== "paid" && (
                <Button
                  compact
                  variant="accent"
                  icon="cash-outline"
                  title={t("admin2.recordPayment")}
                  disabled={!finance}
                  onPress={() => {
                    setAmount(String(left));
                    setReference(invoice.paymentReference ?? "");
                    setRecording(true);
                  }}
                />
              )}
              {!finance && (
                <Text variant="caption" muted>
                  {t("admin2.needsFinance")}
                </Text>
              )}
              <Button
                compact
                variant="ghost"
                title={t("admin2.openInvoice")}
                onPress={() =>
                  router.push({
                    pathname: "/invoice/[id]",
                    params: { id: invoice.id, as: "admin" },
                  })
                }
              />
            </Panel>
          ) : null
        }
      />
      <Panel title={t("admin2.invoiceTools")}>
        <InvoicesDesk />
      </Panel>
      <ConfirmDialog
        visible={recording}
        title={t("admin2.recordPayment")}
        body={t("admin2.recordBody")}
        confirm={t("admin2.record")}
        onCancel={() => setRecording(false)}
        onConfirm={async () => {
          if (!invoice || amountError || !reference.trim()) return;
          setRecording(false);
          await recordPayment(
            store,
            invoice,
            { amount: Number(amount), method, reference: reference.trim() },
            { id: session.name, name: session.name, phone: "" },
            session.role,
          );
        }}
      >
        <FormField
          label={t("admin2.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix="DH"
          required
          error={amountError}
        />
        <FilterChips
          value={method}
          onChange={setMethod}
          options={(["transfer", "cash", "agent"] as const).map((value) => ({
            value,
            label: t(`admin2.method_${value}`),
          }))}
        />
        <FormField
          label={t("admin2.reference")}
          value={reference}
          onChangeText={setReference}
          required
          error={reference.trim() ? null : t("admin2.errReference")}
        />
      </ConfirmDialog>
    </AdminPage>
  );
}

/** Payments (Doc 5 A22): every payment recorded, plus driver claims still waiting for verification. */
export function Payments() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const invoices = useQuery("invoices", []);
  type Row = {
    id: string;
    invoice: string;
    driver: string;
    amount: number;
    method: string;
    reference: string;
    at: number;
    by: string;
    verified: boolean;
    invoiceId: string;
  };
  const rows: Row[] | undefined =
    invoices &&
    [
      ...invoices.flatMap((i) =>
        (i.payments ?? []).map((p, n) => ({
          id: `${i.id}-${n}`,
          invoice: i.number,
          driver: i.driverName,
          amount: p.amount,
          method: t(`admin2.method_${p.method}`),
          reference: p.reference,
          at: p.at,
          by: p.by,
          verified: true,
          invoiceId: i.id,
        })),
      ),
      ...invoices
        .filter((i) => i.status === "paymentSent")
        .map((i) => ({
          id: `${i.id}-claim`,
          invoice: i.number,
          driver: i.driverName,
          amount: i.totalShare,
          method: t(
            i.paymentMethod === "cash"
              ? "invoice.methodCash"
              : "invoice.methodTransfer",
          ),
          reference: i.paymentReference,
          at: i.paymentSentAt ?? i.issuedAt,
          by: i.driverName,
          verified: false,
          invoiceId: i.id,
        })),
    ].sort((a, b) => b.at - a.at);
  return (
    <AdminPage
      title={t("admin2.nav_payments")}
      subtitle={t("admin2.paymentsSub")}
    >
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        onRowPress={(r) =>
          router.push({
            pathname: "/admin/[section]",
            params: { section: "invoices", id: r.invoiceId },
          })
        }
        empty={t("admin2.noPayments")}
        columns={[
          {
            key: "at",
            label: t("admin2.when"),
            render: (r) => dates.dayTime(new Date(r.at)),
          },
          {
            key: "invoice",
            label: t("admin2.invoiceNo"),
            numeric: true,
            render: (r) => r.invoice,
          },
          {
            key: "driver",
            label: t("route.driver"),
            flex: 2,
            render: (r) => r.driver,
          },
          {
            key: "amount",
            label: t("admin2.amount"),
            numeric: true,
            render: (r) => formatMoney(t, r.amount),
          },
          {
            key: "method",
            label: t("admin2.method"),
            render: (r) => `${r.method} · ${r.reference || "—"}`,
          },
          {
            key: "state",
            label: t("admin2.status"),
            render: (r) => (
              <StatusBadge
                status={r.verified ? "paid" : "pending"}
                label={
                  r.verified
                    ? t("admin2.verifiedBy", { name: r.by })
                    : t("admin2.claimOnly")
                }
              />
            ),
          },
        ]}
      />
      <Text variant="caption" muted>
        {t("admin2.claimRule")}
      </Text>
    </AdminPage>
  );
}

/**
 * Commission management (Doc 5 C4 / A23): the current rate, a change form with validation, a
 * confirmation with a required reason, and the history. New rates apply to new bookings only;
 * existing bookings keep their snapshot.
 */
export function Commission() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const dates = useDateFormat();
  const session = useAdminSession();
  const { company } = useCompany();
  const [rate, setRate] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const value = Number(rate.replace(",", "."));
  const error = !rate
    ? null
    : !Number.isFinite(value) || value < 0 || value > 30
      ? t("admin.rateInvalid")
      : value === Math.round(company.commissionRate * 1000) / 10
        ? t("admin2.errSameRate")
        : null;
  const finance = can(session.role, "finance");
  const history = [
    ...(company.commissionHistory ?? [
      {
        rate: company.commissionRate,
        from: company.updatedAt || 0,
        by: "system",
        reason: "default",
      },
    ]),
  ].reverse();
  return (
    <AdminPage
      title={t("admin2.nav_commission")}
      subtitle={t("admin2.commissionSub")}
    >
      <View style={styles.row}>
        <Stat
          label={t("admin2.currentRate")}
          value={`${Math.round(company.commissionRate * 1000) / 10}%`}
          tone={colors.primary}
        />
        <Stat label={t("admin2.appliesTo")} value={t("admin2.newBookings")} />
      </View>
      <Panel title={t("admin2.changeRate")}>
        <FormField
          label={t("admin2.newRate")}
          value={rate}
          onChangeText={setRate}
          keyboardType="decimal-pad"
          suffix="%"
          error={error}
          hint={t("admin.rateNote")}
        />
        <Button
          variant="accent"
          title={t("admin2.reviewChange")}
          disabled={!finance || !rate || !!error}
          onPress={() => setConfirm(true)}
        />
        {!finance && (
          <Text variant="caption" muted>
            {t("admin2.needsFinance")}
          </Text>
        )}
        {done && (
          <Text variant="caption" color={colors.success}>
            {t("admin2.rateSaved")}
          </Text>
        )}
      </Panel>
      <Panel title={t("admin2.history")}>
        <DataTable
          rows={history.map((h, i) => ({ ...h, i }))}
          rowKey={(h) => String(h.i)}
          empty=""
          columns={[
            {
              key: "rate",
              label: t("admin2.rate"),
              numeric: true,
              render: (h) => `${Math.round(h.rate * 1000) / 10}%`,
            },
            {
              key: "from",
              label: t("admin2.effective"),
              render: (h) => (h.from ? dates.dayTime(new Date(h.from)) : "—"),
            },
            { key: "by", label: t("admin2.by"), render: (h) => h.by },
            {
              key: "reason",
              label: t("admin2.reason"),
              flex: 2,
              render: (h) => h.reason,
            },
          ]}
        />
      </Panel>
      <ConfirmDialog
        visible={confirm}
        title={t("admin2.confirmRate", {
          from: `${Math.round(company.commissionRate * 1000) / 10}%`,
          to: `${value}%`,
        })}
        body={t("admin2.confirmRateBody")}
        confirm={t("admin2.applyRate")}
        reason={reason}
        onReason={setReason}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await changeCommission(
            store,
            Math.round(value * 10) / 1000,
            { id: session.name, name: session.name, phone: "" },
            session.role,
            reason,
          );
          setRate("");
          setReason("");
          setDone(true);
        }}
      />
    </AdminPage>
  );
}

/** Financial reports (Doc 5 A24, A29): revenue and activity by week, from the prototype data. */
export function Reports() {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const invoices = useQuery("invoices", []) ?? [];
  const bookings = useQuery("bookings", []) ?? [];
  const byWeek = new Map<string, { billed: number; received: number }>();
  for (const i of invoices) {
    const w = byWeek.get(i.week) ?? { billed: 0, received: 0 };
    w.billed += i.totalShare;
    w.received += i.status === "paid" ? i.totalShare : paidOf(i);
    byWeek.set(i.week, w);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8);
  const max = Math.max(1, ...weeks.map(([, w]) => w.billed));
  const status = (
    ["requested", "confirmed", "inTransit", "completed", "cancelled"] as const
  ).map((s) => ({ s, n: bookings.filter((b) => b.status === s).length }));
  return (
    <AdminPage
      title={t("admin2.nav_reports")}
      subtitle={t("admin2.reportsSub")}
    >
      <Panel title={t("admin2.commissionByWeek")}>
        {weeks.length === 0 && <Text muted>{t("admin.noInvoices")}</Text>}
        {weeks.map(([week, w]) => (
          <View key={week} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Text variant="caption" style={{ flex: 1 }}>
                {dates.dayMonth(weekRange(week).start)}
              </Text>
              <Text variant="caption">
                {formatMoney(t, w.received)} / {formatMoney(t, w.billed)}
              </Text>
            </View>
            <View
              style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    width: `${(w.billed / max) * 100}%`,
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${w.billed ? (w.received / w.billed) * 100 : 0}%`,
                      backgroundColor: colors.primaryFill,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
        <Text variant="caption" muted>
          {t("admin2.chartKey")}
        </Text>
      </Panel>
      <Panel title={t("admin2.bookingsByStatus")}>
        {status.map(({ s, n }) => (
          <InfoRow key={s} label={t(`bookingStatus.${s}`)} value={String(n)} />
        ))}
      </Panel>
      <PrototypeNote text={t("admin2.reportsPrototype")} />
    </AdminPage>
  );
}

/**
 * Platform policies (Doc 5 A25–A26): invoice terms (payment days, grace days) and the shared-load
 * discount policy (PROTOTYPE values until the business approves the formula). Every change asks
 * for a reason and is audited.
 */
export function Policies() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const session = useAdminSession();
  const { company } = useCompany();
  const [due, setDue] = useState(String(company.dueDays));
  const [grace, setGrace] = useState(String(company.graceDays));
  const [rate, setRate] = useState(
    String(Math.round((company.sharingRate ?? 0.25) * 100)),
  );
  const [cap, setCap] = useState(
    String(Math.round((company.sharingCap ?? 0.2) * 100)),
  );
  const [pending, setPending] = useState<"invoice" | "sharing" | null>(null);
  const [reason, setReason] = useState("");
  const allowed = can(session.role, "settings") || can(session.role, "finance");
  const n = (s: string) => Number(s);
  const errors = {
    due: !(Number.isInteger(n(due)) && n(due) >= 1 && n(due) <= 60)
      ? t("admin2.errDays")
      : null,
    grace: !(Number.isInteger(n(grace)) && n(grace) >= 0 && n(grace) <= 60)
      ? t("admin2.errDays")
      : null,
    rate: !(n(rate) >= 0 && n(rate) <= 100) ? t("admin2.errPercent") : null,
    cap: !(n(cap) >= 0 && n(cap) <= 50) ? t("admin2.errCap") : null,
  };
  return (
    <AdminPage
      title={t("admin2.nav_policies")}
      subtitle={t("admin2.policiesSub")}
    >
      <Panel title={t("admin2.invoicePolicy")}>
        <FormField
          label={t("admin.field_dueDays")}
          value={due}
          onChangeText={setDue}
          keyboardType="number-pad"
          error={errors.due}
        />
        <FormField
          label={t("admin.field_graceDays")}
          value={grace}
          onChangeText={setGrace}
          keyboardType="number-pad"
          error={errors.grace}
        />
        <ToggleRow
          label={t("admin2.restrictOverdue")}
          hint={t("admin2.restrictOverdueHint")}
          value
          onChange={() => {}}
        />
        <Button
          variant="accent"
          title={t("admin2.saveWithReason")}
          disabled={!allowed || !!errors.due || !!errors.grace}
          onPress={() => setPending("invoice")}
        />
        <Text variant="caption" muted>
          {t("admin2.issuedKeepDue")}
        </Text>
      </Panel>
      <Panel title={t("admin2.sharingPolicy")}>
        <Text variant="caption" color={colors.star}>
          {t("admin2.sharingPending")}
        </Text>
        <FormField
          label={t("admin2.sharingRate")}
          value={rate}
          onChangeText={setRate}
          keyboardType="number-pad"
          suffix="%"
          error={errors.rate}
          hint={t("admin2.sharingRateHint")}
        />
        <FormField
          label={t("admin2.sharingCap")}
          value={cap}
          onChangeText={setCap}
          keyboardType="number-pad"
          suffix="%"
          error={errors.cap}
          hint={t("admin2.sharingCapHint")}
        />
        <InfoRow
          label={t("admin2.policyVersion")}
          value={company.sharingVersion ?? "proto-1"}
        />
        <Button
          variant="accent"
          title={t("admin2.saveWithReason")}
          disabled={!allowed || !!errors.rate || !!errors.cap}
          onPress={() => setPending("sharing")}
        />
      </Panel>
      {!allowed && <Text muted>{t("admin2.needsSettings")}</Text>}
      <ConfirmDialog
        visible={pending !== null}
        title={t("admin2.saveWithReason")}
        body={t("admin2.policyBody")}
        confirm={t("common.save")}
        reason={reason}
        onReason={setReason}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const who = { id: session.name, name: session.name, phone: "" };
          if (pending === "invoice")
            await changeSettings(
              store,
              { dueDays: n(due), graceDays: n(grace) },
              "invoiceTerms",
              `${company.dueDays}+${company.graceDays}`,
              `${n(due)}+${n(grace)}`,
              who,
              session.role,
              reason,
            );
          if (pending === "sharing") {
            const version = `proto-${Date.now().toString(36).slice(-4)}`;
            await changeSettings(
              store,
              {
                sharingRate: n(rate) / 100,
                sharingCap: n(cap) / 100,
                sharingVersion: version,
              },
              "sharingPolicy",
              company.sharingVersion ?? "proto-1",
              version,
              who,
              session.role,
              reason,
            );
          }
          setPending(null);
          setReason("");
        }}
      />
    </AdminPage>
  );
}

/** Company identity and payment details (separate from the X App brand). */
export function Company() {
  const { t } = useTranslation();
  return (
    <AdminPage
      title={t("admin2.nav_company")}
      subtitle={t("admin.identityBody")}
    >
      <CompanyForm />
    </AdminPage>
  );
}

/** Notification management (Doc 5 A27): channels and their real state — nothing simulated. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const channels = [
    { key: "inApp", on: true, state: t("admin2.chanActive") },
    { key: "push", on: false, state: t("admin2.chanNeedsBackend") },
    { key: "sms", on: false, state: t("admin2.chanNeedsProvider") },
    { key: "whatsapp", on: false, state: t("admin2.chanNeedsProvider") },
  ];
  return (
    <AdminPage
      title={t("admin2.nav_notifications")}
      subtitle={t("admin2.notificationsSub")}
    >
      <DataTable
        rows={channels}
        rowKey={(c) => c.key}
        empty=""
        columns={[
          {
            key: "channel",
            label: t("admin2.channel"),
            flex: 2,
            render: (c) => t(`admin2.chan_${c.key}`),
          },
          {
            key: "state",
            label: t("admin2.status"),
            flex: 2,
            render: (c) => (
              <StatusBadge status={c.on ? "live" : "draft"} label={c.state} />
            ),
          },
        ]}
      />
      <Panel title={t("admin2.events")}>
        {(
          [
            "request",
            "offer",
            "accepted",
            "joined",
            "discount",
            "pickup",
            "delivery",
            "invoice",
            "reminder",
            "overdue",
            "restriction",
          ] as const
        ).map((key) => (
          <InfoRow
            key={key}
            label={t(`admin2.event_${key}`)}
            value={t("admin2.chan_inApp")}
          />
        ))}
        <Text variant="caption" muted>
          {t("admin2.languageRule")}
        </Text>
      </Panel>
    </AdminPage>
  );
}

/** Audit log (Doc 5 A31): who did what, before and after, why, and when. Read-only. */
export function Audit() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const entries = useQuery("audit", []);
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<"all" | "admin" | "system">("all");
  const rows =
    entries &&
    [...entries]
      .filter(
        (e) =>
          (who === "all"
            ? true
            : who === "system"
              ? e.actorRole === "system"
              : e.actorRole !== "system") &&
          `${e.actor} ${e.action} ${e.entityId} ${e.reason}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) => b.at - a.at);
  return (
    <AdminPage title={t("admin2.nav_audit")} subtitle={t("admin2.auditSub")}>
      <Toolbar search={query} onSearch={setQuery}>
        <FilterChips
          value={who}
          onChange={setWho}
          options={(["all", "admin", "system"] as const).map((value) => ({
            value,
            label: t(`admin2.who_${value}`),
          }))}
        />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(e) => e.id}
        empty={t("admin2.noAudit")}
        columns={[
          {
            key: "at",
            label: t("admin2.when"),
            render: (e) => dates.dayTime(new Date(e.at)),
          },
          {
            key: "actor",
            label: t("admin2.by"),
            render: (e) =>
              e.actorRole === "system"
                ? t("admin2.role_system")
                : `${e.actor} · ${t(`admin2.role_${e.actorRole}`, { defaultValue: e.actorRole })}`,
          },
          {
            key: "action",
            label: t("admin2.action"),
            render: (e) =>
              t(`admin2.action_${e.action.replace(".", "_")}`, {
                defaultValue: e.action,
              }),
          },
          {
            key: "entity",
            label: t("admin2.entity"),
            render: (e) => `${e.entity} · ${e.entityId}`,
          },
          {
            key: "change",
            label: t("admin2.change"),
            render: (e) => `${e.before || "—"} → ${e.after || "—"}`,
          },
          {
            key: "reason",
            label: t("admin2.reason"),
            flex: 2,
            render: (e) => e.reason,
          },
        ]}
      />
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.sm,
  },
  track: { height: 14, borderRadius: 7, overflow: "hidden" },
  bar: { height: 14, borderRadius: 7 },
});
