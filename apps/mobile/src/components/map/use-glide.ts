import { useEffect, useRef, useState } from 'react';

import type { LatLng } from '@/lib/geo';

/**
 * Follows `target`, but slides there over `ms` instead of jumping, so a marker visibly walks
 * to a new place (the person when the pickup is moved, by GPS or by hand).
 */
export function useGlide(target: LatLng | null | undefined, ms = 800) {
  const [point, setPoint] = useState<LatLng | null>(target ?? null);
  const current = useRef(point);
  useEffect(() => {
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      // Gone, or the first place: no walk, just there.
      if (!target || !from) {
        current.current = target ?? null;
        setPoint(target ?? null);
        return;
      }
      const k = Math.min(1, (Date.now() - start) / ms);
      const ease = 1 - (1 - k) ** 3;
      const next = { lat: from.lat + (target.lat - from.lat) * ease, lng: from.lng + (target.lng - from.lng) * ease };
      current.current = next;
      setPoint(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.lat, target?.lng, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return point;
}
