import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { matches, type Filters, type Store } from '@/backend/store';
import type { CollectionName } from '@/backend/types';

const STORAGE_KEY = 'xapp.localdb';
type Docs = Record<string, Record<string, Record<string, unknown>>>;

/**
 * Store kept on this device. On the web, other open tabs of the app see changes
 * live (BroadcastChannel), so a client tab and a driver tab can talk to each other.
 */
export async function createLocalStore(): Promise<Store> {
  let data: Docs = {};
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) data = JSON.parse(saved);
  } catch {
    data = {};
  }

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const channel =
    Platform.OS === 'web' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xapp-localdb') : null;

  channel?.addEventListener('message', (event: MessageEvent) => {
    const { collection, id, doc } = event.data as { collection: string; id: string; doc: Record<string, unknown> };
    data[collection] = { ...data[collection], [id]: doc };
    notify();
  });

  let saving = Promise.resolve();
  const write = (collection: string, id: string, doc: Record<string, unknown>) => {
    data = { ...data, [collection]: { ...data[collection], [id]: doc } };
    const snapshot = JSON.stringify(data);
    saving = saving.then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot)).catch(() => {});
    channel?.postMessage({ collection, id, doc });
    notify();
  };

  const read = (collection: string, id: string) => (data[collection]?.[id] as never) ?? null;
  const query = (collection: CollectionName, filters: Filters) =>
    Object.values(data[collection] ?? {}).filter((doc) => matches(doc, filters)) as never[];

  return {
    kind: 'local',
    async get(collection, id) {
      return read(collection, id);
    },
    async set(collection, id, doc) {
      write(collection, id, doc as Record<string, unknown>);
    },
    async update(collection, id, patch) {
      const current = data[collection]?.[id];
      if (!current) throw new Error(`${collection}/${id} does not exist`);
      write(collection, id, { ...current, ...(patch as Record<string, unknown>) });
    },
    watchDoc(collection, id, onChange) {
      let last: unknown;
      const run = () => {
        const doc = read(collection, id);
        if (doc !== last) {
          last = doc;
          onChange(doc);
        }
      };
      listeners.add(run);
      queueMicrotask(run);
      return () => {
        listeners.delete(run);
      };
    },
    watchQuery(collection, filters, onChange) {
      let last = '';
      const run = () => {
        const docs = query(collection, filters);
        const key = JSON.stringify(docs);
        if (key !== last) {
          last = key;
          onChange(docs);
        }
      };
      listeners.add(run);
      queueMicrotask(run);
      return () => {
        listeners.delete(run);
      };
    },
  };
}
