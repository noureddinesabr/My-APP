import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { updateClientProfile, updateDriverProfile } from '@/backend/actions';
import { useStore } from '@/backend';
import type { ClientRecord, DriverRecord, SavedPlace } from '@/backend/types';
import { Avatar, LevelBadge } from '@/components/live/parts';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { PlaceInput } from '@/components/place-input';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { useMyRecord } from '@/components/use-my-record';
import { DEFAULT_CITY } from '@/constants/cities';
import { locationFromCity } from '@/constants/places';
import { pickPhoto } from '@/lib/pick-photo';
import { play } from '@/lib/sounds';
import { levelFor, reliability } from '@/lib/trip';
import { useAccount } from '@/state/account';
import { useDriver } from '@/state/driver';
import { Radius, Spacing, useColors } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Profile for the current role: photo, contact details, rating, level and real stats. */
export default function Profile() {
  const { t } = useTranslation();
  const colors = useColors();
  const { side, account, driverRecord, clientRecord } = useMyRecord();
  const record = side === 'driver' ? driverRecord : clientRecord;

  if (!account) {
    return (
      <Screen>
        <Header />
        <Card>
          <Text variant="label">{t('profile.signInTitle')}</Text>
          <Text muted>{t('profile.signInBody')}</Text>
          <Button
            title={t('driver.signIn')}
            icon="log-in-outline"
            onPress={() => router.push({ pathname: '/login', params: { role: side } })}
          />
        </Card>
      </Screen>
    );
  }
  if (record === undefined) {
    return (
      <Screen>
        <Header />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (record === null) {
    return (
      <Screen>
        <Header />
        <Text muted>{t(side === 'driver' ? 'profile.driverNotReady' : 'profile.notReady')}</Text>
      </Screen>
    );
  }
  return side === 'driver' ? <DriverProfile record={record as DriverRecord} /> : <ClientProfile record={record as ClientRecord} />;
}

function Header() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.header}>
      <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />
      <Text variant="title">{t('profile.title')}</Text>
    </View>
  );
}

