import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { useQuery, useStore } from "@/backend";
import { normalizeJob } from "@/backend/actions";
import { advanceBooking, audit } from "@/backend/prototype";
import type { Job, RouteBooking } from "@/backend/types";
import { AdminPage, Panel } from "@/components/admin/shell";
import { can, useAdminSession } from "@/components/admin/session";
import { DataTable, DetailLayout } from "@/components/admin/table";
import { useDateFormat } from "@/components/date-format";
import {
  ConfirmDialog,
  FilterChips,
  InfoRow,
  PrototypeNote,
  Stat,
  StatusBadge,
  Tag,
} from "@/components/ds";
import { useLocationLabel } from "@/components/location-label";
import { FreightMap } from "@/components/map/freight-map";
import type { MapMarker } from "@/components/map/types";
import { formatMoney } from "@/components/money";
import { bookingStatusKind } from "@/components/route-cards";
import { Text } from "@/components/text";
import { useCompany } from "@/components/use-company";
import { Button } from "@/components/ui";
import { invoiceState } from "@/lib/invoices";
import { fromLocalString } from "@/lib/schedule";
import { Spacing, useColors } from "@/theme";

const ACTIVE_JOB = (j: Job) =>
  !["scheduled", "completed", "cancelled"].includes(j.status);
const ACTIVE_BOOKING = (b: RouteBooking) =>
  b.status === "confirmed" || b.status === "inTransit";

/** Overview (Doc 5 A02): the marketplace at a glance, then what needs attention. */
export function Overview() {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDateFormat();
  const { company } = useCompany();
  const drivers = useQuery("drivers", []);
  const requests = useQuery("requests", []);
  const jobs = (useQuery("jobs", []) ?? []).map(normalizeJob);
  const bookings = useQuery("bookings", []) ?? [];
  const routes = useQuery("routes", []) ?? [];
  const invoices = useQuery("invoices", []) ?? [];
  const disputes = useQuery("disputes", [["status", "open"]]) ?? [];
  const log = [...(useQuery("audit", []) ?? [])]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);
  const [now] = useState(() => Date.now());
  const overdueDrivers = new Set(
    invoices
      .filter((i) =>
        ["overdue", "paused"].includes(invoiceState(i, now, company)),
      )
      .map((i) => i.driverId),
  );
  const commission =
    invoices.reduce((s, i) => s + i.totalShare, 0) +
    jobs
      .filter((j) => j.status === "completed" && !j.invoiceId)
      .reduce((s, j) => s + j.commission, 0);
  const outstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce(
      (s, i) =>
        s + i.totalShare - (i.payments ?? []).reduce((p, x) => p + x.amount, 0),
      0,
    );
  const kpis = [
    {
      label: t("admin2.kpi_drivers"),
      value: String(
        (drivers ?? []).filter((d) => d.verification !== "suspended").length,
      ),
    },
    {
      label: t("admin2.kpi_active"),
      value: String(
        jobs.filter(ACTIVE_JOB).length + bookings.filter(ACTIVE_BOOKING).length,
      ),
      tone: colors.teal,
    },
    {
      label: t("admin2.kpi_waiting"),
      value: String(
        (requests ?? []).filter((r) => r.status === "open").length +
          bookings.filter((b) => b.status === "requested").length,
      ),
      tone: colors.star,
    },
    {
      label: t("admin2.kpi_shared"),
      value: String(
        routes.filter(
          (r) => r.sharing !== "dedicated" && r.status === "published",
        ).length,
      ),
    },
    {
      label: t("admin2.kpi_returns"),
      value: String(
        routes.filter((r) => r.kind === "return" && r.status === "published")
          .length,
      ),
    },
    {
      label: t("admin2.kpi_completed"),
      value: String(
        jobs.filter((j) => j.status === "completed").length +
          bookings.filter((b) => b.status === "completed").length,
      ),
      tone: colors.success,
    },
    {
      label: t("admin2.kpi_commission"),
      value: formatMoney(t, commission),
      tone: colors.primary,
    },
    {
      label: t("admin2.kpi_outstanding"),
      value: formatMoney(t, outstanding),
      tone: colors.accent,
    },
    {
      label: t("admin2.kpi_overdue"),
      value: String(overdueDrivers.size),
      tone: overdueDrivers.size ? colors.accent : undefined,
    },
  ];
  return (
    <AdminPage
      title={t("admin2.nav_overview")}
      subtitle={t("admin2.overviewSub")}
    >
      <PrototypeNote text={t("admin2.prototypeData")} />
      <View style={styles.kpis}>
        {kpis.map((kpi) => (
          <Stat
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            tone={kpi.tone}
            style={styles.kpi}
          />
        ))}
      </View>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Panel title={t("admin2.attention")}>
            {disputes.length > 0 && (
              <Button
                compact
                variant="outline"
                icon="alert-circle-outline"
                title={t("admin2.openDisputes", { count: disputes.length })}
                onPress={() => router.push("/admin/disputes")}
              />
            )}
            {(drivers ?? [])
              .filter((d) => d.verification === "pending")
              .map((d) => (
                <Button
                  key={d.id}
                  compact
                  variant="ghost"
                  icon="shield-outline"
                  title={t("admin2.verifyDriver", { name: d.name })}
                  onPress={() =>
                    router.push({
                      pathname: "/admin/[section]",
                      params: { section: "drivers", id: d.id },
                    })
                  }
                />
              ))}
            {invoices
              .filter((i) => i.status === "paymentSent")
              .map((i) => (
                <Button
                  key={i.id}
                  compact
                  variant="ghost"
                  icon="cash-outline"
                  title={t("admin2.checkPayment", { number: i.number })}
                  onPress={() =>
                    router.push({
                      pathname: "/admin/[section]",
                      params: { section: "invoices", id: i.id },
                    })
                  }
                />
              ))}
            {!disputes.length &&
              !invoices.some((i) => i.status === "paymentSent") &&
              !(drivers ?? []).some((d) => d.verification === "pending") && (
                <Text muted>{t("admin2.nothingPending")}</Text>
              )}
          </Panel>
        </View>
        <View style={styles.column}>
          <Panel
            title={t("admin2.recentActions")}
            action={
              <Button
                compact
                variant="ghost"
                title={t("home2.seeAll")}
                onPress={() => router.push("/admin/audit")}
              />
            }
          >
            {log.map((entry) => (
              <View key={entry.id} style={{ gap: 2 }}>
                <Text variant="caption">
                  {entry.actorRole === "system"
                    ? t("admin2.role_system")
                    : entry.actor}{" "}
                  ·{" "}
                  {t(`admin2.action_${entry.action.replace(".", "_")}`, {
                    defaultValue: entry.action,
                  })}
                </Text>
                <Text variant="caption" muted>
                  {dates.dayTime(new Date(entry.at))} · {entry.entityId}
                </Text>
              </View>
            ))}
          </Panel>
        </View>
      </View>
    </AdminPage>
  );
}

