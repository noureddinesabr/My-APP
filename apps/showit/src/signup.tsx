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
import { update, useStore, type PaperId, type Profile } from './store';
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
/** Whether the sign-up has everything (photo, name, phone, vehicle and plate, the four papers). */
export const signupDone = (d: Profile) => !!d.testSkip || (!!d.signedUpAt && !!d.name.trim() && !!d.photoUri && phoneOk(d.phone) && !!(d.plate ?? '').trim() && PAPERS.every((p) => !!d.papers?.[p.id]));

const shoot = async (source: 'camera' | 'library') => {
  const got = await capture(source, 1);
  return Array.isArray(got) && got[0] ? got[0].uri : null;
};

export function SignUp() {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const d = store.driver;
  const set = (patch: Partial<Profile>) => update((s) => ({ ...s, driver: { ...s.driver, ...patch } }));
  const [step, setStep] = useState(() => takeRestored<number>('signup') ?? (!d.photoUri || !d.name.trim() || !phoneOk(d.phone) ? 0 : !(d.plate ?? '').trim() ? 1 : 2));
  const stepNow = useRef(step);
  stepNow.current = step;
  useEffect(() => saveOnRestart('signup', () => stepNow.current), []);
  const [picker, setPicker] = useState(false);
  const input = { minHeight: 52, borderRadius: 14, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, fontSize: 16, color: c.fg } as const;
  const ready = step === 0 ? !!d.photoUri && !!d.name.trim() && phoneOk(d.phone) : step === 1 ? !!(d.plate ?? '').trim() : PAPERS.every((p) => !!d.papers?.[p.id]);
  const titles: Key[] = ['suStep1', 'suStep2', 'suStep3'];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <T size={13} weight="heavy" color={c.accent}>
          {t('suProgress', { n: step + 1 })}
        </T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.accent : c.raised }} />
          ))}
        </View>
        <T size={26} weight="heavy">
          {t(titles[step])}
        </T>
        <T muted>{t(step === 0 ? 'suSub1' : step === 1 ? 'suSub2' : 'suSub3')}</T>
      </View>

      {step === 0 ? (
        <>
          <Card style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: c.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: d.photoUri ? 3 : 2, borderStyle: d.photoUri ? 'solid' : 'dashed', borderColor: d.photoUri ? c.ok : c.accent }}>
              {d.photoUri ? <Image source={{ uri: d.photoUri }} style={{ width: 120, height: 120 }} resizeMode="cover" /> : <Ionicons name="person" size={56} color={c.muted} />}
            </View>
            <T size={13} weight="bold" color={d.photoUri ? c.ok : c.accent}>
              {d.photoUri ? t('suPhotoOk') : t('suPhotoRequired')}
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
                        <Ionicons name={good ? 'checkmark' : 'close'} size={13} color="#FFFFFF" />
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
            <T weight="bold">{t('yourName')}</T>
            <TextInput value={d.name} onChangeText={(name) => set({ name })} accessibilityLabel={t('yourName')} placeholderTextColor={c.muted} style={[input, fieldDir(d.name, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
            <T weight="bold">{t('phoneLabel')}</T>
            <TextInput value={d.phone ?? ''} onChangeText={(phone) => set({ phone: phone.replace(/[^\d+ ]/g, '').slice(0, 16) })} keyboardType="phone-pad" accessibilityLabel={t('phoneLabel')} placeholder="06 / 07…" placeholderTextColor={c.muted} style={[input, fieldDir(d.phone ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
            <T size={12} muted>
              {t('suPhoneNote')}
            </T>
          </Card>
        </>
      ) : null}

      {step === 1 ? (
        <Card>
          <T weight="bold">{t('yourVehicle')}</T>
          <VehicleRow id={d.vehicle} onChange={() => setPicker(true)} />
          <T weight="bold">{t('plateLabel')}</T>
          <TextInput value={d.plate ?? ''} onChangeText={(plate) => set({ plate })} accessibilityLabel={t('plateLabel')} placeholder="12345-أ-6" placeholderTextColor={c.muted} style={[input, fieldDir(d.plate ?? '', lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          {PAPERS.map((x) => {
            const uri = d.papers?.[x.id];
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(x.label)}: ${uri ? t('paperAdded') : t('paperAdd')}`}
                onPress={async () => {
                  tap();
                  const got = await shoot('library');
                  if (got) set({ papers: { ...(d.papers ?? {}), [x.id]: got } });
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 10, opacity: pressed ? 0.85 : 1, borderWidth: uri ? 0 : 1, borderStyle: 'dashed', borderColor: c.accent })}>
                <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                  {uri ? <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" /> : <Ionicons name={x.icon} size={24} color={c.muted} />}
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="bold">{t(x.label)}</T>
                  <T size={12} weight="semibold" color={uri ? c.ok : c.accent}>
                    {uri ? t('paperAdded') : t('paperRequired')}
                  </T>
                </View>
                <Ionicons name={uri ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={uri ? c.ok : c.accent} />
              </Pressable>
            );
          })}
          <T size={12} muted>
            {t('papersTestNote')}
          </T>
        </Card>
      ) : null}

      <Btn title={step < 2 ? t('continue') : t('suFinish')} icon="arrow-forward" disabled={!ready} onPress={() => { play('success'); if (step < 2) setStep(step + 1); else set({ signedUpAt: Date.now() }); }} />
      {step > 0 ? <Btn title={t('back')} kind="ghost" onPress={() => setStep(step - 1)} /> : null}
      {/* Test version only (#99): skip the sign-up, the work questions and the rules to try the driver side. */}
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
            set({
              testSkip: true,
              name: d.name.trim() || t('testDriverName'),
              phone: phoneOk(d.phone) ? d.phone : '0600000000',
              plate: (d.plate ?? '').trim() || '12345-A-6',
              signedUpAt: Date.now(),
              work: d.work?.helpers && d.work.area && d.work.shared !== undefined ? d.work : { helpers: 'no', area: 'everywhere', shared: true, skills: [] },
              rulesAt: d.rulesAt ?? Date.now(),
            });
          }}
        />
      </View>
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
