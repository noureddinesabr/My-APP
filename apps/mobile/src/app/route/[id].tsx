import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { useDoc, useQuery, useStore } from "@/backend";
import {
  advanceBooking,
  bookingNeeds,
  confirmCash,
  driverDecide,
  setRouteStatus,
} from "@/backend/prototype";
import type { DriverRoute, RouteBooking } from "@/backend/types";
import { ContactButtons } from "@/components/contact-buttons";
import { useDateFormat } from "@/components/date-format";
import {
  ConfirmDialog,
  FormField,
  InfoRow,
  PageHeader,
  PrototypeNote,
  SectionHeader,
  StateView,
  StatusBadge,
  Tag,
} from "@/components/ds";
import { useLocationLabel } from "@/components/location-label";
import { FreightMap } from "@/components/map/freight-map";
import { formatMoney } from "@/components/money";
import {
  BookingCard,
  CapacityBars,
  routeStatusKind,
  useCapacityText,
} from "@/components/route-cards";
import { Text } from "@/components/text";
import { Button, Card, Screen } from "@/components/ui";
import { vehicleImage } from "@/constants/vehicles";
import { useLanguage } from "@/i18n/language-provider";
import { remaining } from "@/lib/sharing";
import { play } from "@/lib/sounds";
import { useAccount } from "@/state/account";
import { Spacing, useColors } from "@/theme";

/** Sample reviews shown on driver profiles in the prototype (no review system yet). */
const SAMPLE_REVIEWS = [
  { stars: 5, key: "route.review1" },
  { stars: 5, key: "route.review2" },
  { stars: 4, key: "route.review3" },
];

/**
 * One driver route. Customers see the offer details (Doc 5 C08): driver and verification,
 * vehicle, map, times, capacity left, price, reviews, conditions, then Book. The driver who
 * owns it manages it instead (D15, D18–D19): booking requests to accept, the shared journey's
 * bookings and stops, trip progress, cash received, capacity after loading, return journey.
 */
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const route = useDoc("routes", id);
  const { driver } = useAccount();
  if (route === undefined)
    return (
      <Screen>
        <StateView state="loading" />
      </Screen>
    );
  if (route === null)
    return (
      <Screen
        header={
          <PageHeader title={t("route.title")} onBack={() => router.back()} />
        }
      >
        <StateView
          state="error"
          title={t("route.missing")}
          action={t("common.back")}
          onAction={() => router.back()}
        />
      </Screen>
    );
  // The driver who published it manages it, whichever side of the app they came from.
  const owner = !!driver && driver.id === route.driverId;
  return owner ? <ManageRoute route={route} /> : <RouteOffer route={route} />;
}

function RouteMap({ route }: { route: DriverRoute }) {
  const { t } = useTranslation();
  return (
    <FreightMap
      height={200}
      markers={[
        {
          id: "from",
          kind: "pickup",
          lat: route.from.lat,
          lng: route.from.lng,
          label: t("map.pickup"),
        },
        ...route.stops.map((stop, i) => ({
          id: `stop${i}`,
          kind: "pick" as const,
          lat: stop.lat,
          lng: stop.lng,
        })),
        {
          id: "to",
          kind: "dropoff",
          lat: route.to.lat,
          lng: route.to.lng,
          label: t("map.dropoff"),
        },
      ]}
      route={[route.from, ...route.stops, route.to]}
      focus={[route.from, route.to]}
      focusKey={route.id}
    />
  );
}

