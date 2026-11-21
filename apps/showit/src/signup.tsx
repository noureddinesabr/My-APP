import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';

import { saveOnRestart, takeRestored } from './resume';
import { Image, Pressable, View } from 'react-native';

import { TextInput } from './field';

import { fieldDir } from './composer';
import { capture } from './flow';
import { useT, type Key } from './i18n';
import { VehiclePicker, VehicleRow } from './shared';
import { play } from './sounds';
import { update, useStore, type Company, type PaperId, type Profile } from './store';
import { Btn, Card, T, tap, useColors } from './ui';

/**
 * Driver sign-up (round 8): everything the profile holds is asked the first time, in three short
 * steps, and stays editable in the Profile tab: 1) you (a clear photo, required, with examples of a
 * good one; name; phone), 2) your vehicle (type, plate), 3) your papers (licence, carte grise,
 * insurance, CIN). Then the work questions and the rules follow (work.tsx).
 */

export const PAPERS: { id: PaperId; icon: keyof typeof Ionicons.glyphMap; label: Key }[] = [
  { id: 'license', icon: 'card-outline', label: 'paperLicense' },
  { id: 'registration', icon: 'document-text-outline', label: 'paperRegistration' },
  { id: 'insurance', icon: 'shield-checkmark-outline', label: 'paperInsurance' },
  { id: 'idCard', icon: 'id-card-outline', label: 'paperId' },
];

const phoneOk = (p?: string) => (p ?? '').replace(/\D/g, '').length >= 9;

/** Rule 12: the company's papers (instead of the driver's own). */
export const COMPANY_PAPERS: { id: 'ice' | 'rc' | 'managerId'; icon: keyof typeof Ionicons.glyphMap; label: Key }[] = [
  { id: 'ice', icon: 'business-outline', label: 'paperIce' },
  { id: 'rc', icon: 'document-text-outline', label: 'paperRc' },
  { id: 'managerId', icon: 'id-card-outline', label: 'paperManagerId' },
];

/**
 * Rule 9, welcoming first and papers last: 1) name and «driver or company?», 2) the work questions
 * (work.tsx), 3) photo (a selfie for a driver, optional for a company), phone, vehicle, 4) the rules.
 * Then he can already look at loads; papers are added when he wants to make offers.
 */
export const nameDone = (d: Profile, companyName?: string) => !!d.testSkip || (!!d.name.trim() && !!d.accountType && (d.accountType !== 'company' || !!(companyName ?? '').trim()));
export const youDone = (d: Profile) => !!d.testSkip || (phoneOk(d.phone) && !!(d.plate ?? '').trim() && (d.accountType === 'company' || !!d.photoUri));
/** Older name kept for the screens that read it: the steps before the loads page are done. */
export const signupDone = (d: Profile, companyName?: string) => nameDone(d, companyName) && youDone(d);
/** The papers are all there (and, for a company, its logo). */
export function papersDone(d: Profile, company?: { logoUri?: string; papers?: Partial<Record<string, string>> }) {
  if (d.accountType === 'company') return COMPANY_PAPERS.every((p) => !!company?.papers?.[p.id]) && !!d.papers?.registration && !!d.papers?.insurance && !!company?.logoUri;
  return PAPERS.every((p) => !!d.papers?.[p.id]);
}
/** Offers open once the papers are sent (checked by Xapp's team in the real app). */
export const canOffer = (d: Profile) => !!d.testSkip || !!d.papersSentAt || (d.accountType !== 'company' && !!d.signedUpAt && papersDone(d));

const shoot = async (source: 'camera' | 'library') => {
  const got = await capture(source, 1);
  return Array.isArray(got) && got[0] ? got[0].uri : null;
};

