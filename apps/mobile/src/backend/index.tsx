import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { createLocalStore } from '@/backend/local-store';
import { createSharedStore } from '@/backend/shared-store';
import type { Filters, Store } from '@/backend/store';
import type { CollectionName, Collections } from '@/backend/types';

const StoreContext = createContext<Store | null>(null);

/** Picks the shared preview database when available, otherwise the on-device store. */
export function BackendProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shared = await createSharedStore().catch(() => null);
      const chosen = shared ?? (await createLocalStore());
      if (!cancelled) setStore(chosen);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!store) return null;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside BackendProvider');
  return store;
}

/** Live document; `undefined` while loading, `null` when missing. */
export function useDoc<C extends CollectionName>(collection: C, id: string | null | undefined) {
  const store = useStore();
  const key = id ? `${collection}/${id}` : null;
  // Results are tagged with the key they belong to, so a new id reads as loading until it arrives.
  const [state, setState] = useState<{ key: string; doc: Collections[C] | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    const tag = `${collection}/${id}`;
    return store.watchDoc(collection, id, (doc) => setState({ key: tag, doc }));
  }, [store, collection, id]);
  if (!key) return null;
  return state?.key === key ? state.doc : undefined;
}

/** Live query with equality filters; `undefined` while loading. Pass `null` filters to skip. */
export function useQuery<C extends CollectionName>(collection: C, filters: Filters | null) {
  const store = useStore();
  const key = filters ? `${collection}:${JSON.stringify(filters)}` : null;
  const [state, setState] = useState<{ key: string; docs: Collections[C][] } | null>(null);
  useEffect(() => {
    if (key === null) return;
    const parsed = JSON.parse(key.slice(collection.length + 1)) as Filters;
    return store.watchQuery(collection, parsed, (docs) => setState({ key, docs }));
  }, [store, collection, key]);
  if (key === null) return EMPTY as Collections[C][];
  return state?.key === key ? state.docs : undefined;
}

const EMPTY: never[] = [];