function RouteOffer({ route }: { route: DriverRoute }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const capacityText = useCapacityText();
  const { rtl } = useLanguage();
  const left = remaining(route.capacity, route.reserved);
  const canDedicated = route.sharing !== "shared" && route.reserved.tons === 0;
  const canShare = route.sharing !== "dedicated";
  const full = left.tons <= 0;
  const book = (mode: "dedicated" | "shared") =>
    router.push({
      pathname: "/book/[routeId]",
      params: { routeId: route.id, mode },
    });

  return (
    <Screen
      header={
        <PageHeader
          title={names.shortRoute(route.from, route.to)}
          subtitle={dates.pickupShort(route.departAt)}
          onBack={() => router.back()}
        />
      }
      footer={
        full ? undefined : (
          <View style={{ gap: Spacing.xs }}>
            {canDedicated && (
              <Button
                variant="accent"
                icon="cube-outline"
                title={t("route.bookWhole", {
                  price: formatMoney(t, route.price),
                })}
                onPress={() => book("dedicated")}
              />
            )}
            {canShare && (
              <Button
                variant={canDedicated ? "outline" : "accent"}
                icon="people-outline"
                title={t("route.bookShared", {
                  price: formatMoney(t, route.sharePrice),
                })}
                onPress={() => book("shared")}
              />
            )}
          </View>
        )
      }
    >
      <RouteMap route={route} />
      <View style={styles.tags}>
        <StatusBadge
          status={routeStatusKind(route.status)}
          label={t(`routeStatus.${route.status}`)}
        />
        {route.kind === "return" && (
          <Tag icon="backup-restore" tone="teal" label={t("route.returnTag")} />
        )}
        {canShare ? (
          <Tag icon="account-multiple-outline" label={t("route.sharedTag")} />
        ) : (
          <Tag
            icon="truck-outline"
            tone="neutral"
            label={t("route.dedicatedTag")}
          />
        )}
      </View>

      <Card>
        <SectionHeader title={t("route.driver")} />
        <View style={styles.row}>
          <View
            style={[styles.avatar, { backgroundColor: colors.primarySoft }]}
          >
            <Text variant="label" color={colors.primary}>
              {route.driverName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{route.driverName}</Text>
            <Text variant="caption" muted>
              ★ {route.driverRating.toFixed(1)} ·{" "}
              {t("route.trips", { count: route.driverTrips })}
            </Text>
          </View>
          {route.verified ? (
            <Tag icon="shield-check" tone="green" label={t("route.verified")} />
          ) : (
            <Tag
              icon="shield-alert-outline"
              tone="gold"
              label={t("route.notVerified")}
            />
          )}
        </View>
      </Card>

      <Card>
        <SectionHeader title={t("route.vehicle")} />
        <View style={styles.row}>
          <Image
            source={vehicleImage(route.vehicle)}
            style={[styles.vehicle, rtl && { transform: [{ scaleX: -1 }] }]}
            contentFit="contain"
          />
          <View style={{ flex: 1 }}>
            <Text variant="label">{t(`vehicle.${route.vehicle}`)}</Text>
            <Text variant="caption" muted>
              {t(`payload.${route.vehicle}`)}
            </Text>
          </View>
        </View>
        <CapacityBars route={route} />
        <Text variant="caption" color={colors.teal}>
          {t("route.left", { capacity: capacityText(left) })}
        </Text>
      </Card>

      <Card>
        <SectionHeader title={t("route.schedule")} />
        <InfoRow
          label={t("route.departure")}
          value={dates.pickupShort(route.departAt)}
        />
        <InfoRow
          label={t("route.arrival")}
          value={dates.pickupShort(route.arriveAt)}
        />
        {route.stops.length > 0 && (
          <InfoRow
            label={t("route.stops")}
            value={route.stops.map((s) => names.short(s)).join(" · ")}
          />
        )}
      </Card>

      <Card>
        <SectionHeader title={t("route.price")} />
        {route.sharing !== "shared" && (
          <InfoRow
            label={t("route.priceWhole")}
            value={formatMoney(t, route.price)}
            strong
          />
        )}
        {canShare && (
          <InfoRow
            label={t("route.priceShared")}
            value={formatMoney(t, route.sharePrice)}
          />
        )}
        <Text variant="caption" muted>
          {t("route.priceNote")}
        </Text>
      </Card>

      <Card>
        <SectionHeader title={t("route.conditions")} />
        {(["cash", "cancel", "cargo", "seat"] as const).map((key) => (
          <View key={key} style={styles.condition}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={18}
              color={colors.success}
            />
            <Text variant="caption" style={{ flex: 1 }}>
              {t(`route.cond_${key}`)}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader title={t("route.reviews")} />
        {!route.id.startsWith("proto-") && (
          <Text variant="caption" muted>
            {t("route.noReviews")}
          </Text>
        )}
        {route.id.startsWith("proto-") &&
          SAMPLE_REVIEWS.map((review) => (
            <View key={review.key} style={{ gap: 2 }}>
              <Text variant="caption" color={colors.star}>
                {"★".repeat(review.stars)}
              </Text>
              <Text variant="caption">{t(review.key)}</Text>
            </View>
          ))}
        {route.id.startsWith("proto-") && <PrototypeNote inline />}
      </Card>
      {full && <StateView state="empty" title={t("route.full")} compact />}
      <PrototypeNote text={t("route.prototype")} />
    </Screen>
  );
}

/** The driver's own route: requests, the (shared) journey's bookings, progress and capacity. */
function ManageRoute({ route }: { route: DriverRoute }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const dates = useDateFormat();
  const bookings = useQuery("bookings", [["routeId", route.id]]);
  const [message, setMessage] = useState<string | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const [editCapacity, setEditCapacity] = useState(false);
  const [tons, setTons] = useState(String(route.capacity.tons));
  const [volume, setVolume] = useState(String(route.capacity.volumeM3));
  const [seats, setSeats] = useState(String(route.capacity.seats));
  const list = [...(bookings ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  const requests = list.filter((b) => b.status === "requested");
  const waiting = list.filter((b) => b.status === "awaitingOriginal");
  const active = list.filter((b) =>
    ["confirmed", "inTransit", "delivered", "completed"].includes(b.status),
  );
  const revenue = active.reduce((sum, b) => sum + b.price, 0);
  const capErrors = {
    tons:
      Number(tons) >= route.reserved.tons ? null : t("route.capBelowReserved"),
    volume:
      Number(volume) >= route.reserved.volumeM3
        ? null
        : t("route.capBelowReserved"),
    seats:
      Number(seats) >= route.reserved.seats
        ? null
        : t("route.capBelowReserved"),
  };

  const decide = async (booking: RouteBooking, accept: boolean) => {
    const result = await driverDecide(store, booking, accept);
    play(result === "noCapacity" ? "error" : "success");
    setMessage(t(`route.decide_${result}`));
  };

  return (
    <Screen
      header={
        <PageHeader
          title={names.shortRoute(route.from, route.to)}
          subtitle={dates.pickupShort(route.departAt)}
          onBack={() => router.back()}
        />
      }
    >
      <RouteMap route={route} />
      <View style={styles.tags}>
        <StatusBadge
          status={routeStatusKind(route.status)}
          label={t(`routeStatus.${route.status}`)}
        />
        {route.kind === "return" && (
          <Tag icon="backup-restore" tone="teal" label={t("route.returnTag")} />
        )}
        <Tag
          icon="cash"
          tone="green"
          label={t("route.revenue", { amount: formatMoney(t, revenue) })}
        />
      </View>
      {!!message && <StateView state="success" compact title={message} />}

      <Card>
        <SectionHeader
          title={t("route.capacityTitle")}
          action={t("route.updateCapacity")}
          onAction={() => setEditCapacity(true)}
        />
        <CapacityBars route={route} />
      </Card>

      <SectionHeader title={t("route.requests", { count: requests.length })} />
      {requests.length === 0 && (
        <StateView state="empty" compact title={t("route.noRequests")} />
      )}
      {requests.map((booking) => {
        const need = bookingNeeds(booking);
        return (
          <Card key={booking.id}>
            <BookingCard
              booking={booking}
              driverView
              onPress={() =>
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: booking.id },
                })
              }
            />
            <Text variant="caption">
              {booking.cargo.description} · {t("cap.tons", { n: need.tons })} ·{" "}
              {t("cap.m3", { n: need.volumeM3 })} ·{" "}
              {t(`accompany.${booking.accompaniment}`)}
            </Text>
            {booking.role === "joiner" && (
              <Text variant="caption" color={colors.teal}>
                {booking.extraStops
                  ? t("route.joinExtraStops")
                  : t("route.joinOnRoute")}{" "}
                ·{" "}
                {t("route.extraRevenue", {
                  amount: formatMoney(t, booking.price),
                })}
              </Text>
            )}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  compact
                  variant="ghost"
                  title={t("route.decline")}
                  onPress={() => decide(booking, false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  compact
                  variant="accent"
                  icon="checkmark"
                  title={t("route.accept")}
                  onPress={() => decide(booking, true)}
                />
              </View>
            </View>
          </Card>
        );
      })}
      {waiting.map((booking) => (
        <Card key={booking.id}>
          <BookingCard booking={booking} driverView />
          <Text variant="caption" muted>
            {t("route.waitingOriginal")}
          </Text>
        </Card>
      ))}

      <SectionHeader title={t("route.journey", { count: active.length })} />
      {active.length === 0 && (
        <StateView state="empty" compact title={t("route.noBookings")} />
      )}
      {active.map((booking) => (
        <Card key={booking.id}>
          <BookingCard booking={booking} driverView />
          <ContactButtons phone={booking.customerPhone} />
          <View style={styles.actions}>
            {booking.status === "confirmed" && (
              <View style={{ flex: 1 }}>
                <Button
                  compact
                  variant="primary"
                  icon="arrow-up-circle-outline"
                  title={t("route.pickedUp")}
                  onPress={() => advanceBooking(store, booking, "inTransit")}
                />
              </View>
            )}
            {booking.status === "inTransit" && (
              <View style={{ flex: 1 }}>
                <Button
                  compact
                  variant="primary"
                  icon="flag-outline"
                  title={t("route.delivered")}
                  onPress={() => advanceBooking(store, booking, "delivered")}
                />
              </View>
            )}
            {(booking.status === "delivered" ||
              booking.status === "inTransit") &&
              booking.payment !== "cashConfirmed" && (
                <View style={{ flex: 1 }}>
                  <Button
                    compact
                    variant="accent"
                    icon="cash-outline"
                    title={t("route.cashReceived", {
                      amount: formatMoney(t, booking.price),
                    })}
                    onPress={() => confirmCash(store, booking)}
                  />
                </View>
              )}
          </View>
          <InfoRow
            label={t("booking.payment")}
            value={t(`payment.${booking.payment}`)}
          />
        </Card>
      ))}

      {route.kind === "outbound" && route.status !== "withdrawn" && (
        <Card>
          <SectionHeader title={t("route.returnTitle")} />
          <Text variant="caption" muted>
            {t("route.returnBody", {
              route: names.shortRoute(route.to, route.from),
            })}
          </Text>
          <Button
            variant="outline"
            icon="return-down-back-outline"
            title={t("route.publishReturn")}
            onPress={() =>
              router.push({
                pathname: "/route-new",
                params: { returnOf: route.id },
              })
            }
          />
        </Card>
      )}
      {route.status === "published" && (
        <Button
          variant="danger"
          icon="close-circle-outline"
          title={t("route.withdraw")}
          onPress={() => setWithdraw(true)}
        />
      )}
      <PrototypeNote text={t("route.prototypeDriver")} />

      <ConfirmDialog
        visible={withdraw}
        danger
        title={t("route.withdrawTitle")}
        body={
          active.length
            ? t("route.withdrawBodyBooked", { count: active.length })
            : t("route.withdrawBody")
        }
        confirm={t("route.withdraw")}
        onCancel={() => setWithdraw(false)}
        onConfirm={async () => {
          setWithdraw(false);
          await setRouteStatus(store, route, "withdrawn");
        }}
      />
      <ConfirmDialog
        visible={editCapacity}
        title={t("route.updateCapacity")}
        body={t("route.updateCapacityBody")}
        confirm={t("common.save")}
        onCancel={() => setEditCapacity(false)}
        onConfirm={async () => {
          if (capErrors.tons || capErrors.volume || capErrors.seats) return;
          setEditCapacity(false);
          await store.update("routes", route.id, {
            capacity: {
              tons: Number(tons),
              volumeM3: Number(volume),
              seats: Number(seats),
            },
          });
        }}
      >
        <FormField
          label={t("cap.weight")}
          value={tons}
          onChangeText={setTons}
          keyboardType="decimal-pad"
          suffix="t"
          error={capErrors.tons}
        />
        <FormField
          label={t("cap.volume")}
          value={volume}
          onChangeText={setVolume}
          keyboardType="decimal-pad"
          suffix="m³"
          error={capErrors.volume}
        />
        <FormField
          label={t("cap.seatsWord")}
          value={seats}
          onChangeText={setSeats}
          keyboardType="number-pad"
          error={capErrors.seats}
        />
      </ConfirmDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicle: { width: 96, height: 60 },
  condition: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  actions: { flexDirection: "row", gap: Spacing.sm },
});