type Layer =
  | "all"
  | "drivers"
  | "active"
  | "shared"
  | "returns"
  | "pending"
  | "delayed";

/**
 * Live operational map (Doc 5 C3): live GPS positions (pulsing, with the age of the fix),
 * planned routes as dashed lines (never shown as a position), active trips solid, shared
 * trips blue, return journeys teal dots, pending requests as boxes at their pickup. Clicking a
 * vehicle or request opens its panel with links to the booking, driver and route.
 */
export function LiveMap() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const jobs = (useQuery("jobs", []) ?? []).map(normalizeJob);
  const requests = useQuery("requests", [["status", "open"]]) ?? [];
  const routes = (useQuery("routes", []) ?? []).filter(
    (r) => r.status === "published" || r.status === "inTransit",
  );
  const [layer, setLayer] = useState<Layer>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const active = jobs.filter(ACTIVE_JOB);
  const delayed = jobs.filter(
    (j) =>
      j.status === "scheduled" &&
      j.scheduledAt &&
      fromLocalString(j.scheduledAt).getTime() < now,
  );
  const show = (l: Layer) => layer === "all" || layer === l;

  const markers: MapMarker[] = [
    ...(show("drivers") || show("active")
      ? active
          .filter((j) => j.driverPos)
          .map((j) => ({
            id: `job:${j.id}`,
            kind: "driver" as const,
            lat: j.driverPos!.lat,
            lng: j.driverPos!.lng,
            label: j.driverName.split(" ")[0],
          }))
      : []),
    ...(show("pending")
      ? requests.map((r) => ({
          id: `req:${r.id}`,
          kind: "load" as const,
          lat: r.from.lat,
          lng: r.from.lng,
          label: formatMoney(t, r.price),
        }))
      : []),
    ...(show("active")
      ? active.flatMap((j) => [
          {
            id: `p:${j.id}`,
            kind: "pickup" as const,
            lat: j.from.lat,
            lng: j.from.lng,
          },
          {
            id: `d:${j.id}`,
            kind: "dropoff" as const,
            lat: j.to.lat,
            lng: j.to.lng,
          },
        ])
      : []),
    ...(show("delayed")
      ? delayed.map((j) => ({
          id: `job:${j.id}`,
          kind: "load" as const,
          lat: j.from.lat,
          lng: j.from.lng,
          label: t("admin2.delayed"),
        }))
      : []),
  ];
  const lines = [
    ...(show("active")
      ? active.map((j) => ({
          id: `a:${j.id}`,
          kind: "active" as const,
          points: [j.from, j.to],
        }))
      : []),
    ...routes
      .filter((r) =>
        r.kind === "return"
          ? show("returns")
          : r.sharing !== "dedicated"
            ? show("shared")
            : layer === "all",
      )
      .map((r) => ({
        id: `r:${r.id}`,
        kind:
          r.kind === "return"
            ? ("return" as const)
            : r.sharing !== "dedicated"
              ? ("shared" as const)
              : ("planned" as const),
        points: [r.from, ...r.stops, r.to],
      })),
  ];
  const focus = markers.length
    ? markers
    : [
        { lat: 33.57, lng: -7.59 },
        { lat: 35.76, lng: -5.83 },
      ];
  const pick = selected?.split(":") ?? [];
  const job =
    pick[0] === "job" ? jobs.find((j) => j.id === pick[1]) : undefined;
  const request =
    pick[0] === "req" ? requests.find((r) => r.id === pick[1]) : undefined;
  const legend: {
    icon: "access-point" | "vector-polyline" | "map-marker" | "package-variant";
    color: string;
    label: string;
  }[] = [
    { icon: "access-point", color: colors.teal, label: t("admin2.legendLive") },
    {
      icon: "vector-polyline",
      color: colors.textMuted,
      label: t("admin2.legendPlanned"),
    },
    {
      icon: "map-marker",
      color: colors.primary,
      label: t("admin2.legendStatic"),
    },
    {
      icon: "package-variant",
      color: colors.star,
      label: t("admin2.legendPending"),
    },
  ];

  return (
    <AdminPage title={t("admin2.nav_map")} subtitle={t("admin2.mapSub")}>
      <FilterChips<Layer>
        value={layer}
        onChange={setLayer}
        options={(
          [
            "all",
            "drivers",
            "active",
            "shared",
            "returns",
            "pending",
            "delayed",
          ] as const
        ).map((value) => ({ value, label: t(`admin2.layer_${value}`) }))}
      />
      <DetailLayout
        table={
          <>
            <View style={styles.map}>
              <FreightMap
                fill
                markers={markers}
                lines={lines}
                focus={focus}
                focusKey={`${layer}|${markers.length}|${lines.length}`}
                onMarkerPress={setSelected}
                selected={selected}
              />
            </View>
            <View style={styles.legend}>
              {legend.map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={18}
                    color={item.color}
                  />
                  <Text variant="caption">{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        }
        detail={
          job ? (
            <Panel title={t("admin2.vehicleOnTrip")}>
              <StatusBadge
                status="inTransit"
                label={t(`status.${job.status}`)}
              />
              <InfoRow label={t("route.driver")} value={job.driverName} />
              <InfoRow
                label={t("book.route")}
                value={names.shortRoute(job.from, job.to)}
              />
              <InfoRow
                label={t("route.vehicle")}
                value={t(`vehicle.${job.vehicle}`)}
              />
              <InfoRow
                label={t("admin2.price")}
                value={formatMoney(t, job.price)}
              />
              <InfoRow
                label={t("admin2.commission")}
                value={formatMoney(t, job.commission)}
              />
              <InfoRow
                label={t("admin2.lastFix")}
                value={
                  job.driverPosAt
                    ? dates.dayTime(new Date(job.driverPosAt))
                    : t("admin2.noFix")
                }
              />
              {job.simulated && (
                <Tag
                  icon="flask-outline"
                  tone="gold"
                  label={t("admin2.simulatedGps")}
                />
              )}
              <Button
                compact
                variant="outline"
                title={t("admin2.viewBookings")}
                onPress={() => router.push("/admin/bookings")}
              />
            </Panel>
          ) : request ? (
            <Panel title={t("admin2.pendingRequest")}>
              <InfoRow
                label={t("book.route")}
                value={names.shortRoute(request.from, request.to)}
              />
              <InfoRow
                label={t("admin2.customer")}
                value={request.clientName}
              />
              <InfoRow
                label={t("admin2.price")}
                value={formatMoney(t, request.price)}
              />
              <Button
                compact
                variant="outline"
                title={t("admin2.viewRequests")}
                onPress={() => router.push("/admin/requests")}
              />
            </Panel>
          ) : (
            <Panel title={t("admin2.selectSomething")}>
              <Text muted>
                {t("admin2.selectBody", {
                  live: active.filter((j) => j.driverPos).length,
                  routes: routes.length,
                  pending: requests.length,
                })}
              </Text>
            </Panel>
          )
        }
      />
      <PrototypeNote text={t("admin2.mapPrototype")} />
    </AdminPage>
  );
}

/** Active operations (Doc 5 A17): every trip under way or due, with intervention by reason. */
export function ActiveOps() {
  const { t } = useTranslation();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const session = useAdminSession();
  const jobs = (useQuery("jobs", []) ?? []).map(normalizeJob);
  const bookings = useQuery("bookings", []);
  const [cancel, setCancel] = useState<RouteBooking | null>(null);
  const [reason, setReason] = useState("");
  const allowed = can(session.role, "operations");
  type Row = {
    id: string;
    kind: "job" | "booking";
    route: string;
    who: string;
    status: string;
    badge: ReturnType<typeof bookingStatusKind>;
    when: string;
    booking?: RouteBooking;
  };
  const rows: Row[] | undefined =
    bookings === undefined
      ? undefined
      : [
          ...jobs
            .filter((j) => j.status !== "completed" && j.status !== "cancelled")
            .map((j) => ({
              id: j.id,
              kind: "job" as const,
              route: names.shortRoute(j.from, j.to),
              who: `${j.driverName} · ${j.clientName}`,
              status: t(`status.${j.status}`),
              badge:
                j.status === "scheduled"
                  ? ("confirmed" as const)
                  : ("inTransit" as const),
              when: j.scheduledAt
                ? dates.pickupShort(j.scheduledAt)
                : dates.dayTime(new Date(j.createdAt)),
            })),
          ...bookings
            .filter((b) =>
              [
                "requested",
                "awaitingOriginal",
                "confirmed",
                "inTransit",
                "delivered",
              ].includes(b.status),
            )
            .map((b) => ({
              id: b.id,
              kind: "booking" as const,
              route: names.shortRoute(b.from, b.to),
              who: `${b.driverName} · ${b.customerName}`,
              status: t(`bookingStatus.${b.status}`),
              badge: bookingStatusKind(b.status),
              when: b.ref,
              booking: b,
            })),
        ];
  return (
    <AdminPage title={t("admin2.nav_active")} subtitle={t("admin2.activeSub")}>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={t("admin2.noActive")}
        columns={[
          {
            key: "route",
            label: t("book.route"),
            flex: 2,
            render: (r) => r.route,
          },
          {
            key: "who",
            label: t("admin2.driverCustomer"),
            flex: 2,
            render: (r) => r.who,
          },
          {
            key: "status",
            label: t("admin2.status"),
            render: (r) => <StatusBadge status={r.badge} label={r.status} />,
          },
          { key: "when", label: t("admin2.whenRef"), render: (r) => r.when },
          {
            key: "act",
            label: t("admin2.intervene"),
            render: (r) =>
              r.booking ? (
                <Button
                  compact
                  variant="danger"
                  title={t("admin2.cancel")}
                  disabled={!allowed}
                  onPress={() => setCancel(r.booking!)}
                />
              ) : (
                <Button
                  compact
                  variant="ghost"
                  title={t("admin2.open")}
                  onPress={() => router.push("/admin/bookings")}
                />
              ),
          },
        ]}
      />
      {!allowed && <Text muted>{t("admin2.needsOps")}</Text>}
      <ConfirmDialog
        visible={!!cancel}
        danger
        title={t("admin2.cancelBooking", { ref: cancel?.ref ?? "" })}
        body={t("admin2.cancelBody")}
        confirm={t("booking.cancel")}
        reason={reason}
        onReason={setReason}
        onCancel={() => setCancel(null)}
        onConfirm={async () => {
          if (!cancel) return;
          await advanceBooking(store, cancel, "cancelled");
          await audit(store, {
            actor: session.name,
            actorRole: session.role,
            action: "booking.cancel",
            entity: "booking",
            entityId: cancel.ref,
            before: cancel.status,
            after: "cancelled",
            reason,
          });
          setCancel(null);
          setReason("");
        }}
      />
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  kpi: { flexBasis: 200 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  column: { flexGrow: 1, flexBasis: 360, gap: Spacing.md },
  map: { height: 520, borderRadius: 16, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
});
