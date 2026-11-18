import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useEffect, useState } from 'react';

import { fieldDir } from './composer';
import { TextInput } from './field';
import { useT } from './i18n';
import { PIN } from './map/pins';
import { partiesNeedPays, partyPayers, type FloorEnd, type Parties, type Party } from './store';
import { T, tap, useColors } from './ui';

/**
 * Owner's report #8 and edit #10 (18 Nov 2026): the trip's questions are short, one line each, close
 * together: the question at the start, its answers as small pills at the end of the same line (they
 * go under it only when they don't fit). `stack` puts the answers under the question.
 */
export function QRow({ icon, mci, label, missing, children, onLayout, stack, labelMax = '40%' }: { /** How wide the question may be before it wraps (the answers keep the rest of the line). */ labelMax?: `${number}%`; icon?: keyof typeof Ionicons.glyphMap; /** A MaterialCommunityIcons name, for icons Ionicons lacks. */ mci?: keyof typeof MaterialCommunityIcons.glyphMap; label: string; missing?: boolean; children: ReactNode; onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void; stack?: boolean }) {
  const c = useColors();
  return (
    <View style={stack ? { gap: 6 } : { flexDirection: 'row', alignItems: 'center', gap: 8 }} onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: stack ? undefined : labelMax }}>
        {mci ? <MaterialCommunityIcons name={mci} size={16} color={missing ? c.danger : c.live} /> : icon ? <Ionicons name={icon} size={15} color={missing ? c.danger : c.live} /> : null}
        <T size={13} weight="bold" color={missing ? c.danger : undefined} style={{ flexShrink: 1 }}>
          {label}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: stack ? undefined : 1, justifyContent: stack ? 'flex-start' : 'flex-end' }}>{children}</View>
    </View>
  );
}

/** A small answer pill: a radio by default, a checkbox for answers that add up. */
export function Mini({ label, on, onPress, icon, check, a11y, noTick }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; check?: boolean; /** A longer spoken label (the question with the answer), when the pill alone is too short. */ a11y?: string; /** No ✓ when chosen (the colour shows it), so the pill keeps its width. */ noTick?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      hitSlop={3}
      accessibilityRole={check ? 'checkbox' : 'radio'}
      accessibilityState={check ? { checked: on } : { selected: on }}
      accessibilityLabel={a11y ?? label}
      // A finger scrolling the page must not pick an answer by passing over it.
      unstable_pressDelay={80}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.raised, opacity: pressed ? 0.85 : 1 })}>
      {on && !noTick ? <Ionicons name="checkmark" size={13} color={c.onAccent} /> : icon && !on ? <Ionicons name={icon} size={13} color={c.muted} /> : null}
      <T size={12} weight="bold" color={on ? c.onAccent : c.fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** − n + in one short line (in Arabic the + comes first, on the right). */
export function Counter({ value, onChange, min = 0, max = 4, lessLabel, moreLabel, small }: { value: number; onChange: (n: number) => void; min?: number; max?: number; lessLabel?: string; moreLabel?: string; small?: boolean }) {
  const c = useColors();
  const { t, lang } = useT();
  const round = (icon: 'remove' | 'add', label: string, next: number, disabled: boolean) => (
    <Pressable
      key={icon}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onChange(next);
      }}
      style={{ width: small ? 30 : 36, height: small ? 30 : 36, borderRadius: small ? 15 : 18, backgroundColor: icon === 'add' ? c.accent : c.raised, borderWidth: icon === 'add' ? 0 : 1, borderColor: c.line, opacity: disabled ? 0.4 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={icon === 'add' ? c.onAccent : c.fg} />
    </Pressable>
  );
  const less = round('remove', lessLabel ?? t('helperLess'), Math.max(min, value - 1), value <= min);
  const more = round('add', moreLabel ?? t('helperMore'), Math.min(max, value + 1), value >= max);
  const n = (
    <T key="n" size={small ? 15 : 18} weight="heavy" style={{ minWidth: small ? 18 : 24, textAlign: 'center' }}>
      {String(value)}
    </T>
  );
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 4 : 8 }}>{lang === 'ar' ? [more, n, less] : [less, n, more]}</View>;
}

