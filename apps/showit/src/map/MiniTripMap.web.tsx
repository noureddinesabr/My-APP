import { Image, View } from 'react-native';

import { useT } from '../i18n';
import type { LatLng } from '../lib/geo';
import { useStore } from '../store';
import { inside, PICTURES, SIZE, toPx, type Pic } from './pictures';
import { PIN, TripPin } from './pins';
import { useRoadRoute } from './trip';
import type { MiniTripMapProps } from './MiniTripMap';

/** Browser preview: the same small trip map on the still map pictures (the preview can't load tiles). */
export function MiniTripMap({ from, to, height }: MiniTripMapProps) {
  const { t } = useT();
  const route = useRoadRoute(from, to);
  const dark = useStore().appearance === 'dark';
  const W = 320;
  const pic: Pic = PICTURES.find((p) => inside(p, from) && inside(p, to)) ?? PICTURES[1];
  const a = toPx(pic, from);
  const b = toPx(pic, to);
  const pad = { top: 70, bottom: 16, side: 40 };
  const scale = Math.min(3, (W - pad.side * 2) / Math.max(Math.abs(a.x - b.x), 1), (height - pad.top - pad.bottom) / Math.max(Math.abs(a.y - b.y), 1));
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const left = W / 2 - cx * scale;
  const top = pad.top + (height - pad.top - pad.bottom) / 2 - cy * scale;
  const at = (p: LatLng) => {
    const q = toPx(pic, p);
    return { x: left + q.x * scale, y: top + q.y * scale };
  };
  const line = (route.length > 1 ? route : [from, to]).filter((p) => inside(pic, p)).map(at);
  const ok = inside(pic, from) && inside(pic, to);
  return (
    <View pointerEvents="none" style={{ height, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F2EFE9', alignItems: 'center' }}>
      <View style={{ width: W, height }}>
        <Image source={pic.source} style={[{ position: 'absolute', left, top, width: SIZE * scale, height: SIZE * scale }, dark ? ({ filter: 'invert(0.92) hue-rotate(180deg) brightness(0.92) saturate(0.6)' } as object) : null]} />
        {ok && line.length > 1 ? (
          <svg width={W} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={PIN.route} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        {ok
          ? (
              [
                ['pickup', from],
                ['dropoff', to],
              ] as const
            ).map(([kind, p]) => (
              <View key={kind} style={{ position: 'absolute', left: at(p).x - 80, top: at(p).y - 120, width: 160, height: 120, alignItems: 'center', justifyContent: 'flex-end' }}>
                <TripPin kind={kind} label={kind === 'pickup' ? t('mapPickup') : t('mapDropoff')} />
              </View>
            ))
          : null}
      </View>
    </View>
  );
}
