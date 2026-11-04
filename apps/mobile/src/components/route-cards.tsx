/**
 * Cards for the route marketplace, shared by the customer, driver and admin screens:
 * RouteCard (a published driver route, shared trip or return journey), BookingCard (a route
 * booking) and CapacityBar (weight / volume / seats left). One look everywhere.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import type { DriverRoute, RouteBooking } from "@/backend/types";
import { useDateFormat } from "@/components/date-format";
import { StatusBadge, Tag, type StatusKind } from "@/components/ds";
import { useLocationLabel } from "@/components/location-label";
import { formatMoney } from "@/components/money";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Text } from "@/components/text";
import { vehicleImage } from "@/constants/vehicles";
import { useLanguage } from "@/i18n/language-provider";
import { remaining } from "@/lib/sharing";
import { Fonts, Radius, rim, Spacing, useColors } from "@/theme";

export function routeStatusKind(status: DriverRoute["status"]): StatusKind {
  return (
    {
      draft: "draft",
      published: "published",
      full: "confirmed",
      inTransit: "inTransit",
      completed: "completed",
      withdrawn: "cancelled",
    } as const
  )[status];
}

export function bookingStatusKind(status: RouteBooking["status"]): StatusKind {
  return (
    {
      requested: "pending",
      awaitingOriginal: "pending",
      confirmed: "confirmed",
      inTransit: "inTransit",
      delivered: "delivered",
      completed: "completed",
      cancelled: "cancelled",
      declined: "cancelled",
    } as const
  )[status];
}

/** "1.2 t · 8 m³ · 1 seat" left on the vehicle. */
export function useCapacityText() {
  const { t } = useTranslation();
  return (c: { tons: number; volumeM3: number; seats: number }) =>
    [
      t("cap.tons", { n: Math.max(0, c.tons) }),
      t("cap.m3", { n: Math.max(0, c.volumeM3) }),
      t("cap.seats", { n: Math.max(0, c.seats) }),
    ].join(" · ");
}

/** A published route, as the customer sees it in search results and on the home screen. */
export function RouteCard({
  route,
  onPress,
  compact,
}: {
  route: DriverRoute;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const capacityText = useCapacityText();
  const { rtl } = useLanguage();
  const left = remaining(route.capacity, route.reserved);
  const shared = route.sharing !== "dedicated";
  // The price sits under the route so long city names (Arabic, French) keep the card's width.
  const price = (
    <>
      <Text variant="subtitle" color={colors.primary}>
        {formatMoney(t, route.price)}
      </Text>
      {shared && (
        <Text variant="caption" muted>
          {t("route.sharedFrom", { price: formatMoney(t, route.sharePrice) })}
        </Text>
      )}
    </>
  );
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={
        onPress ??
        (() =>
          router.push({ pathname: "/route/[id]", params: { id: route.id } }))
      }
      style={[
        styles.card,
        compact && styles.compact,
        { backgroundColor: colors.surface },
        rim(colors),
      ]}
    >
      <View style={styles.top}>
        <View
          style={[styles.vehicle, { backgroundColor: colors.surfaceMuted }]}
        >
          <Image
            source={vehicleImage(route.vehicle)}
            style={[
              styles.vehicleImage,
              rtl && { transform: [{ scaleX: -1 }] },
            ]}
            contentFit="contain"
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{names.shortRoute(route.from, route.to)}</Text>
          <Text variant="caption" muted>
            {dates.pickupShort(route.departAt)}
          </Text>
          {price}
        </View>
        {!compact && <View style={{ alignItems: "flex-end" }}>{price}</View>}
      </View>
      <View style={styles.tags}>
        {route.kind === "return" && (
          <Tag icon="backup-restore" tone="teal" label={t("route.returnTag")} />
        )}
        {shared ? (
          <Tag icon="account-multiple-outline" label={t("route.sharedTag")} />
        ) : (
          <Tag
            icon="truck-outline"
            tone="neutral"
            label={t("route.dedicatedTag")}
          />
        )}
        {route.verified && (
          <Tag icon="shield-check" tone="green" label={t("route.verified")} />
        )}
      </View>
      {!compact && (
        <View style={styles.meta}>
          <MaterialCommunityIcons name="star" size={15} color={colors.star} />
          <Text variant="caption" muted style={{ flex: 1 }}>
            {route.driverName} · {route.driverRating.toFixed(1)} ·{" "}
            {t(`vehicle.${route.vehicle}`)}
          </Text>
        </View>
      )}
      <Text variant="caption" color={colors.teal} style={styles.capacity}>
        {t("route.left", { capacity: capacityText(left) })}
      </Text>
    </PressableScale>
  );
}

