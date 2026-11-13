import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextInput } from './field';

import { PlaceField } from './extras';
import { useT, type Key } from './i18n';
import { getPlace } from './lib/places';
import { play } from './sounds';
import { newId, update, useStore, type DriverWork, type Request, type TripPlan } from './store';
import { Btn, Card, T, tap, useColors } from './ui';
import { Sheet } from './trip';
import { WhenPicker } from './wheels';
import { vehicleById } from './vehicles';

/**
 * Round 7: what a driver tells the app about his work (asked once when he joins, changeable in his
 * profile), the main rules he reads and accepts once, and the trips he announces so the app can
 * show him loads on his way and on his way back.
 */

function Chip({ on, label, onPress, icon }: { on: boolean; label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, maxWidth: '100%' }}>
      {icon ? <Ionicons name={icon} size={16} color={on ? c.onAccent : c.fg} /> : null}
      <T size={14} weight="bold" color={on ? c.onAccent : c.fg} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

const SKILLS: { id: NonNullable<DriverWork['skills']>[number]; label: Key }[] = [
  { id: 'stairs', label: 'skStairs' },
  { id: 'dismantle', label: 'skDismantle' },
  { id: 'wrap', label: 'skWrap' },
  { id: 'fragile', label: 'skFragile' },
];

/** The questions about his work: helpers, what he can do, where he works, shared loads. */
export function WorkCard({ work, onChange }: { work: DriverWork; onChange: (w: DriverWork) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const set = (patch: Partial<DriverWork>) => onChange({ ...work, ...patch });
  const skills = work.skills ?? [];
  const q = (title: string) => (
    <T size={15} weight="bold">
      {title}
    </T>
  );
  return (
    <Card>
      <View style={{ gap: 2 }}>
        <T size={18} weight="heavy">
          {t('workTitle')}
        </T>
        <T size={13} muted>
          {t('workSub')}
        </T>
      </View>
      {q(t('wqHelpers'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip on={work.helpers === 'no'} label={t('whNo')} onPress={() => set({ helpers: 'no' })} />
        <Chip on={work.helpers === 'yes'} label={t('whYes')} onPress={() => set({ helpers: 'yes', helperCount: work.helperCount ?? 1, helperPrice: work.helperPrice ?? 100 })} />
        <Chip on={work.helpers === 'depends'} label={t('whDepends')} onPress={() => set({ helpers: 'depends' })} />
      </View>
      {work.helpers === 'yes' ? (
        <View style={{ gap: 10, backgroundColor: c.raised, borderRadius: 16, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={14} style={{ flex: 1 }}>
              {t('whHowMany')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, direction: 'ltr' }}>
              {[1, 2, 3, 4].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: work.helperCount === n }}
                  onPress={() => {
                    tap();
                    set({ helperCount: n });
                  }}
                  style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: work.helperCount === n ? c.accent : c.line, backgroundColor: work.helperCount === n ? c.accent : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <T weight="heavy" color={work.helperCount === n ? c.onAccent : c.fg}>
                    {n === 4 ? '4+' : String(n)}
                  </T>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={14} style={{ flex: 1 }}>
              {t('whPrice')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' }}>
              <TextInput
                value={work.helperPrice ? String(work.helperPrice) : ''}
                onChangeText={(v) => set({ helperPrice: parseInt(v.replace(/\D/g, '').slice(0, 4), 10) || 0 })}
                keyboardType="number-pad"
                accessibilityLabel={t('whPrice')}
                style={[{ width: 80, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, textAlign: 'center', fontSize: 17, fontWeight: '800', color: c.fg }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
              />
              <T weight="bold" muted>
                {lang === 'ar' ? 'درهم' : 'DH'}
              </T>
            </View>
          </View>
          <T size={12} muted>
            {t('whPriceNote')}
          </T>
        </View>
      ) : null}
      {q(t('wqSkills'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SKILLS.map((s) => (
          <Chip key={s.id} on={skills.includes(s.id)} icon={skills.includes(s.id) ? 'checkmark' : undefined} label={t(s.label)} onPress={() => set({ skills: skills.includes(s.id) ? skills.filter((x) => x !== s.id) : [...skills, s.id] })} />
        ))}
      </View>
      {q(t('wqArea'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip on={work.area === 'city'} label={t('waCity')} onPress={() => set({ area: 'city' })} />
        <Chip on={work.area === 'intercity'} label={t('waIntercity')} onPress={() => set({ area: 'intercity' })} />
        <Chip on={work.area === 'everywhere'} label={t('waEverywhere')} onPress={() => set({ area: 'everywhere' })} />
      </View>
      {q(t('wqShared'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip on={work.shared === true} label={t('wsYes')} onPress={() => set({ shared: true })} />
        <Chip on={work.shared === false} label={t('wsNo')} onPress={() => set({ shared: false })} />
      </View>
    </Card>
  );
}

/** Whether the work questions were answered (the first time a driver opens the app). */
export const workDone = (w?: DriverWork) => !!w && !!w.helpers && !!w.area && w.shared !== undefined;

/** First time: the questions, then save. */
export function WorkSetup() {
  const { t } = useT();
  const store = useStore();
  const [work, setWork] = useState<DriverWork>(store.driver.work ?? {});
  return (
    <View style={{ gap: 14 }}>
      <T size={26} weight="heavy">
        {t('workSetupTitle')}
      </T>
      <T muted>{t('workSetupSub')}</T>
      <WorkCard work={work} onChange={setWork} />
      <Btn
        title={t('continue')}
        icon="arrow-forward"
        disabled={!workDone(work)}
        onPress={() => {
          update((s) => ({ ...s, driver: { ...s.driver, work } }));
          play('success');
        }}
      />
    </View>
  );
}

const RULES: Key[] = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6', 'rule7', 'rule8', 'rule9', 'rule10'];

/** The main rules, on one page, written large; read once and accepted. */
export function RulesPage() {
  const c = useColors();
  const { t } = useT();
  return (
    <View style={{ gap: 14 }}>
      <T size={26} weight="heavy">
        {t('rulesTitle')}
      </T>
      <T muted>{t('rulesSub')}</T>
      <Card style={{ gap: 14 }}>
        {RULES.map((k, i) => (
          <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? c.accent : c.raised, alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} weight="heavy" color={i === 0 ? c.onAccent : c.fg}>
                {String(i + 1)}
              </T>
            </View>
            <T size={17} weight={i === 0 ? 'heavy' : 'semibold'} style={{ flex: 1 }}>
              {t(k)}
            </T>
          </View>
        ))}
      </Card>
      <T size={13} muted>
        {t('rulesTerms')}
      </T>
      <Btn
        title={t('rulesAgree')}
        icon="checkmark-circle"
        onPress={() => {
          update((s) => ({ ...s, driver: { ...s.driver, rulesAt: Date.now() } }));
          play('success');
        }}
      />
    </View>
  );
}

// ---------- Loads that fit, and loads on the driver's way ----------

/** Why a load doesn't fit this driver ('' when it does). */
export function misfit(req: Request, driver: { vehicle: Parameters<typeof vehicleById>[0]; work?: DriverWork }): Key | '' {
  const w = driver.work;
  if (!req.anyVehicle && req.weightKg && req.weightKg > vehicleById(driver.vehicle).maxKg) return 'mfHeavy';
  if (req.helpers && w?.helpers === 'no') return 'mfHelpers';
  if (w?.area === 'city' && req.km > 60) return 'mfFar';
  return '';
}

type LL = { lat: number; lng: number };
/** Where a point falls along a segment (0 at its start, 1 at its end) and how far from it, in km. */
function along(p: LL, a: LL, b: LL) {
  const r = Math.PI / 180;
  const k = Math.cos(((a.lat + b.lat) / 2) * r) * 111.32;
  const ax = a.lng * k, ay = a.lat * 110.57, bx = b.lng * k, by = b.lat * 110.57, px = p.lng * k, py = p.lat * 110.57;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + u * dx, cy = ay + u * dy;
  return { u, km: Math.hypot(px - cx, py - cy) };
}

/** Whether a load lies on an announced trip: 'go' (on the way), 'back' (on the way back), or ''. */
export function onWay(req: Request, plans: TripPlan[]): 'go' | 'back' | '' {
  const p = getPlace(req.fromPlaceId);
  const d = getPlace(req.toPlaceId);
  if (!p || !d) return '';
  for (const plan of plans) {
    const a = getPlace(plan.fromPlaceId);
    const b = getPlace(plan.toPlaceId);
    if (!a || !b) continue;
    const fits = (x: LL, y: LL) => {
      const s = along(p, x, y);
      const e = along(d, x, y);
      return s.km < 30 && e.km < 30 && e.u >= s.u - 0.02;
    };
    if (fits(a, b)) return 'go';
    if (plan.back && fits(b, a)) return 'back';
  }
  return '';
}

/**
 * Announce a trip (round 8): where he goes, when he leaves (the same time wheels as customers use),
 * and whether he comes back, the same day or another day, at what time. Opens empty for a new trip
 * or filled to edit one; an announced trip can also be removed.
 */
export function PlanSheet({ plan, onClose }: { plan: TripPlan | 'new' | null; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const editing = plan && plan !== 'new' ? plan : null;
  const [from, setFrom] = useState<{ text: string; id?: string }>({ text: '' });
  const [to, setTo] = useState<{ text: string; id?: string }>({ text: '' });
  const [go, setGo] = useState('now');
  const [back, setBack] = useState(false);
  const [backWhen, setBackWhen] = useState('now');
  useEffect(() => {
    if (!plan) return;
    const p = plan === 'new' ? null : plan;
    setFrom({ text: p?.from ?? '', id: p?.fromPlaceId });
    setTo({ text: p?.to ?? '', id: p?.toPlaceId });
    setGo(p?.go ?? 'now');
    setBack(!!p?.back);
    setBackWhen(p?.backWhen ?? 'now');
  }, [plan]);
  const save = () => {
    const next: TripPlan = { id: editing?.id ?? newId(), from: from.text, to: to.text, fromPlaceId: from.id, toPlaceId: to.id, day: 'today', back, go, backWhen: back ? backWhen : undefined };
    update((s) => {
      const list = s.driver.plans ?? [];
      return { ...s, driver: { ...s.driver, plans: editing ? list.map((x) => (x.id === editing.id ? next : x)) : [...list, next].slice(-5) } };
    });
    play('success');
    onClose();
  };
  const remove = () => {
    if (!editing) return;
    update((s) => ({ ...s, driver: { ...s.driver, plans: (s.driver.plans ?? []).filter((x) => x.id !== editing.id) } }));
    onClose();
  };
  return (
    <Sheet visible={!!plan} onClose={onClose} title={editing ? t('planEditTitle') : t('plansTitle')}>
      <View style={{ gap: 12 }}>
        <T size={13} muted>
          {t('plansSub')}
        </T>
        <PlaceField kind="pickup" label={t('planFrom')} value={from.text} placeId={from.id} onChange={(text, id) => setFrom({ text, id })} />
        <PlaceField kind="dropoff" label={t('planTo')} value={to.text} placeId={to.id} near={getPlace(from.id)} onChange={(text, id) => setTo({ text, id })} />
        <T size={15} weight="heavy">
          {t('planLeave')}
        </T>
        <WhenPicker value={go} onChange={setGo} nowSub="planNowSub" />
        <T size={15} weight="heavy">
          {t('planBackQ')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip on={!back} label={t('planBackNo')} onPress={() => setBack(false)} />
          <Chip on={back} label={t('planBackYes')} onPress={() => setBack(true)} />
        </View>
        {back ? <WhenPicker value={backWhen} onChange={setBackWhen} nowSub="planBackNowSub" /> : null}
        <Btn title={editing ? t('saveChanges') : t('planSave')} icon="megaphone-outline" disabled={!from.id || !to.id || from.id === to.id} onPress={save} />
        {editing ? <Btn title={t('planRemove')} kind="ghost" icon="trash-outline" onPress={remove} /> : null}
        <T size={12} muted style={{ textAlign: 'center' }}>
          {t('planMapNote')}
        </T>
      </View>
    </Sheet>
  );
}
