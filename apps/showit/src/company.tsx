import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, Share, View } from 'react-native';

import { fieldDir } from './composer';
import { TextInput } from './field';
import { capture } from './flow';
import { useT } from './i18n';
import { VehiclePicker, VehicleRow } from './shared';
import { play } from './sounds';
import { appMessage, newId, notify, patchRequest, update, useStore, type Company, type Request } from './store';
import { Btn, Card, T, tap, useColors } from './ui';
import type { VehicleId } from './vehicles';

/**
 * Rule 12: a company account. The manager makes the offers, adds his drivers (name, phone, photo and
 * a tick that each holds a valid licence; no papers from the driver) and his vehicles (plate and
 * papers once), and chooses who drives each trip. The customer sees the company's name with a
 * «Company ✓» badge, and on the trip day the driver's name, photo and plate.
 *
 * Test version: the invite goes by the phone's share sheet (SMS / WhatsApp); the driver's own login
 * (the phone number is the link) comes with accounts on the server.
 */

const setCompany = (patch: Partial<Company>) => update((s) => ({ ...s, company: { vehicles: [], drivers: [], name: '', ...(s.company ?? {}), ...patch } }));

/** «Company ✓» next to a name, on offers and on the trip. */
export function CompanyBadge({ small }: { small?: boolean }) {
  const c = useColors();
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: small ? 6 : 8, paddingVertical: 2 }}>
      <Ionicons name="business" size={small ? 11 : 13} color={c.live} />
      <T size={small ? 10 : 12} weight="heavy" color={c.live}>
        {t('coBadge')}
      </T>
    </View>
  );
}

/** The manager's team: drivers and vehicles (in his profile). */
export function TeamCard() {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const co = store.company ?? { name: '', vehicles: [], drivers: [] };
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [licence, setLicence] = useState(false);
  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState<VehicleId>(store.driver.vehicle);
  const [picker, setPicker] = useState(false);
  const input = { minHeight: 48, borderRadius: 14, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, fontSize: 16, color: c.fg } as const;
  const phoneOk = phone.replace(/\D/g, '').length >= 9;
  const invite = (n: string) => Share.share({ message: t('coInviteText', { company: co.name, name: n }) }).catch(() => {});
  return (
    <>
      <Card>
        <T size={18} weight="heavy">
          {t('coTeamTitle')}
        </T>
        <T size={13} muted>
          {t('coTeamSub')}
        </T>
        {co.drivers.map((d) => (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              {d.photoUri ? <Image source={{ uri: d.photoUri }} style={{ width: 40, height: 40 }} /> : <Ionicons name="person" size={20} color={c.muted} />}
            </View>
            <View style={{ flex: 1 }}>
              <T weight="heavy">{d.name}</T>
              <T size={12} muted>
                {d.joinedAt ? t('coJoined') : t('coInvited')}
              </T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('coInviteAgain')} onPress={() => invite(d.name)} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="paper-plane-outline" size={20} color={c.accent} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('coRemove')} onPress={() => { tap(); setCompany({ drivers: co.drivers.filter((x) => x.id !== d.id) }); }} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={20} color={c.danger} />
            </Pressable>
          </View>
        ))}
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
          <T weight="bold">{t('coAddDriver')}</T>
          <TextInput value={name} onChangeText={setName} placeholder={t('coDriverName')} placeholderTextColor={c.muted} accessibilityLabel={t('coDriverName')} style={[input, fieldDir(name, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
          <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+ ]/g, '').slice(0, 16))} keyboardType="phone-pad" placeholder="06 / 07…" placeholderTextColor={c.muted} accessibilityLabel={t('phoneLabel')} style={[input, fieldDir(phone, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]} />
          <Btn
            title={photo ? t('coPhotoAdded') : t('coAddPhoto')}
            small
            kind="ghost"
            icon={photo ? 'checkmark' : 'camera-outline'}
            onPress={async () => {
              const got = await capture('camera', 1);
              if (Array.isArray(got) && got[0]) setPhoto(got[0].uri);
            }}
          />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: licence }} onPress={() => { tap(); setLicence(!licence); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
            <Ionicons name={licence ? 'checkbox' : 'square-outline'} size={22} color={licence ? c.accent : c.muted} />
            <T size={14} style={{ flex: 1 }}>
              {t('coLicenceTick')}
            </T>
          </Pressable>
          <Btn
            title={t('coAddAndInvite')}
            icon="person-add-outline"
            disabled={!name.trim() || !phoneOk || !licence}
            onPress={() => {
              setCompany({ drivers: [...co.drivers, { id: newId(), name: name.trim(), phone: phone.trim(), photoUri: photo, licenceOk: true }] });
              play('success');
              invite(name.trim());
              setName('');
              setPhone('');
              setPhoto(undefined);
              setLicence(false);
            }}
          />
        </View>
      </Card>
      <Card>
        <T size={18} weight="heavy">
          {t('coVehiclesTitle')}
        </T>
        {co.vehicles.map((v) => (
          <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="car-outline" size={20} color={c.accent} />
            <T weight="heavy" style={{ flex: 1, writingDirection: 'ltr' }}>
              {v.plate}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={t('coRemove')} onPress={() => setCompany({ vehicles: co.vehicles.filter((x) => x.id !== v.id) })} hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={20} color={c.danger} />
            </Pressable>
          </View>
        ))}
        <VehicleRow id={vehicle} onChange={() => setPicker(true)} />
        <TextInput value={plate} onChangeText={setPlate} placeholder={t('plateLabel')} placeholderTextColor={c.muted} accessibilityLabel={t('plateLabel')} style={[input, { outlineWidth: 0, outlineStyle: 'none' } as object]} />
        <Btn
          title={t('coAddVehicle')}
          small
          icon="add"
          disabled={!plate.trim()}
          onPress={() => {
            setCompany({ vehicles: [...co.vehicles, { id: newId(), vehicle, plate: plate.trim() }] });
            setPlate('');
            play('pop');
          }}
        />
        <T size={12} muted>
          {t('coVehiclePapersNote')}
        </T>
      </Card>
      <VehiclePicker visible={picker} value={vehicle} weightKg={0} onClose={() => setPicker(false)} onPick={(id) => { setVehicle(id); setPicker(false); }} />
    </>
  );
}

