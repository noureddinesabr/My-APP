import { useCallback, useEffect, useState } from 'react';

import type { LatLng } from '@/lib/geo';
import { currentPosition } from '@/lib/location';

/**
 * The phone's position for the home map: asks once on open, and `retry` asks again
 * (the "Tap to turn on location" banner). `status` is 'unavailable' when permission is
 * refused or the page can't use GPS (the claude.ai preview).
 */
export function useMyLocation() {
  const [state, setState] = useState<{ status: 'locating' | 'ok' | 'unavailable'; point: LatLng | null }>({
    status: 'locating',
    point: null,
  });

  const locate = useCallback(async () => {
    const point = await currentPosition();
    setState(point ? { status: 'ok', point } : { status: 'unavailable', point: null });
  }, []);

  useEffect(() => {
    let cancelled = false;
    currentPosition().then((point) => {
      if (!cancelled) setState(point ? { status: 'ok', point } : { status: 'unavailable', point: null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: 'locating' }));
    locate();
  }, [locate]);

  return { ...state, retry };
}
