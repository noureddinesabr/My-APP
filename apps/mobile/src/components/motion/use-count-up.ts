import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** Animates a number to its new value (a count-up), like a ticker in a motion graphic. */
export function useCountUp(value: number, duration = 450, start?: number) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(start ?? value);
  const from = useRef(start ?? value);
  useEffect(() => {
    if (still) {
      from.current = value;
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - began) / duration);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration, still]);
  return still ? value : shown;
}