/** Photo, name and rating at the top of the profile. */
function Hero({
  name,
  photo,
  rating,
  ratingCount,
  trips,
  joinedAt,
  onPhoto,
}: {
  name: string;
  photo: string | null;
  rating: number;
  ratingCount: number;
  trips: number;
  joinedAt: number;
  onPhoto: (photo: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const joined = new Date(joinedAt);
  return (
    <Card style={{ alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePhoto')}
        onPress={async () => {
          setBusy(true);
          const picked = await pickPhoto(320);
          setBusy(false);
          if (picked) {
            play('success');
            onPhoto(picked);
          }
        }}>
        <Avatar name={name} photo={photo} size={96} />
        <View style={[styles.camera, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
          {busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="camera" size={16} color={colors.onPrimary} />}
        </View>
      </Pressable>
      <Text variant="title" center>
        {name}
      </Text>
      <View style={{ alignSelf: 'center' }}>
        <LevelBadge level={levelFor(trips, rating)} />
      </View>
      <View style={styles.statsRow}>
        <Stat value={ratingCount ? `★ ${rating.toFixed(1)}` : '★ –'} label={t('profile.ratings', { count: ratingCount })} />
        <Stat value={String(trips)} label={t('profile.trips')} />
        <Stat value={`${joined.getMonth() + 1}/${joined.getFullYear()}`} label={t('profile.memberSince')} />
      </View>
    </Card>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <Text variant="subtitle" center color={tone ?? colors.text}>
        {value}
      </Text>
      <Text variant="caption" muted center numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Name, phone and email; saves once, only what changed. */
function ContactForm({
  name,
  phone,
  email,
  extra,
  onSave,
}: {
  name: string;
  phone: string;
  email: string;
  extra?: { label: string; value: string; placeholder: string };
  onSave: (values: { name: string; phone: string; email: string; extra: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [values, setValues] = useState({ name, phone: phone.replace(/^\+212\s?/, ''), email, extra: extra?.value ?? '' });
  const [saved, setSaved] = useState(false);
  const changed =
    values.name.trim() !== name || `+212 ${values.phone.trim()}` !== phone || values.email.trim() !== email || values.extra.trim() !== (extra?.value ?? '');
  const emailOk = !values.email.trim() || EMAIL.test(values.email.trim());
  const valid = values.name.trim().length >= 2 && values.phone.replace(/\D/g, '').length >= 9 && emailOk;
  const set = (key: keyof typeof values) => (text: string) => {
    setSaved(false);
    setValues({ ...values, [key]: text });
  };

  return (
    <Card>
      <Text variant="subtitle">{t('profile.details')}</Text>
      <Field label={t('login.name')}>
        <TextInput value={values.name} onChangeText={set('name')} autoComplete="name" />
      </Field>
      <Field label={t('signup.phone')}>
        <View style={styles.phoneRow}>
          <View style={[styles.prefix, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="label">🇲🇦 +212</Text>
          </View>
          <TextInput
            value={values.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
            style={{ flex: 1, textAlign: 'left', writingDirection: 'ltr' }}
          />
        </View>
      </Field>
      <Field label={t('profile.email')}>
        <TextInput
          value={values.email}
          onChangeText={set('email')}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[{ textAlign: 'left', writingDirection: 'ltr' }, !emailOk && { borderWidth: 1.5, borderColor: colors.accent }]}
        />
        {!emailOk && (
          <Text variant="caption" color={colors.accent}>
            {t('profile.emailInvalid')}
          </Text>
        )}
      </Field>
      {extra && (
        <Field label={extra.label}>
          <TextInput value={values.extra} onChangeText={set('extra')} placeholder={extra.placeholder} />
        </Field>
      )}
      <Text variant="caption" muted>
        {t('profile.phoneNote')}
      </Text>
      <Button
        title={saved ? t('profile.saved') : t('profile.save')}
        icon={saved ? 'checkmark-circle' : 'save-outline'}
        disabled={!changed || !valid}
        sound="success"
        onPress={async () => {
          await onSave({ name: values.name.trim(), phone: `+212 ${values.phone.trim()}`, email: values.email.trim(), extra: values.extra.trim() });
          setSaved(true);
        }}
      />
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ClientProfile({ record }: { record: ClientRecord }) {
  const { t } = useTranslation();
  const store = useStore();
  const { updateAccount } = useAccount();
  return (
    <Screen>
      <Header />
      <Hero
        name={record.name}
        photo={record.photo}
        rating={record.rating}
        ratingCount={record.ratingCount}
        trips={record.trips}
        joinedAt={record.joinedAt}
        onPhoto={(photo) => updateClientProfile(store, record.id, { photo })}
      />
      <ContactForm
        name={record.name}
        phone={record.phone}
        email={record.email}
        extra={{ label: t('profile.company'), value: record.company, placeholder: t('profile.companyPlaceholder') }}
        onSave={async (values) => {
          updateAccount('client', { name: values.name, phone: values.phone });
          await updateClientProfile(store, record.id, { name: values.name, phone: values.phone, email: values.email, company: values.extra });
        }}
      />
      <SavedPlaces record={record} />
    </Screen>
  );
}

/** Home / work addresses offered first when the client types a location. */
function SavedPlaces({ record }: { record: ClientRecord }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const [editing, setEditing] = useState<SavedPlace['label'] | null>(null);
  const save = (label: SavedPlace['label'], place: SavedPlace | undefined, location: SavedPlace['location']) => {
    // One home and one work address: each replaces the previous one.
    const others = record.savedPlaces.filter((item) => item.label !== label);
    const next: SavedPlace = { id: place?.id ?? label, label, name: t(`profile.place_${label}`), location };
    updateClientProfile(store, record.id, { savedPlaces: [...others, next] });
    setEditing(null);
  };
  return (
    <Card>
      <Text variant="subtitle">{t('profile.savedPlaces')}</Text>
      <Text variant="caption" muted>
        {t('profile.savedPlacesHint')}
      </Text>
      {(['home', 'work'] as const).map((label) => {
        const place = record.savedPlaces.find((item) => item.label === label);
        return (
          <View key={label} style={{ gap: Spacing.sm }}>
            {editing === label ? (
              <PlaceInput
                label={t(`profile.place_${label}`)}
                dotColor={colors.primary}
                value={place?.location ?? locationFromCity(DEFAULT_CITY)}
                onChange={(location) => save(label, place, location)}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditing(label)}
                style={[styles.placeRow, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={label === 'home' ? 'home-outline' : 'briefcase-outline'} size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{t(`profile.place_${label}`)}</Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {place ? names.label(place.location) : t('profile.addPlace')}
                  </Text>
                </View>
                <Ionicons name={place ? 'create-outline' : 'add-circle-outline'} size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function DriverProfile({ record }: { record: DriverRecord }) {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const { updateAccount } = useAccount();
  const { profile } = useDriver();
  const stats = record.stats;
  const score = reliability(stats);
  const arrivals = stats.onTime + stats.late;
  const onTime = arrivals ? Math.round((stats.onTime / arrivals) * 100) : 100;
  const compliments = Object.entries(record.compliments).sort((a, b) => b[1] - a[1]);

  return (
    <Screen>
      <Header />
      <Hero
        name={record.name}
        photo={record.photo}
        rating={record.rating}
        ratingCount={record.ratingCount}
        trips={record.trips}
        joinedAt={record.joinedAt}
        onPhoto={(photo) => updateDriverProfile(store, record.id, { photo })}
      />

      <Card>
        <Text variant="subtitle">{t('profile.performance')}</Text>
        <View style={styles.statsRow}>
          <Stat value={`${score}%`} label={t('profile.reliability')} tone={score >= 90 ? colors.success : score >= 75 ? colors.text : colors.accent} />
          <Stat value={`${onTime}%`} label={t('profile.onTime')} />
          <Stat value={formatMoney(t, record.wallet)} label={t('wallet.balance')} />
        </View>
        <Text variant="caption" muted>
          {t('profile.reliabilityExplain', {
            accepted: stats.accepted,
            cancelled: stats.cancelled + stats.lateCancels,
            late: stats.late,
          })}
        </Text>
        {compliments.length > 0 && (
          <View style={styles.tags}>
            {compliments.map(([tag, count]) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.successSoft }]}>
                <Text variant="caption" color={colors.success}>
                  {t(tag)} · {count}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <ContactForm
        name={record.name}
        phone={record.phone}
        email={record.email}
        onSave={async (values) => {
          updateAccount('driver', { name: values.name, phone: values.phone });
          await updateDriverProfile(store, record.id, { name: values.name, phone: values.phone, email: values.email });
        }}
      />

      <Card>
        <Text variant="subtitle">{t('profile.vehicleAndDocs')}</Text>
        <LinkRow
          icon="truck-outline"
          label={t('driver.vehicleTitle')}
          value={profile.vehicle ? `${t(`vehicle.${profile.vehicle.type}`)} · ${profile.vehicle.plate}` : t('driver.ctaVehicle')}
          onPress={() => router.push('/driver-vehicle')}
        />
        <LinkRow
          icon="file-document-outline"
          label={t('driver.documentsTitle')}
          value={t(profile.status === 'approved' ? 'driver.approvedTitle' : 'driver.pendingTitle')}
          onPress={() => router.push('/driver-documents')}
        />
      </Card>
    </Screen>
  );
}

function LinkRow({ icon, label, value, onPress }: { icon: 'truck-outline' | 'file-document-outline'; label: string; value: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.placeRow, { backgroundColor: colors.surfaceMuted }]}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" muted>
          {value}
        </Text>
      </View>
      <ForwardChevron color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  camera: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
  stat: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, gap: 2 },
  phoneRow: { flexDirection: 'row', gap: Spacing.sm, direction: 'ltr' },
  prefix: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.pill },
});