/** A booking on a route: reference, route, status, price (with a shared discount when there is one). */
export function BookingCard({
  booking,
  onPress,
  driverView,
}: {
  booking: RouteBooking;
  onPress?: () => void;
  driverView?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={
        onPress ??
        (() =>
          router.push({
            pathname: "/booking/[id]",
            params: { id: booking.id },
          }))
      }
      style={[styles.card, { backgroundColor: colors.surface }, rim(colors)]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons
            name={
              booking.mode === "shared"
                ? "account-multiple-outline"
                : "truck-outline"
            }
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">
            {names.shortRoute(booking.from, booking.to)}
          </Text>
          <Text variant="caption" muted>
            {booking.ref} ·{" "}
            {driverView ? booking.customerName : booking.driverName}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text variant="label">{formatMoney(t, booking.price)}</Text>
          {booking.discount > 0 && (
            <Text
              variant="caption"
              color={colors.success}
              style={{ fontFamily: Fonts.semibold }}
            >
              −{formatMoney(t, booking.discount)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.tags}>
        <StatusBadge
          status={bookingStatusKind(booking.status)}
          label={t(`bookingStatus.${booking.status}`)}
        />
        {booking.role === "joiner" && (
          <Tag icon="account-plus-outline" label={t("booking.joiner")} />
        )}
        {booking.allowSharing && booking.role === "original" && (
          <Tag
            icon="account-multiple-outline"
            label={t("booking.sharingAllowed")}
          />
        )}
      </View>
    </PressableScale>
  );
}

/** A thin bar per dimension (weight, volume, seats) showing how much of the vehicle is taken. */
export function CapacityBars({ route }: { route: DriverRoute }) {
  const { t } = useTranslation();
  const colors = useColors();
  const rows: { key: "tons" | "volumeM3" | "seats"; label: string }[] = [
    { key: "tons", label: t("cap.weight") },
    { key: "volumeM3", label: t("cap.volume") },
    { key: "seats", label: t("cap.seatsWord") },
  ];
  return (
    <View style={{ gap: Spacing.sm }}>
      {rows.map(({ key, label }) => {
        const total = route.capacity[key];
        const used = route.reserved[key];
        const share = total > 0 ? Math.min(1, used / total) : 0;
        return (
          <View key={key} style={{ gap: 4 }}>
            <View style={styles.barHead}>
              <Text variant="caption" style={{ flex: 1 }}>
                {label}
              </Text>
              <Text variant="caption" muted>
                {t("cap.usedOf", {
                  used: Math.round(used * 10) / 10,
                  total,
                  unit: t(`cap.unit_${key}`),
                })}
              </Text>
            </View>
            {/* Bars fill from the reading start (right in Arabic). */}
            <View
              style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${share * 100}%`,
                    backgroundColor:
                      share >= 1 ? colors.accentFill : colors.teal,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  compact: { width: 280 },
  top: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  vehicle: {
    width: 64,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleImage: { width: 58, height: 38 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  capacity: { fontFamily: Fonts.semibold },
  barHead: { flexDirection: "row", alignItems: "center" },
  bar: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
});