/** A floor is answered: ground, «don't know», or a floor number with the elevator answered. */
export const floorDone = (v?: FloorEnd) => !!v && (v.floor === 'ground' || v.floor === 'unknown' || (typeof v.floor === 'number' && !!v.lift));

/**
 * A floor in one line (owner's reports #38, #39): «Ground», «Floor», «Don't know». «Floor» turns the
 * same line into − n + (pressing − at the first floor goes back to Ground) and the elevator yes / no,
 * so the row never grows. No question marks: the words are written.
 */
export function FloorRow({ end, value, onChange, missing }: { end: 'pickup' | 'dropoff'; value: FloorEnd; onChange: (v: FloorEnd) => void; missing?: boolean }) {
  const c = useColors();
  const { t } = useT();
  const other = typeof value.floor === 'number';
  const title = t(end === 'pickup' ? 'floorPickup' : 'floorDropoff');
  const short = t(end === 'pickup' ? 'floorPickupShort' : 'floorDropShort');
  const n = other ? (value.floor as number) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '28%' }}>
        <View style={{ width: 10, height: 10, borderRadius: end === 'pickup' ? 5 : 2, backgroundColor: end === 'pickup' ? PIN.pickup : PIN.dropoff }} />
        <T size={13} weight="bold" color={missing ? c.danger : undefined} style={{ flexShrink: 1 }}>
          {short}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
        {other ? (
          <>
            <Counter value={n} min={0} max={100} small lessLabel={`${title} −1`} moreLabel={`${title} +1`} onChange={(k) => onChange(k <= 0 ? { floor: 'ground' } : { ...value, floor: k })} />
            <MaterialCommunityIcons name="elevator-passenger-outline" size={18} color={missing && !value.lift ? c.danger : c.muted} accessibilityLabel={t('liftAsk')} />
            {(['yes', 'no'] as const).map((v) => (
              <Mini key={v} noTick a11y={`${title} · ${t('liftShort')}: ${t(v)}`} label={t(v)} on={value.lift === v} onPress={() => onChange({ ...value, lift: v })} />
            ))}
          </>
        ) : (
          <>
            <Mini noTick a11y={`${title}: ${t('floorGround')}`} label={t('floorGroundShort')} on={value.floor === 'ground'} onPress={() => onChange({ floor: 'ground' })} />
            <Mini noTick a11y={`${title}: ${t('floorOther')}`} label={t('floorShort')} icon="add" on={false} onPress={() => onChange({ floor: 1, lift: value.lift })} />
            <Mini noTick a11y={`${title}: ${t('dontKnow')}`} label={t('dontKnowShort')} on={value.floor === 'unknown'} onPress={() => onChange({ floor: 'unknown' })} />
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Who is there (owner's edit #9, his choice «Option A», 18 Nov 2026), in the order of the moving
 * day, so no answer can contradict another:
 *  1. at the pickup: me / someone else (name, phone);
 *  2. does that person ride with the driver? yes / no (only the person at the pickup can ride);
 *  3. at the destination: when someone rides it is already answered (the rider receives it, with
 *     «Change»); otherwise me / someone else.
 * Who pays comes only when someone else is named. The answers keep the `Parties` shape.
 */
export function PartiesSimple({ parties, onChange, missing, ys }: { parties: Parties; onChange: (p: Parties) => void; missing?: 'pickup' | 'rides' | 'dropoff' | 'pays' | null; ys?: { current: Record<string, number> } }) {
  const c = useColors();
  const { t, lang } = useT();
  const p = parties;
  const rider: Party | null = p.rides.who === 'me' || p.rides.who === 'other' ? p.rides : null;
  const sameAsRider = (d: Party) => !!rider && d.who === rider.who && (d.name ?? '') === (rider.name ?? '') && (d.phone ?? '') === (rider.phone ?? '');
  const [changeDrop, setChangeDrop] = useState(() => !!rider && !!p.dropoff.who && !sameAsRider(p.dropoff));
  const autoDrop = !!rider && !changeDrop;
  const commit = (next: Parties) => {
    // The person riding is the person at the pickup; the destination follows the rider unless changed.
    const r: Party = next.rides.who === 'me' || next.rides.who === 'other' ? { who: next.pickup.who, name: next.pickup.name, phone: next.pickup.phone } : next.rides;
    next = { ...next, rides: r };
    if ((r.who === 'me' || r.who === 'other') && !changeDrop) next.dropoff = { ...r };
    if (next.pays && next.pays !== 'me' && next[next.pays].who !== 'other') next.pays = undefined;
    if (!partiesNeedPays(next)) next.pays = undefined;
    onChange(next);
  };
  const mark = (k: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    if (ys) ys.current[k] = e.nativeEvent.layout.y;
  };
  // Owner's report #40: a short word in each box, and room for the whole line of text (never cut).
  const input = { height: 44, borderRadius: 12, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, paddingHorizontal: 10, paddingVertical: 0, fontSize: 15, lineHeight: 20, textAlignVertical: 'center', color: c.fg, flex: 1, minWidth: 0 } as const;
  const who = (k: 'pickup' | 'dropoff', v: Party, set: (x: Party) => void) => {
    const label = t(k === 'pickup' ? 'qs_pickupShort' : 'qs_dropShort');
    return (
      <View style={{ gap: 6 }} onLayout={mark(k)}>
        <QRow icon={k === 'pickup' ? 'arrow-up-circle-outline' : 'flag-outline'} label={t(k === 'pickup' ? 'qs_atPickup' : 'qs_atArrival')} missing={missing === k}>
          <Mini a11y={`${label}: ${t('pt_me')}`} on={v.who === 'me'} icon="person-outline" label={t('pt_me')} onPress={() => set({ who: 'me' })} />
          <Mini a11y={`${label}: ${t('pt_other')}`} on={v.who === 'other'} icon="person-add-outline" label={t('pt_other')} onPress={() => set({ ...v, who: 'other' })} />
        </QRow>
        {v.who === 'other' ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput value={v.name ?? ''} onChangeText={(name) => set({ ...v, name })} placeholder={t('nameShort')} placeholderTextColor={c.muted} accessibilityLabel={`${label} · ${t('compNameOpt')}`} style={[input, fieldDir(v.name ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
            <TextInput value={v.phone ?? ''} onChangeText={(phone) => set({ ...v, phone: phone.replace(/[^\d+ ]/g, '').slice(0, 16) })} placeholder={t('phoneShort')} placeholderTextColor={c.muted} keyboardType="phone-pad" accessibilityLabel={`${label} · ${t('compPhoneOpt')}`} style={[input, fieldDir(v.phone ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
          </View>
        ) : null}
      </View>
    );
  };
  const pickName = (p.pickup.name ?? '').trim();
  const rideQ = p.pickup.who === 'me' ? t('qs_rideMe') : pickName ? t('qs_rideThem', { name: pickName }) : t('qs_rideThemNoName');
  const rideAns = p.rides.who === 'none' ? 'no' : rider ? 'yes' : '';
  const dropLine = rider ? (rider.who === 'me' ? t('qs_dropMe') : (rider.name ?? '').trim() ? t('qs_dropThem', { name: (rider.name ?? '').trim() }) : t('qs_dropThemNoName')) : '';
  // The same person in two places pays once.
  const payers = partyPayers(p).filter((k) => !(k === 'rides' && p.pickup.who === 'other') && !(k === 'dropoff' && autoDrop));
  const payName = (k: 'me' | 'pickup' | 'rides' | 'dropoff') => (k === 'me' ? t('pt_me') : (p[k].name ?? '').trim() || t(k === 'pickup' ? 'pt_payPickup' : k === 'rides' ? 'pt_payRides' : 'pt_payDropoff'));
  // Once everything is answered the three questions fold into one line with «Change» (edit #10: the
  // page stays on one screen).
  const complete = !!p.pickup.who && !!p.rides.who && !!p.dropoff.who && (!partiesNeedPays(p) || (!!p.pays && payers.includes(p.pays)));
  const [folded, setFolded] = useState(complete);
  useEffect(() => {
    if (!complete) {
      setFolded(false);
      return;
    }
    const timer = setTimeout(() => setFolded(true), 900);
    return () => clearTimeout(timer);
  }, [complete]);
  const personOf = (x: Party) => (x.who === 'me' ? t('pt_me') : (x.name ?? '').trim() || t('pt_other'));
  if (complete && folded)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.okSoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, minHeight: 40 }}>
        <Ionicons name="people" size={16} color={c.ok} />
        <T size={12} weight="semibold" style={{ flex: 1 }}>
          {[`${t('qs_atPickup')}: ${personOf(p.pickup)}`, rider ? t('qs_rideYesShort') : t('qs_rideNoShort'), `${t('qs_atArrival')}: ${personOf(p.dropoff)}`, p.pays && p.pays !== 'me' ? t('qs_pays', { name: payName(p.pays) }) : ''].filter(Boolean).join(' · ')}
        </T>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('qs_whoTitle')} · ${t('change')}`} onPress={() => {
          tap();
          setFolded(false);
        }} style={{ minHeight: 34, paddingHorizontal: 6, justifyContent: 'center' }}>
          <T size={13} weight="bold" color={c.accent}>
            {t('change')}
          </T>
        </Pressable>
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      {who('pickup', p.pickup, (x) => commit({ ...p, pickup: x }))}
      {p.pickup.who ? (
        <View onLayout={mark('rides')}>
          <QRow icon="car-outline" label={rideQ} missing={missing === 'rides'}>
            <Mini a11y={`${rideQ} ${t('yes')}`} on={rideAns === 'yes'} label={t('yes')} onPress={() => {
              setChangeDrop(false);
              commit({ ...p, rides: { who: p.pickup.who } });
            }} />
            <Mini a11y={`${rideQ} ${t('no')}`} on={rideAns === 'no'} label={t('no')} onPress={() => {
              setChangeDrop(false);
              commit({ ...p, rides: { who: 'none' }, dropoff: sameAsRider(p.dropoff) ? {} : p.dropoff });
            }} />
          </QRow>
        </View>
      ) : null}
      {rideAns ? (
        autoDrop ? (
          <View onLayout={mark('dropoff')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.okSoft, borderRadius: 14, paddingHorizontal: 10, minHeight: 40 }}>
            <Ionicons name="flag" size={15} color={c.ok} />
            <T size={13} weight="bold" style={{ flex: 1 }}>
              {dropLine}
            </T>
            <Pressable hitSlop={8} accessibilityRole="button" onPress={() => {
              tap();
              setChangeDrop(true);
              onChange({ ...p, dropoff: {}, pays: undefined });
            }} style={{ minHeight: 34, paddingHorizontal: 6, justifyContent: 'center' }}>
              <T size={13} weight="bold" color={c.accent}>
                {t('change')}
              </T>
            </Pressable>
          </View>
        ) : (
          who('dropoff', p.dropoff, (x) => commit({ ...p, dropoff: x }))
        )
      ) : null}
      {partiesNeedPays(p) ? (
        <View style={{ gap: 4 }} onLayout={mark('pays')}>
          <QRow icon="wallet-outline" label={t('pt_pays')} missing={missing === 'pays'}>
            {payers.map((k) => (
              <Mini key={k} a11y={`${t('pt_pays')} ${payName(k)}`} on={p.pays === k} label={payName(k)} onPress={() => onChange({ ...p, pays: k })} />
            ))}
          </QRow>
          <T size={11} muted>
            {t('compPrivateNote')}
          </T>
        </View>
      ) : null}
    </View>
  );
}