/** On a booked trip, the manager chooses who drives and which vehicle (until the trip starts). */
export function AssignCard({ req }: { req: Request }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const co = store.company;
  if (store.driver.accountType !== 'company' || !co || req.stage !== 'accepted') return null;
  const me = store.driver.name;
  const drivers = [me, ...co.drivers.map((d) => d.name)];
  const plates = [store.driver.plate ?? '', ...co.vehicles.map((v) => v.plate)].filter(Boolean);
  const pick = (patch: Partial<Request>) => {
    patchRequest(req.id, patch);
    const now = { ...req, ...patch };
    if (now.assignedDriver && now.assignedPlate) {
      appMessage(req.id, 'coAssignedMsg', { name: now.assignedDriver, plate: now.assignedPlate }, 'customer');
      notify('customer', 'coAssignedNt', 'step', { name: now.assignedDriver }, undefined, req.id);
    }
  };
  const chip = (on: boolean, label: string, press: () => void) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { tap(); press(); }} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: c.surface }}>
      <T size={14} weight={on ? 'heavy' : 'regular'}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <Card>
      <T weight="heavy">{t('coWhoDrives')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{drivers.map((n) => chip(req.assignedDriver === n, n, () => pick({ assignedDriver: n })))}</View>
      <T weight="heavy">{t('coWhichVehicle')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{plates.map((p) => chip(req.assignedPlate === p, p, () => pick({ assignedPlate: p })))}</View>
      <T size={12} muted>
        {t('coAssignNote')}
      </T>
    </Card>
  );
}

/** What the customer sees on the trip from a company: its name, and the driver it sends. */
export function CompanyLine({ req }: { req: Request }) {
  const { t } = useT();
  if (!req.company) return null;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T size={13} weight="heavy">
          {req.company}
        </T>
        <CompanyBadge small />
      </View>
      {req.assignedDriver ? (
        <T size={12} muted>
          {t('coYourDriver', { name: req.assignedDriver, plate: req.assignedPlate ?? '' })}
        </T>
      ) : null}
    </View>
  );
}
