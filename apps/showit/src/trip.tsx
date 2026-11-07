import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickupTime, stepText, tripPlan } from './engine';
import { autoDir } from './composer';
import { useT, type Key } from './i18n';
import type { LatLng } from './lib/geo';
import { getPlace } from './lib/places';
import { useRoadRoute } from './map/trip';
import { Overlay } from './overlay';
import { appMessage, getState, notify, patchRequest, scheduleExampleOffers, SIM, update, type Request } from './store';
import { Btn, ColorsContext, T, tap, useColors, useKeyboardInset } from './ui';

// ---------- A panel rising from the bottom ----------

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      rise.setValue(0);
      Animated.spring(rise, { toValue: 1, useNativeDriver: true, friction: 9 }).start();
    }
  }, [visible, rise]);
  return (
    <Overlay visible={visible} onClose={onClose}>
      <ColorsContext.Provider value={c}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(19,20,26,0.45)' }} />
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, paddingBottom: keyboard ? keyboard + 12 : insets.bottom + 16, gap: 14, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={20} weight="heavy" style={{ flex: 1 }}>
              {title}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color={c.fg} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </ColorsContext.Provider>
    </Overlay>
  );
}

// ---------- Where the vehicle is ----------

const lerp = (a: LatLng, b: LatLng, k: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k });
const km = (a: LatLng, b: LatLng) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
/** The point a share `k` (0–1) of the way along a line of points. */
function along(path: LatLng[], k: number): LatLng {
  if (path.length < 2) return path[0];
  const parts = path.slice(1).map((p, i) => km(path[i], p));
  const total = parts.reduce((s, x) => s + x, 0) || 1;
  let left = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < parts.length; i++) {
    if (left <= parts[i]) return lerp(path[i], path[i + 1], parts[i] ? left / parts[i] : 0);
    left -= parts[i];
  }
  return path[path.length - 1];
}
/** Where an example driver starts from: a little way from the pickup. */
export const startPoint = (p: LatLng): LatLng => ({ lat: p.lat + 0.011, lng: p.lng + 0.013 });

/**
 * Where the vehicle is now and how long until the next place: an example driver follows the
 * road on a timer; a real (test) driver is wherever their phone's GPS last said.
 */
