import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from './back';
import { useT, type Key } from './i18n';
import type { Stage } from './store';
import { Btn, Card, T, tap, useColors } from './ui';
import { fmtKg } from './scan';
import { bestFit, VEHICLES, vehicleById, vehicleMisfit, type VehicleId } from './vehicles';

/** The fridge-and-sofa drawing shown where no photo was taken. */
export function LoadDrawing({ scale = 1 }: { scale?: number }) {
  const s = (n: number) => n * scale;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(12), direction: 'ltr' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: s(64), height: s(118), borderRadius: s(8), backgroundColor: '#E9E7E1', justifyContent: 'flex-start', paddingTop: s(40) }}>
        <View style={{ height: s(3), backgroundColor: '#B9B6AE' }} />
      </View>
      <View>
        <View style={{ width: s(78), height: s(26), borderRadius: s(9), backgroundColor: '#D9A274' }} />
        <View style={{ width: s(86), height: s(36), borderRadius: s(9), backgroundColor: '#C98A5B', marginTop: s(-4), marginLeft: s(-4) }} />
      </View>
    </View>
  );
}

export const vName = (t: ReturnType<typeof useT>['t'], id: VehicleId | undefined) => t(`v_${vehicleById(id).id}` as Key);
export const vCarries = (t: ReturnType<typeof useT>['t'], id: VehicleId | undefined) => t(`c_${vehicleById(id).id}` as Key);

