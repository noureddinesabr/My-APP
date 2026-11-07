import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from './i18n';
import { Overlay } from './overlay';
import { VehicleRow } from './shared';
import { useStore, type Request } from './store';
import { T, tap, useColors } from './ui';
import type { VehicleId } from './vehicles';

/** A driver's rating, from the stars customers gave after delivery (only real ratings, never made up). */
export function driverRating(requests: Request[], name: string) {
  const rated = requests.filter((r) => r.driverName === name && r.stage === 'delivered' && r.rating);
  const trips = requests.filter((r) => r.driverName === name && r.stage === 'delivered').length;
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : 0;
  return { avg, count: rated.length, trips };
}

/** ★ 4.5 (3), or "New" when nobody has rated them yet. */
export function Stars({ avg, count, size = 13 }: { avg: number; count: number; size?: number }) {
  const c = useColors();
  const { t } = useT();
  if (!count) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="star-outline" size={size} color={c.muted} />
        <T size={size - 1} muted>
          {t('noRatingsYet')}
        </T>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={size} color="#D97706" />
      <T size={size} weight="heavy" style={{ writingDirection: 'ltr' }}>
        {avg.toFixed(1)}
      </T>
      <T size={size - 1} muted>
        {count === 1 ? t('oneRating') : t('ratingsN', { n: count })}
      </T>
    </View>
  );
}

/** A round photo, or the initials when there is no photo. */
export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string; size?: number }) {
  const c = useColors();
  const init = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.liveSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <T size={Math.round(size * 0.36)} weight="heavy" color={c.live}>
          {init || '?'}
        </T>
      )}
    </View>
  );
}

export type Person = { role: 'driver' | 'customer'; name: string; photo?: string; vehicle?: VehicleId; example?: boolean; city?: string };

/** The photo and name of the other side, tappable to open their profile. */
export function PersonChip({ person, onOpen, size = 48 }: { person: Person; onOpen: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={person.name}
      onPress={() => {
        tap();
        onOpen();
      }}
      hitSlop={6}>
      <Avatar name={person.name} uri={person.photo} size={size} />
    </Pressable>
  );
}

/**
 * Someone's profile as the other side sees it: photo, name, and for drivers their vehicle,
 * rating and trips. Never a phone number.
 */
export function PersonSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const rating = person?.role === 'driver' ? driverRating(store.requests, person.name) : null;
  const sent = person?.role === 'customer' ? store.requests.length : 0;
  return (
    <Overlay visible={!!person} onClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(19,20,26,0.45)' }} />
      {person ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 14, alignItems: 'center' }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          <Avatar name={person.name} uri={person.photo} size={92} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <T size={22} weight="heavy">
              {person.name || t('customer')}
            </T>
            <T size={13} muted>
              {person.role === 'driver' ? t('driverLabel') : t('customer')}
              {person.city ? ` · ${person.city}` : ''}
            </T>
            {rating ? <Stars avg={rating.avg} count={rating.count} size={15} /> : null}
          </View>
          {person.example ? (
            <View style={{ backgroundColor: c.warnSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
              <T size={12} color={c.warn}>
                {t('exampleOffer')}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 10, alignItems: 'center' }}>
              <T size={20} weight="heavy">
                {String(rating ? rating.trips : sent)}
              </T>
              <T size={12} muted>
                {rating ? t('statTrips') : t('statRequests')}
              </T>
            </View>
            {rating ? (
              <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 10, alignItems: 'center' }}>
                <T size={20} weight="heavy">
                  {String(rating.count)}
                </T>
                <T size={12} muted>
                  {t('ratingsLabel')}
                </T>
              </View>
            ) : null}
          </View>
          {person.vehicle ? (
            <View style={{ alignSelf: 'stretch' }}>
              <VehicleRow id={person.vehicle} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Overlay>
  );
}
