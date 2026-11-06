import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

/** Browser preview: the visual viewport tells how much the on-screen keyboard covers. */
export function KeyboardShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/** The browser scrolls a focused box into view by itself. */
export function KeyboardScroll({ bottomOffset: _b, extraKeyboardSpace: _e, ...props }: ScrollViewProps & { bottomOffset?: number; extraKeyboardSpace?: number }) {
  return <ScrollView {...props} />;
}
