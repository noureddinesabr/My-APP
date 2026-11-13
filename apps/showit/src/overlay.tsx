import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useBack } from './back';

/**
 * Full-screen layers drawn inside the app's own window (not a separate Android dialog), so the
 * keyboard is measured and a typing box can sit right above it. `OverlayHost` sits at the root.
 */
let layers: [string, ReactNode][] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const put = (id: string, node: ReactNode) => {
  const i = layers.findIndex(([k]) => k === id);
  layers = i < 0 ? [...layers, [id, node]] : layers.map((e, j) => (j === i ? [id, node] : e));
  emit();
};
const drop = (id: string) => {
  if (!layers.some(([k]) => k === id)) return;
  layers = layers.filter(([k]) => k !== id);
  emit();
};
let seq = 0;
/** How many layers (sheets, pickers, chats, call screen…) are open now. */
export const openLayers = () => layers.length;

export function OverlayHost() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => layers,
  );
  return (
    <>
      {items.map(([id, node]) => (
        <View key={id} style={StyleSheet.absoluteFill}>
          {node}
        </View>
      ))}
    </>
  );
}

/** Shows `children` as a full-screen layer while `visible`; the phone's back button closes it. */
export function Overlay({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const id = useRef(`layer${++seq}`).current;
  useLayoutEffect(() => {
    if (visible) put(id, children);
    else drop(id);
  });
  useEffect(() => () => drop(id), [id]);
  useBack(visible, onClose);
  return null;
}
