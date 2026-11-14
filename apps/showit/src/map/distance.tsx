import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useT } from '../i18n';
import { roadKm } from '../lib/pricing';
import { T } from '../ui';

type P = { lat: number; lng: number };
const rad = (d: number) => (d * Math.PI) / 180;
const leg = (a: P, b: P) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/**
 * The distance between the pickup and the destination, written on the map at the top of its clear
 * window (round 6): the length of the road route when known, otherwise the usual road estimate.
 */
export function DistancePill({ from, to, route, top }: { from?: P; to?: P; route: P[]; top: number }) {
  const { t } = useT();
  if (!from || !to) return null;
  const km = route.length > 1 ? Math.max(1, Math.round(route.slice(1).reduce((sum, p, i) => sum + leg(route[i], p), 0))) : roadKm(from, to);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: top + 10, left: 0, right: 0, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#163F3A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 }}>
        <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
        <T size={13} weight="heavy" color="#FFFFFF">
          {t('kmByRoad', { km })}
        </T>
      </View>
    </View>
  );
}
