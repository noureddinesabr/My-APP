import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { T } from '../ui';

export const PIN = { pickup: '#C2410C', dropoff: '#B91C1C', me: '#0F766E', route: '#13141A' } as const;

/** Pickup or destination: its name on a white tag, a round head with the icon, a short stem. */
export function TripPin({ kind, label }: { kind: 'pickup' | 'dropoff'; label: string }) {
  const color = PIN[kind];
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={label}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 9, marginBottom: 3, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
        <T size={12} weight="bold" color="#13141A">
          {label}
        </T>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
        <Ionicons name={kind === 'pickup' ? 'cube' : 'flag'} size={16} color="#FFFFFF" />
      </View>
      <View style={{ width: 3, height: 9, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}

/** You are here: a teal dot with a soft ring. */
export function MeDot() {
  return (
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(15,118,110,0.18)', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: PIN.me, borderWidth: 3, borderColor: '#FFFFFF', elevation: 3 }} />
    </View>
  );
}

/** Pin sizes, for placing them by the point they stand on. */
export const PIN_SIZE = { width: 120, height: 72 };