/** A titled section of a screen: what it is, and one line saying what to do. */
export function Section({ title, hint, badge, children }: { title: string; hint?: string; badge?: string; children: ReactNode }) {
  return (
    <Card>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T size={18} weight="heavy" style={{ flexShrink: 1 }}>
            {title}
          </T>
          {badge ? <AiBadge label={badge} /> : null}
        </View>
        {hint ? (
          <T size={13} muted>
            {hint}
          </T>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** Marks an answer the AI filled in (the customer can still change it). */
export function AiBadge({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Ionicons name="sparkles" size={11} color={c.live} />
      <T size={11} weight="bold" color={c.live}>
        {label}
      </T>
    </View>
  );
}

/** A tappable choice chip; `ai` marks the one the AI picked. */
export function Chip({ label, on, onPress, icon, ai }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; ai?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 42,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.accent : c.raised,
      }}>
      {on ? <Ionicons name="checkmark" size={16} color={c.onAccent} /> : icon ? <Ionicons name={icon} size={16} color={c.muted} /> : null}
      <T size={14} weight="bold" color={on ? c.onAccent : c.fg}>
        {label}
      </T>
      {on && ai ? <Ionicons name="sparkles" size={12} color={c.onAccent} /> : null}
    </Pressable>
  );
}

/** The vehicle as a 3D render with its name and what it carries. */
export function VehicleRow({ id, onChange, note, any }: { id: VehicleId; onChange?: () => void; note?: string; /** The customer doesn't mind which vehicle (round 6). */ any?: boolean }) {
  const c = useColors();
  const { t, rtl } = useT();
  const v = vehicleById(id);
  if (any) {
    return (
      <Pressable
        accessibilityRole={onChange ? 'button' : undefined}
        accessibilityLabel={`${t('anyVehicle')}${onChange ? `. ${t('tapToChange')}` : ''}`}
        disabled={!onChange}
        onPress={() => {
          tap();
          onChange?.();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="swap-horizontal" size={24} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="heavy">{t('anyVehicle')}</T>
          <T size={13} muted>
            {note ?? t('anyVehicleSub')}
          </T>
        </View>
        {onChange ? <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={c.muted} /> : null}
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole={onChange ? 'button' : undefined}
      accessibilityLabel={`${vName(t, id)}${onChange ? `. ${t('tapToChange')}` : ''}`}
      disabled={!onChange}
      onPress={() => {
        tap();
        onChange?.();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 8 }}>
      <Image source={v.image} style={{ width: 104, height: 64 }} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <T weight="heavy">{vName(t, id)}</T>
        <T size={13} muted>
          {note ?? vCarries(t, id)}
        </T>
      </View>
      {onChange ? <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={c.muted} /> : null}
    </Pressable>
  );
}

/** Full-screen list of the nine vehicles, each as a large 3D picture. */
export function VehiclePicker({ visible, value, weightKg, km = 0, suggested, onPick, onClose, any, onAny }: { visible: boolean; value: VehicleId; weightKg: number; /** The trip's distance, when known: town-only vehicles are greyed out for longer trips. */ km?: number; /** The vehicle the app suggests for this load (marked «best»). */ suggested?: VehicleId; onPick: (id: VehicleId) => void; onClose: () => void; any?: boolean; /** Offers "Any vehicle" first, when given. */ onAny?: () => void }) {
  const c = useColors();
  const { t, rtl, lang } = useT();
  const insets = useSafeAreaInsets();
  useBack(visible, onClose);
  const fit = suggested ?? (weightKg > 0 ? bestFit(weightKg, km) : null);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
          <T size={24} weight="heavy">
            {t('secVehicle')}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={26} color={c.fg} />
          </Pressable>
        </View>
        {/* "I don't mind" stays fixed at the top while the vehicles scroll under it (round 8). */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8, borderBottomWidth: onAny ? 1 : 0, borderBottomColor: c.line }}>
          {weightKg > 0 ? (
            <T muted size={14}>
              {t('yourLoad', { kg: fmtKg(weightKg, lang) })}
            </T>
          ) : null}
          {onAny ? (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: !!any }}
              accessibilityLabel={`${t('anyVehicle')}, ${t('anyVehicleSub')}`}
              onPress={() => {
                tap();
                onAny();
              }}
              style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: any ? 2 : 1, borderColor: any ? c.accent : c.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="swap-horizontal" size={26} color={c.accent} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T size={17} weight="heavy">
                  {t('anyVehicle')}
                </T>
                <T size={13} muted>
                  {t('anyVehicleSub')}
                </T>
              </View>
              <Ionicons name={any ? 'radio-button-on' : 'radio-button-off'} size={22} color={any ? c.accent : c.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }}>
          {VEHICLES.map((v) => {
            const selected = !any && v.id === value;
            // The vehicle engine: unsuitable ones stay in the list, greyed out, with the reason.
            const why = vehicleMisfit(v.id, weightKg, km);
            return (
              <Pressable
                key={v.id}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !!why }}
                accessibilityLabel={`${vName(t, v.id)}, ${vCarries(t, v.id)}${why ? `. ${t(why === 'tooSmall' ? 'vmTooSmall' : 'vmTownOnly')}` : ''}`}
                disabled={!!why}
                onPress={() => {
                  tap();
                  onPick(v.id);
                }}
                style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: why ? 0.45 : 1 }}>
                <Image source={v.image} style={{ width: 140, height: 88 }} resizeMode="contain" />
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={17} weight="heavy">
                    {vName(t, v.id)}
                  </T>
                  <T size={13} muted>
                    {vCarries(t, v.id)}
                  </T>
                  {why ? (
                    <T size={12} weight="bold" color={c.warn}>
                      {t(why === 'tooSmall' ? 'vmTooSmall' : 'vmTownOnly')}
                    </T>
                  ) : null}
                  {fit === v.id && !why ? (
                    <View style={{ alignSelf: 'flex-start', backgroundColor: c.okSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <T size={12} weight="bold" color={c.ok}>
                        {t('bestFit')}
                      </T>
                    </View>
                  ) : null}
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? c.accent : c.muted} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const STEPS: Stage[] = ['accepted', 'enroute', 'arrived', 'loaded', 'delivered'];
/** The trip's five steps in plain words (round 9, #92); the step happening now is bold and coloured. */
export function Steps({ stage, side = 'customer' }: { stage: Stage; side?: 'customer' | 'driver' }) {
  const c = useColors();
  const { t } = useT();
  // At the destination (unloading) is still the "on the way / delivering" step until handed over.
  const idx = STEPS.indexOf(stage === 'dropoff' ? 'loaded' : stage);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= idx ? c.live : c.raised }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(side === 'driver' ? (['stepAccepted', 'drvStepEnroute', 'drvStepArrived', 'stepLoaded', 'stepDelivered'] as const) : (['stepAccepted', 'stepEnroute', 'stepArrived', 'stepLoaded', 'stepDelivered'] as const)).map((k, i) => (
          <T key={k} size={12} muted={i !== idx} color={i === idx ? c.live : undefined} weight={i === idx ? 'heavy' : 'semibold'} style={{ flex: 1, textAlign: 'center' }}>
            {t(k)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Dirhams with a space between thousands ("2 720 DH"), "درهم" in Arabic. */
export const dh = (n: number, lang: 'en' | 'fr' | 'ar' = 'en') => {
  // A no-break space keeps "1 990" as one number, also inside Arabic text (a plain space would show "990 1").
  const digits = String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return lang === 'ar' ? `${digits} درهم` : `${digits} DH`;
};

export function Initials({ name }: { name: string }) {
  const c = useColors();
  const init = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
      <T weight="heavy" color={c.live}>
        {init || '?'}
      </T>
    </View>
  );
}

/** An in-app yes/no step (the app never uses system dialogs). */
export function Confirm({ visible, title, body, yes, onYes, onNo }: { visible: boolean; title: string; body: string; yes: string; onYes: () => void; onNo: () => void }) {
  useBack(visible, onNo);
  const c = useColors();
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
        <Card style={{ backgroundColor: c.surface }}>
          <T size={20} weight="heavy">
            {title}
          </T>
          <T muted>{body}</T>
          <Btn title={yes} onPress={onYes} />
          <Btn title={t('back')} kind="ghost" onPress={onNo} />
        </Card>
      </View>
    </Modal>
  );
}

/** The other photos of the load, small, in a row. */
export function PhotoStrip({ uris }: { uris: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {uris.map((u, i) => (
        <Image key={u + i} source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 14 }} resizeMode="cover" />
      ))}
    </ScrollView>
  );
}


/** A request or job in progress, shown on the first page; "Open" goes back to it. */
export function OngoingCard({ title, line, status, onOpen }: { title: string; line: string; status: string; onOpen: () => void }) {
  const c = useColors();
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onOpen();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.live, borderRadius: 18, padding: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="navigate" size={20} color={c.live} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={12} muted weight="semibold">
          {title}
        </T>
        <T size={15} weight="heavy">
          {line}
        </T>
        <T size={13} color={c.live} weight="semibold">
          {status}
        </T>
      </View>
      <View style={{ backgroundColor: c.live, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' }}>
        <T size={14} weight="bold" color="#FFFFFF">
          {t('openTrip')}
        </T>
      </View>
    </Pressable>
  );
}

/** What is being moved, in the reader's language: the kinds chosen by hand and the other things written, or the list as sent. */
export function loadOf(r: { load: string; loadKinds?: string[]; loadOthers?: string[] }, t: (k: Key) => string) {
  if (r.loadKinds?.length || r.loadOthers?.length) return [...(r.loadKinds ?? []).map((k) => t(`g_${k}` as Key)), ...(r.loadOthers ?? [])].join(' · ');
  return r.load;
}

/** A distance: "12 km", or "12 كلم" in Arabic. */
export const fmtKm = (km: number, lang: string) => `${km} ${lang === 'ar' ? 'كلم' : 'km'}`;
