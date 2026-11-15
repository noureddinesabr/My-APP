import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { useDateFormat } from '@/components/date-format';
import { useLocationLabel } from '@/components/location-label';
import { currencyUnit, formatMoney } from '@/components/money';
import { PressableScale } from '@/components/motion/pressable-scale';
import { formatWeight } from '@/components/request/format';
import { ITEM_OPTIONS } from '@/components/request/access-options';
import { earliestTime, nearestBookable, timeLeftToday, TimeWheels } from '@/components/request/time-wheels';
import { Sheet } from '@/components/sheet';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, ForwardChevron, IconButton } from '@/components/ui';
import { FREIGHT_TYPES, needsCold, typicalTonsFor, WEIGHT_OPTIONS, type FreightTypeId } from '@/constants/freight';
import { VEHICLE_TYPES, vehicleImage } from '@/constants/vehicles';
import { maxTons, suggestVehicle } from '@/lib/pricing';
import { dayKey, fromLocalString, toLocalString } from '@/lib/schedule';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { tripEstimate, useRequestDraft, type Place } from '@/state/request-draft';
import { Fonts, Radius, rim, Spacing, useColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Normal-size text on this page, so filling it in feels light. */
const SMALL = { fontSize: 14, lineHeight: 20 };
const HEAD = { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 22 };

/**
 * Page 3 of the customer's request (after the photo scan and the route): every other question
 * on one page that scrolls, each answered with small options, and the price at the end, which the
 * customer must pick before sending.
 */
export default function RequestDetails() {
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const { client } = useAccount();
  const { draft, update, discard } = useRequestDraft();
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const estimate = tripEstimate(draft).price;
  const best = suggestVehicle(draft.tons, needsCold(draft.freightTypes));
  const missing = !draft.freightTypes.length ? 'kind' : !draft.priceChosen ? 'price' : null;

  const toggleKind = (id: FreightTypeId) => {
    const chosen = draft.freightTypes.includes(id) ? draft.freightTypes.filter((type) => type !== id) : [...draft.freightTypes, id];
    update({ freightTypes: chosen, ...(chosen.length && !draft.weightKnown ? { tons: typicalTonsFor(chosen) } : {}) });
  };

  const send = async () => {
    if (missing) {
      setTried(true);
      play('error');
      if (missing === 'kind') scroll.current?.scrollTo({ y: 0, animated: true });
      else scroll.current?.scrollToEnd({ animated: true });
      return;
    }
    if (!client) {
      router.push({ pathname: '/login', params: { role: 'client', next: 'publish' } });
      return;
    }
    setSending(true);
    try {
      await ensureClient(store, client);
      const id = await publishRequest(store, client, draft);
      play('send');
      discard();
      router.replace({ pathname: '/track/[id]', params: { id, sent: '1' } });
    } catch {
      play('error');
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <View style={styles.header}>
          <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => (router.canGoBack() ? router.back() : router.replace('/client'))} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24 }}>{t('details.title')}</Text>
            <Text muted style={SMALL}>
              {names.shortRoute(draft.from, draft.to)} · {t('request.distance', { km: tripEstimate(draft).km })}
            </Text>
          </View>
          <Text muted style={SMALL}>
            3/4
          </Text>
        </View>

        <ScrollView ref={scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Section icon="package-variant-closed" title={t('details.what')} required error={tried && missing === 'kind' ? t('details.needKind') : undefined}>
            <Options>
              {FREIGHT_TYPES.map((type) => (
                <Option key={type.id} icon={type.icon} label={t(`freight.${type.id}`)} selected={draft.freightTypes.includes(type.id)} onPress={() => toggleKind(type.id)} />
              ))}
            </Options>
          </Section>

          <Section icon="weight-kilogram" title={t('details.weight')}>
            <Options>
              {WEIGHT_OPTIONS.map((tons) => (
                <Option
                  key={tons}
                  label={`≈ ${formatWeight(t, tons)}`}
                  selected={draft.weightKnown && draft.tons === tons}
                  onPress={() => update({ tons, weightKnown: true, vehicleChosen: false })}
                />
              ))}
              <Option
                label={t('quest.weightUnknown')}
                selected={!draft.weightKnown}
                onPress={() => update({ tons: typicalTonsFor(draft.freightTypes.length ? draft.freightTypes : [draft.freightType]), weightKnown: false, vehicleChosen: false })}
              />
            </Options>
          </Section>

          <Section icon="truck-outline" title={t('details.vehicle')} hint={t('details.vehicleHint')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
              {VEHICLE_TYPES.map((vehicle) => {
                const on = draft.vehicle === vehicle.id;
                return (
                  <PressableScale
                    key={vehicle.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    scaleTo={0.96}
                    onPress={() => {
                      play('pop');
                      update({ vehicle: vehicle.id, vehicleChosen: true });
                    }}
                    style={[styles.vehicle, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.rim }]}>
                    <Image source={vehicleImage(vehicle.id)} style={styles.vehicleImage} contentFit="contain" />
                    <Text style={[SMALL, { fontFamily: Fonts.semibold }]} center>
                      {t(`vehicle.${vehicle.id}`)}
                    </Text>
                    <Text muted style={{ fontSize: 12, lineHeight: 16 }} center>
                      {t('request.upTo', { tons: maxTons(vehicle.id) })}
                    </Text>
                    {vehicle.id === best && (
                      <View style={[styles.best, { backgroundColor: colors.primaryFill }]}>
                        <Text color={colors.onPrimary} style={{ fontSize: 11, lineHeight: 15, fontFamily: Fonts.bold }}>
                          {t('quest.bestFit')}
                        </Text>
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Section>

          <WhenSection />

          <Section icon="account-hard-hat" title={t('details.helpers')}>
            <Options>
              {[0, 1, 2, 3].map((count) => (
                <Option key={count} label={t(`details.helpers${count}`)} selected={draft.helpers === count} onPress={() => update({ helpers: count })} />
              ))}
            </Options>
          </Section>

          <Section icon="stairs" title={t('details.floors')}>
            <FloorRow label={t('request.atPickup')} value={draft.pickup} onChange={(pickup) => update({ pickup })} />
            <FloorRow label={t('request.atDropoff')} value={draft.dropoff} onChange={(dropoff) => update({ dropoff })} />
          </Section>

          <Section icon="alert-circle-outline" title={t('details.extras')} hint={t('details.optional')}>
            <Options>
              {ITEM_OPTIONS.map((option) => {
                const on = draft.itemOptions.includes(option.id);
                return (
                  <Option
                    key={option.id}
                    icon={option.icon}
                    label={t(option.key)}
                    selected={on}
                    onPress={() => update({ itemOptions: on ? draft.itemOptions.filter((id) => id !== option.id) : [...draft.itemOptions, option.id] })}
                  />
                );
              })}
              <Option icon="seat-passenger" label={t('request.rideAlong')} selected={draft.rideAlong} onPress={() => update({ rideAlong: !draft.rideAlong })} />
            </Options>
          </Section>

          <Section icon="note-text-outline" title={t('details.note')} hint={t('details.optional')}>
            <TextInput value={draft.notes} onChangeText={(notes) => update({ notes })} placeholder={t('details.notePlaceholder')} multiline style={[styles.note, SMALL]} />
          </Section>

          <Section icon="cash" title={t('details.price')} required error={tried && missing === 'price' ? t('details.needPrice') : undefined}>
            <Text muted style={SMALL}>
              {t('details.priceHint', { low: formatMoney(t, estimate.low), high: formatMoney(t, estimate.high) })}
            </Text>
            <Options>
              {[estimate.low, estimate.suggested, estimate.high].map((price, index) => (
                <Option
                  key={index}
                  label={`${formatMoney(t, price)}${index === 1 ? ` · ${t('details.usual')}` : ''}`}
                  selected={draft.priceChosen && draft.price === price}
                  onPress={() => update({ price, priceChosen: true })}
                />
              ))}
            </Options>
            <Text muted style={SMALL}>
              {t('details.ownPrice')}
            </Text>
            <Stepper
              value={draft.price}
              step={draft.price < 1000 ? 10 : draft.price < 5000 ? 50 : 100}
              min={10}
              max={200_000}
              onChange={(price) => update({ price, priceChosen: true })}
              format={(value) => formatMoney(t, value)}
              editable
              unit={currencyUnit(t)}
            />
            <Text muted style={SMALL}>
              {t('request.payCash')}
            </Text>
          </Section>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surfaceRaised, borderColor: colors.rim }]}>
          <Button
            variant={draft.priceChosen && draft.freightTypes.length ? 'accent' : 'ghost'}
            icon="paper-plane"
            sound={null}
            disabled={sending}
            title={draft.priceChosen ? t('details.sendFor', { price: formatMoney(t, draft.price) }) : t('details.pickPriceFirst')}
            onPress={send}
          />
          {!client && (
            <Text muted center style={{ fontSize: 12, lineHeight: 16 }}>
              {t('quest.signInLater')}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function WhenSection() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const { draft, update } = useRequestDraft();
  const [wheel, setWheel] = useState<'today' | 'date' | null>(null);
  const [pending, setPending] = useState(draft.scheduledAt);
  const now = new Date();
  const isToday = draft.when === 'scheduled' && dayKey(fromLocalString(draft.scheduledAt)) === dayKey(now);
  const later = draft.when === 'scheduled' && !isToday;
  const open = (mode: 'today' | 'date') => {
    setPending(
      mode === 'today'
        ? isToday
          ? draft.scheduledAt
          : toLocalString(nearestBookable(earliestTime(now), now))
        : later
          ? draft.scheduledAt
          : toLocalString(nearestBookable(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0), now)),
    );
    setWheel(mode);
  };
  return (
    <Section icon="calendar-clock" title={t('details.when')}>
      <Options>
        <Option icon="lightning-bolt" label={t('details.now')} selected={draft.when === 'now'} onPress={() => update({ when: 'now', pickupWindow: 'asap' })} />
        <Option
          icon="clock-time-four-outline"
          label={isToday ? dates.pickupShort(draft.scheduledAt) : t('request.today')}
          selected={isToday}
          onPress={() => (timeLeftToday(now) ? open('today') : open('date'))}
        />
        <Option icon="calendar-month-outline" label={later ? dates.pickupShort(draft.scheduledAt) : t('details.otherDay')} selected={later} onPress={() => open('date')} />
      </Options>
      <Sheet visible={wheel !== null} onClose={() => setWheel(null)} title={wheel === 'today' ? t('quest.whenTodayTitle') : t('quest.whenLater')} drag="handle">
        {wheel && <TimeWheels mode={wheel} value={pending} onChange={setPending} />}
        <Button
          variant="accent"
          icon="checkmark"
          title={t('quest.pickupAt', { date: dates.pickupShort(pending) })}
          sound="pop"
          onPress={() => {
            update({ when: 'scheduled', scheduledAt: pending });
            setWheel(null);
          }}
        />
      </Sheet>
    </Section>
  );
}

function Section({ icon, title, hint, required, error, children }: { icon: IconName; title: string; hint?: string; required?: boolean; error?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: error ? colors.accent : colors.rim }, rim(colors)]}>
      <View style={styles.sectionHead}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text style={[HEAD, { flex: 1 }]}>{title}</Text>
        {required && (
          <Text style={{ fontSize: 12, lineHeight: 16 }} color={colors.primary}>
            {t('details.required')}
          </Text>
        )}
        {!!hint && !required && (
          <Text muted style={{ fontSize: 12, lineHeight: 16 }}>
            {hint}
          </Text>
        )}
      </View>
      {!!hint && required && (
        <Text muted style={SMALL}>
          {hint}
        </Text>
      )}
      {children}
      {!!error && (
        <Text color={colors.accent} style={SMALL}>
          {error}
        </Text>
      )}
    </View>
  );
}

function Options({ children }: { children: ReactNode }) {
  return <View style={styles.options}>{children}</View>;
}

function Option({ label, icon, selected, onPress }: { label: string; icon?: IconName; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      scaleTo={0.95}
      onPress={() => {
        play('pop');
        onPress();
      }}
      style={[styles.option, { backgroundColor: selected ? colors.primaryFill : colors.control, borderColor: selected ? colors.primaryFill : 'transparent' }]}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={selected ? colors.onPrimary : colors.primary} />}
      <Text style={[SMALL, { fontFamily: selected ? Fonts.semibold : Fonts.medium }]} color={selected ? colors.onPrimary : colors.onControl}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
    </PressableScale>
  );
}

function FloorRow({ label, value, onChange }: { label: string; value: Place; onChange: (place: Place) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 6 }}>
      <Text muted style={SMALL}>
        {label}
      </Text>
      <Options>
        {[0, 1, 2, 3, 4, 5].map((floor) => (
          <Option
            key={floor}
            label={floor === 0 ? t('request.floorGround') : floor === 5 ? '5+' : String(floor)}
            selected={value.floor === floor}
            onPress={() => onChange({ ...value, floor })}
          />
        ))}
      </Options>
      {value.floor > 0 && (
        <Options>
          <Option icon="elevator-passenger-outline" label={t('request.accessElevator')} selected={value.access === 'elevator'} onPress={() => onChange({ ...value, access: 'elevator' })} />
          <Option icon="stairs" label={t('request.accessStairs')} selected={value.access === 'stairs'} onPress={() => onChange({ ...value, access: 'stairs' })} />
        </Options>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.sm },
  section: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: Radius.pill, borderWidth: 1.5 },
  vehicle: { width: 112, alignItems: 'center', gap: 2, paddingVertical: Spacing.sm, paddingHorizontal: 6, borderRadius: Radius.lg, borderWidth: 1.5 },
  vehicleImage: { width: 92, height: 50 },
  best: { position: 'absolute', top: 4, end: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill },
  note: { minHeight: 70, textAlignVertical: 'top' },
  footer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: 4, borderTopWidth: 1, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
});
