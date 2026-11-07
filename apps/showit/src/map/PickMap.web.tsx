import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Image, PanResponder, StyleSheet, View } from 'react-native';

import type { LatLng } from '../lib/geo';
import { MeDot } from './pins';
import { fromPx, inside, PICTURES, SIZE, toPx, type Pic } from './pictures';
import type { PickMapProps } from './PickMap';

/**
 * Browser preview: the same still map pictures as the backdrop (the preview can't load tiles),
 * dragged under the pin. Casablanca up close, the region around it otherwise.
 */
export function PickMap({ start, target, me, onMove, onDrag }: PickMapProps) {
  const [size, setSize] = useState({ w: 360, h: 400 });
  const pick = (p: LatLng): Pic => PICTURES.find((x) => inside(x, p)) ?? PICTURES[1];
  const [pic, setPic] = useState<Pic>(() => pick(start));
  const scale = pic.id === 'casa' ? 1.6 : 1;
  // Where the picture sits: the chosen point in the middle of the view.
  const centerOn = (p: LatLng, on: Pic) => {
    const q = toPx(on, p);
    return { x: size.w / 2 - q.x * (on.id === 'casa' ? 1.6 : 1), y: size.h / 2 - q.y * (on.id === 'casa' ? 1.6 : 1) };
  };
  const [pos, setPos] = useState(() => centerOn(start, pic));
  const posRef = useRef(pos);
  posRef.current = pos;
  const report = (p: { x: number; y: number }, on = pic) => {
    const s = on.id === 'casa' ? 1.6 : 1;
    onMove(fromPx(on, (size.w / 2 - p.x) / s, (size.h / 2 - p.y) / s));
  };
  const reportRef = useRef(report);
  reportRef.current = report;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(size.w / 2, Math.max(size.w / 2 - SIZE * scale, p.x)), y: Math.min(size.h / 2, Math.max(size.h / 2 - SIZE * scale, p.y)) });
  const clampRef = useRef(clamp);
  clampRef.current = clamp;
  const from = useRef({ x: 0, y: 0 });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        from.current = posRef.current;
        onDrag?.(true);
      },
      onPanResponderMove: (_, g) => setPos(clampRef.current({ x: from.current.x + g.dx, y: from.current.y + g.dy })),
      onPanResponderRelease: () => {
        onDrag?.(false);
        reportRef.current(posRef.current);
      },
    }),
  ).current;
  useEffect(() => {
    if (!target) return;
    const on = pick(target.point);
    setPic(on);
    const p = centerOn(target.point, on);
    setPos(p);
    report(p, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.seq]);
  const meAt = me && inside(pic, me) ? toPx(pic, me) : null;
  // Dark mode: the same picture, darkened.
  const darkMap = useStore().appearance === 'dark';
  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#F2EFE9' }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - size.w) < 1 && Math.abs(height - size.h) < 1) return;
        setSize({ w: width, h: height });
        // Keep the same point in the middle after a resize (e.g. the keyboard opening).
        const p = { x: pos.x + (width - size.w) / 2, y: pos.y + (height - size.h) / 2 };
        setPos(p);
      }}
      {...responder.panHandlers}>
      <Image source={pic.source} style={[{ position: 'absolute', left: pos.x, top: pos.y, width: SIZE * scale, height: SIZE * scale }, darkMap ? ({ filter: 'invert(0.92) hue-rotate(180deg) brightness(0.92) saturate(0.6)' } as object) : null]} />
      {meAt ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: pos.x + meAt.x * scale - 23, top: pos.y + meAt.y * scale - 23 }}>
          <MeDot />
        </View>
      ) : null}
    </View>
  );
}
