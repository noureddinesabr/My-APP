import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type Key } from './i18n';
import type { Stage } from './store';
import { Btn, Card, T, tap, useColors } from './ui';
import { bestFit, VEHICLES, vehicleById, type VehicleId } from './vehicles';

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
export function VehicleRow({ id, onChange, note }: { id: VehicleId; onChange?: () => void; note?: string }) {
  const c = useColors();
  const { t, rtl } = useT();
  const v = vehicleById(id);
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
      <Image source={v.image} style={{ width: 104, height: 64, transform: rtl ? [{ scaleX: -1 }] : [] }} resizeMode="contain" />
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
export function VehiclePicker({ visible, value, weightKg, onPick, onClose }: { visible: boolean; value: VehicleId; weightKg: number; onPick: (id: VehicleId) => void; onClose: () => void }) {
  const c = useColors();
  const { t, rtl } = useT();
  const insets = useSafeAreaInsets();
  const fit = weightKg > 0 ? bestFit(weightKg) : null;
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
          {weightKg > 0 ? (
            <T muted size={14}>
              {t('yourLoad', { kg: weightKg >= 1000 ? `${weightKg / 1000} t` : `${weightKg} kg` })}
            </T>
          ) : null}
          {VEHICLES.map((v) => {
            const selected = v.id === value;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${vName(t, v.id)}, ${vCarries(t, v.id)}`}
                onPress={() => {
                  tap();
                  onPick(v.id);
                }}
                style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={v.image} style={{ width: 140, height: 88, transform: rtl ? [{ scaleX: -1 }] : [] }} resizeMode="contain" />
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={17} weight="heavy">
                    {vName(t, v.id)}
                  </T>
                  <T size={13} muted>
                    {vCarries(t, v.id)}
                  </T>
                  {fit === v.id ? (
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

const STEPS: Stage[] = ['accepted', 'arrived', 'loaded', 'delivered'];
export function Steps({ stage }: { stage: Stage }) {
  const c = useColors();
  const { t } = useT();
  const idx = STEPS.indexOf(stage);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= idx ? c.live : c.raised }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['stepAccepted', 'stepArrived', 'stepLoaded', 'stepDelivered'] as const).map((k) => (
          <T key={k} size={12} muted weight="semibold" style={{ flex: 1, textAlign: 'center' }}>
            {t(k)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Dirhams with a space between thousands ("2 720 DH"), "درهم" in Arabic. */
export const dh = (n: number, lang: 'en' | 'fr' | 'ar' = 'en') => {
  const digits = String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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