export function SignUp({ part }: { part: 'name' | 'you' }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const d = store.driver;
  const co = store.company;
  const set = (patch: Partial<Profile>) => update((s) => ({ ...s, driver: { ...s.driver, ...patch } }));
  const setCo = (patch: Partial<Company>) => update((s) => ({ ...s, company: { vehicles: [], drivers: [], name: '', ...(s.company ?? {}), ...patch } }));
  const [picker, setPicker] = useState(false);
  const company = d.accountType === 'company';
  const input = { minHeight: 52, borderRadius: 14, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, fontSize: 16, color: c.fg } as const;
  // Name first (Rule 9); the phone and the rest come after the work questions.
  const [draft, setDraft] = useState(() => takeRestored<string>('signup') ?? d.name);
  const draftNow = useRef(draft);
  draftNow.current = draft;
  useEffect(() => saveOnRestart('signup', () => draftNow.current), []);
  const typeCard = (id: 'driver' | 'company', icon: keyof typeof Ionicons.glyphMap, title: Key, sub: Key) => {
    const on = d.accountType === id;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => {
          tap();
          set({ accountType: id });
        }}
        style={{ flex: 1, alignItems: 'center', gap: 8, padding: 14, borderRadius: 20, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: c.surface }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: on ? c.accent : c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={30} color={on ? c.onAccent : c.fg} />
        </View>
        <T size={16} weight="heavy" style={{ textAlign: 'center' }}>
          {t(title)}
        </T>
        <T size={12} muted style={{ textAlign: 'center' }}>
          {t(sub)}
        </T>
      </Pressable>
    );
  };
  if (part === 'name')
    return (
      <View style={{ gap: 14 }}>
        <T size={26} weight="heavy">
          {t('suWelcome')}
        </T>
        <T muted>{t('suWelcomeSub')}</T>
        <Card>
          <T weight="bold">{t('yourName')}</T>
          <TextInput value={draft} onChangeText={setDraft} accessibilityLabel={t('yourName')} placeholderTextColor={c.muted} style={[input, fieldDir(draft, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {typeCard('driver', 'person-outline', 'suTypeDriver', 'suTypeDriverSub')}
          {typeCard('company', 'business-outline', 'suTypeCompany', 'suTypeCompanySub')}
        </View>
        {company ? (
          <Card>
            <T weight="bold">{t('coName')}</T>
            <TextInput value={co?.name ?? ''} onChangeText={(name) => setCo({ name })} accessibilityLabel={t('coName')} placeholderTextColor={c.muted} style={[input, fieldDir(co?.name ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
            <T weight="bold">{t('coTeam')}</T>
            <View style={{ flexDirection: 'row', gap: 8, direction: 'ltr' }}>
              {[2, 3, 4, 5, 6].map((n) => {
                const on = co?.teamSize === n;
                return (
                  <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { tap(); setCo({ teamSize: n }); }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <T weight="heavy" color={on ? c.onAccent : c.fg}>
                      {n === 6 ? '6+' : String(n)}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}
        <Btn
          title={t('continue')}
          icon="arrow-forward"
          disabled={!draft.trim() || !d.accountType || (company && (!(co?.name ?? '').trim() || !co?.teamSize))}
          onPress={() => {
            play('success');
            set({ name: draft.trim() });
          }}
        />
        <SkipTest />
      </View>
    );
  return (
    <View style={{ gap: 14 }}>
      <T size={26} weight="heavy">
        {t('suYouTitle')}
      </T>
      <T muted>{company ? t('suYouSubCompany') : t('suYouSub')}</T>
      <Card style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: c.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: d.photoUri ? 3 : 2, borderStyle: d.photoUri ? 'solid' : 'dashed', borderColor: d.photoUri ? c.ok : c.accent }}>
          {d.photoUri ? <Image source={{ uri: d.photoUri }} style={{ width: 120, height: 120 }} resizeMode="cover" /> : <Ionicons name={company ? 'business' : 'person'} size={56} color={c.muted} />}
        </View>
        <T size={13} weight="bold" color={d.photoUri ? c.ok : c.accent}>
          {d.photoUri ? t('suPhotoOk') : company ? t('suPhotoOptional') : t('suPhotoRequired')}
        </T>
        <View style={{ gap: 8, alignSelf: 'stretch' }}>
          <Btn title={t('suSelfie')} small icon="camera-outline" onPress={async () => { const uri = await shoot('camera'); if (uri) { play('pop'); set({ photoUri: uri }); } }} />
          <Btn title={t('suGallery')} small kind="ghost" icon="images-outline" onPress={async () => { const uri = await shoot('library'); if (uri) { play('pop'); set({ photoUri: uri }); } }} />
        </View>
        {/* Examples of a good photo: customers trust a clear face. */}
            <View style={{ alignSelf: 'stretch', gap: 8, backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
              <T size={13} weight="heavy">
                {t('suPhotoTipsTitle')}
              </T>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {(
                  [
                    ['happy-outline', 'suTipFace', true],
                    ['sunny-outline', 'suTipLight', true],
                    ['glasses-outline', 'suTipNoGlasses', false],
                    ['people-outline', 'suTipAlone', false],
                  ] as const
                ).map(([icon, label, good]) => (
                  <View key={label} style={{ alignItems: 'center', gap: 4, width: '24%' }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={icon} size={22} color={c.fg} />
                      <View style={{ position: 'absolute', bottom: -4, end: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: good ? c.ok : c.danger, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={good ? 'checkmark' : 'close'} size={13} color={c.onInverse} />
                      </View>
                    </View>
                    <T size={11} style={{ textAlign: 'center' }}>
                      {t(label)}
                    </T>
                  </View>
                ))}
              </View>
            </View>
      </Card>
      <Card>
        <T weight="bold">{t('phoneLabel')}</T>
        <TextInput value={d.phone ?? ''} onChangeText={(phone) => set({ phone: phone.replace(/[^\d+ ]/g, '').slice(0, 16) })} keyboardType="phone-pad" accessibilityLabel={t('phoneLabel')} placeholder="06 / 07…" placeholderTextColor={c.muted} style={[input, fieldDir(d.phone ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
        <T size={12} muted>
          {t('suPhoneNote')}
        </T>
        <T weight="bold">{company ? t('coMainVehicle') : t('yourVehicle')}</T>
        <VehicleRow id={d.vehicle} onChange={() => setPicker(true)} />
        <T weight="bold">{t('plateLabel')}</T>
        <TextInput value={d.plate ?? ''} onChangeText={(plate) => set({ plate })} accessibilityLabel={t('plateLabel')} placeholder="12345-أ-6" placeholderTextColor={c.muted} style={[input, fieldDir(d.plate ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
      </Card>
      <Btn title={t('continue')} icon="arrow-forward" disabled={!youDone(d)} onPress={() => { play('success'); set({ signedUpAt: Date.now() }); }} />
      <VehiclePicker
        visible={picker}
        value={d.vehicle}
        weightKg={0}
        onClose={() => setPicker(false)}
        onPick={(id) => {
          set({ vehicle: id });
          setPicker(false);
        }}
      />
    </View>
  );
}

/** Test version only (#99): skip the sign-up, the work questions and the rules to try the driver side. */
function SkipTest() {
  const c = useColors();
  const { t } = useT();
  const d = useStore().driver;
  return (
    <View style={{ gap: 6, backgroundColor: c.warnSoft, borderRadius: 16, padding: 12 }}>
      <T size={12} color={c.warn}>
        {t('suSkipNote')}
      </T>
      <Btn
        title={t('suSkip')}
        kind="ghost"
        small
        icon="play-skip-forward"
        onPress={() => {
          tap();
          update((s) => ({
            ...s,
            driver: {
              ...s.driver,
              testSkip: true,
              accountType: d.accountType ?? 'driver',
              name: d.name.trim() || t('testDriverName'),
              phone: phoneOk(d.phone) ? d.phone : '0600000000',
              plate: (d.plate ?? '').trim() || '12345-A-6',
              signedUpAt: Date.now(),
              // Owner's report #20: nothing answered for him — the work questions come next, empty.
              work: d.work,
              rulesAt: d.rulesAt ?? Date.now(),
            },
          }));
        }}
      />
    </View>
  );
}

/**
 * Rule 9: papers last, one per line, each with the camera; a calm line says who sees them. Everything
 * entered is kept; he can come back later. Sending them opens the offers (Xapp's team checks them in
 * the real app). A company sends its own papers, its vehicle's papers and its logo (Rule 12).
 */
export function PapersPage({ onDone }: { onDone?: () => void }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const d = store.driver;
  const co = store.company;
  const company = d.accountType === 'company';
  const setPaper = (id: PaperId, uri: string) => update((s) => ({ ...s, driver: { ...s.driver, papers: { ...(s.driver.papers ?? {}), [id]: uri } } }));
  const setCoPaper = (id: string, uri: string) => update((s) => ({ ...s, company: { vehicles: [], drivers: [], name: '', ...(s.company ?? {}), papers: { ...(s.company?.papers ?? {}), [id]: uri } } }));
  const row = (key: string, icon: keyof typeof Ionicons.glyphMap, label: string, uri: string | undefined, save: (uri: string) => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${uri ? t('paperAdded') : t('paperAdd')}`}
      onPress={async () => {
        tap();
        const got = await shoot('camera');
        if (got) {
          play('pop');
          save(got);
        }
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 10, opacity: pressed ? 0.85 : 1, borderWidth: uri ? 0 : 1, borderStyle: 'dashed', borderColor: c.accent })}>
      <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" /> : <Ionicons name={icon} size={24} color={c.muted} />}
      </View>
      <View style={{ flex: 1 }}>
        <T weight="bold">{label}</T>
        <T size={12} weight="semibold" color={uri ? c.ok : c.accent}>
          {uri ? t('paperAdded') : t('paperScan')}
        </T>
      </View>
      <Ionicons name={uri ? 'checkmark-circle' : 'camera-outline'} size={24} color={uri ? c.ok : c.accent} />
    </Pressable>
  );
  const done = papersDone(d, co);
  return (
    <View style={{ gap: 14 }}>
      <T size={24} weight="heavy">
        {t('ppTitle')}
      </T>
      <View style={{ flexDirection: 'row', gap: 8, backgroundColor: c.okSoft, borderRadius: 14, padding: 10 }}>
        <Ionicons name="lock-closed" size={16} color={c.ok} />
        <T size={13} weight="semibold" style={{ flex: 1 }}>
          {t('ppPrivate')}
        </T>
      </View>
      <Card>
        {company
          ? [
              ...COMPANY_PAPERS.map((x) => row(x.id, x.icon, t(x.label), co?.papers?.[x.id], (u) => setCoPaper(x.id, u))),
              row('registration', 'document-text-outline', t('paperRegistration'), d.papers?.registration, (u) => setPaper('registration', u)),
              row('insurance', 'shield-checkmark-outline', t('paperInsurance'), d.papers?.insurance, (u) => setPaper('insurance', u)),
              row('logo', 'image-outline', t('coLogo'), co?.logoUri, (u) => update((s) => ({ ...s, company: { vehicles: [], drivers: [], name: '', ...(s.company ?? {}), logoUri: u } }))),
            ]
          : PAPERS.map((x) => row(x.id, x.icon, t(x.label), d.papers?.[x.id], (u) => setPaper(x.id, u)))}
        <T size={12} muted>
          {t('ppLater')}
        </T>
      </Card>
      {company && !co?.logoUri ? (
        <T size={13} muted>
          {t('coLogoHint')}
        </T>
      ) : null}
      <Btn
        title={t('ppSend')}
        icon="paper-plane"
        disabled={!done}
        onPress={() => {
          play('success');
          update((s) => ({ ...s, driver: { ...s.driver, papersSentAt: Date.now() } }));
          onDone?.();
        }}
      />
      <T size={12} muted>
        {t('papersTestNote')}
      </T>
    </View>
  );
}