export function useVehicle(r: Request | undefined): { pos: LatLng | null; etaMin: number | null } {
  const [, bump] = useState(0);
  const moving = !!r && (r.stage === 'enroute' || r.stage === 'loaded' || r.stage === 'arrived');
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => bump((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [moving]);
  const a = getPlace(r?.fromPlaceId);
  const b = getPlace(r?.toPlaceId);
  const P = a ? { lat: a.lat, lng: a.lng } : undefined;
  const D = b ? { lat: b.lat, lng: b.lng } : undefined;
  const road = useRoadRoute(P, D);
  if (!r || !P) return { pos: null, etaMin: null };
  const now = Date.now();
  const since = now - (r.phaseAt ?? now);
  if (!r.driverIsExample) {
    const pos = r.driverPos && now - r.driverPos.at < 10 * 60_000 ? { lat: r.driverPos.lat, lng: r.driverPos.lng } : null;
    const target = r.stage === 'loaded' ? D : P;
    return { pos, etaMin: pos && target && (r.stage === 'enroute' || r.stage === 'loaded') ? Math.max(1, Math.round((km(pos, target) / 30) * 60)) : null };
  }
  const S = startPoint(P);
  if (r.stage === 'enroute') {
    const k = since / SIM.toPickup;
    const pos = lerp(S, P, Math.min(1, k));
    return { pos, etaMin: Math.max(1, Math.round((km(pos, P) / 30) * 60)) };
  }
  if (r.stage === 'arrived') return { pos: P, etaMin: null };
  if (r.stage === 'loaded' && D) {
    const k = since / SIM.toDrop;
    const pos = along(road.length > 1 ? road : [P, D], Math.min(1, k));
    return { pos, etaMin: Math.max(1, Math.round((km(pos, D) / 40) * 60)) };
  }
  if (r.stage === 'delivered' && D) return { pos: D, etaMin: null };
  if (r.stage === 'accepted' && r.when === 'now') return { pos: S, etaMin: null };
  return { pos: null, etaMin: null };
}

/** Loading time so far, as m:ss. */
export function useLoadingTimer(r: Request | undefined) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (r?.stage !== 'arrived') return;
    const id = setInterval(() => bump((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [r?.stage]);
  if (r?.stage !== 'arrived' || !r.phaseAt) return '';
  const s = Math.max(0, Math.floor((Date.now() - r.phaseAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- The trip's timeline (what the engine sends, and when) ----------

export function TimelineSheet({ req, visible, onClose }: { req: Request; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const sent = new Set(req.reminders ?? []);
  const plan = tripPlan(req);
  const when = (at: number) => {
    const d = new Date(at);
    const today = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (d.toDateString() === today.toDateString()) return t('fmtToday', { time });
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return t('fmtTomorrow', { time });
    return `${d.getDate()}/${d.getMonth() + 1} ${time}`;
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('timelineTitle')}>
      <T size={13} muted>
        {t('timelineSub')}
      </T>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
        {plan.map((step) => {
          const done = sent.has(step.key);
          const who = step.who === 'both' ? t('whoBoth') : step.who === 'driver' ? t('driverLabel') : t('customer');
          return (
            <View key={step.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? c.okSoft : c.raised, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Ionicons name={done ? 'checkmark' : step.important ? 'alarm-outline' : 'notifications-outline'} size={15} color={done ? c.ok : c.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={12} weight="bold" color={done ? c.ok : c.muted}>
                  {`${when(step.at)} · ${who}`}
                </T>
                <T size={14} color={done ? c.fg : c.muted}>
                  {stepText(req, step, lang)}
                </T>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <T size={12} muted>
        {t('timelineTestNote')}
      </T>
    </Sheet>
  );
}

// ---------- Cancelling, with a reason ----------

const CUSTOMER_REASONS: Key[] = ['cr_plans', 'cr_found', 'cr_late', 'cr_wrong', 'cr_other'];
const DRIVER_REASONS: Key[] = ['dr_vehicle', 'dr_emergency', 'dr_reach', 'dr_load', 'dr_other'];

/**
 * Either side can cancel, always choosing a reason. The customer's cancel ends the request; the
 * driver's sends the request straight back to other drivers (and the customer is told).
 */
export function CancelSheet({ req, side, visible, onClose, onDone }: { req: Request; side: 'customer' | 'driver'; visible: boolean; onClose: () => void; onDone?: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [reason, setReason] = useState<Key | ''>('');
  const [other, setOther] = useState('');
  useEffect(() => {
    if (visible) {
      setReason('');
      setOther('');
    }
  }, [visible]);
  const reasons = side === 'customer' ? CUSTOMER_REASONS : DRIVER_REASONS;
  const started = req.stage === 'enroute' || req.stage === 'arrived' || req.stage === 'loaded';
  const text = reason === 'cr_other' || reason === 'dr_other' ? other.trim() || t(reason) : reason ? t(reason) : '';
  const confirm = () => {
    if (!reason) return;
    if (side === 'customer') {
      patchRequest(req.id, { stage: 'cancelled', cancelledBy: 'customer', cancelReason: text });
      appMessage(req.id, t('cancelledByCustomerMsg', { reason: text }));
      notify('driver', 'nt_custCancelled', 'step', { reason: text });
      update((s) => ({ ...s, activeRequestId: s.activeRequestId === req.id ? null : s.activeRequestId }));
    } else {
      const name = req.driverName ?? '';
      appMessage(req.id, t('cancelledByDriverMsg', { name, reason: text }));
      // Back to other drivers straight away; this driver's offer is gone.
      update((s) => ({
        ...s,
        offers: s.offers.filter((o) => !(o.requestId === req.id && o.driverName === name)),
        requests: s.requests.map((r) =>
          r.id === req.id
            ? { ...r, stage: 'open', driverName: undefined, driverVehicle: undefined, driverIsExample: undefined, acceptedAt: undefined, phaseAt: undefined, reminders: [], driverConfirmedAt: undefined, driverPos: undefined, createdAt: Date.now(), cancelledDrivers: [...(r.cancelledDrivers ?? []), { name, reason: text, at: Date.now() }] }
            : r,
        ),
      }));
      notify('customer', 'nt_drvCancelled', 'step', { name, reason: text });
      const r = getState().requests.find((x) => x.id === req.id);
      if (r) scheduleExampleOffers(r);
    }
    onClose();
    onDone?.();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={side === 'customer' ? t('cancelTripTitle') : t('cancelJobTitle')}>
      <T size={14} muted>
        {side === 'customer' ? (started ? t('cancelCustStarted') : t('cancelCustFree')) : t('cancelDriverNote')}
      </T>
      <View style={{ gap: 8 }}>
        {reasons.map((k) => {
          const on = reason === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                setReason(k);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: c.surface }}>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? c.accent : c.muted} />
              <T weight={on ? 'bold' : 'regular'} style={{ flex: 1 }}>
                {t(k)}
              </T>
            </Pressable>
          );
        })}
        {reason === 'cr_other' || reason === 'dr_other' ? (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder={t('cancelOtherHint')}
            placeholderTextColor={c.muted}
            accessibilityLabel={t('cancelOtherHint')}
            style={[{ minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.fg }, autoDir(other, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
          />
        ) : null}
      </View>
      <Btn title={side === 'customer' ? t('cancelTripYes') : t('cancelJobYes')} kind="ink" disabled={!reason} onPress={confirm} />
      <Btn title={t('keepTrip')} kind="ghost" onPress={onClose} />
    </Sheet>
  );
}

/** "In 3 h 20", "in 2 days" until the pickup of a booked trip. */
export function countdown(r: Request, t: ReturnType<typeof useT>['t']) {
  const ms = pickupTime(r) - Date.now();
  if (ms <= 0) return '';
  const min = Math.round(ms / 60000);
  if (min < 60) return t('inMinutes', { n: min });
  const h = Math.floor(min / 60);
  if (h < 10) return t('inHours', { h, m: String(min % 60).padStart(2, '0') });
  if (h < 48) return t('inHoursOnly', { h });
  return t('inDays', { n: Math.round(h / 24) });
}
