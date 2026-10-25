import type { Filters, Store } from '@/backend/store';

/** The parts of the preview's `db` capability this app uses (see the artifact runtime's db.d.ts). */
type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  onSnapshot(next: (snap: DocSnap) => void, error?: (e: { code: string }) => void): () => void;
};
type Query = {
  where(field: string, op: string, value: unknown): Query;
  onSnapshot(next: (snap: { docs: DocSnap[] }) => void, error?: (e: { code: string }) => void): () => void;
};
type Db = { doc(path: string): DocRef; collection(path: string): Query };
type ClaudeRuntime = { use(name: 'db'): Promise<Db | null> };

/**
 * The preview page's shared database: live across every device that opens the
 * preview link (signed in to claude.ai with edit access). Null when the app runs
 * anywhere else (the phone app, a plain browser tab).
 */
export async function createSharedStore(): Promise<Store | null> {
  const runtime = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!runtime?.use) return null;
  let db: Db | null = null;
  try {
    db = await runtime.use('db');
  } catch {
    db = null;
  }
  if (!db) return null;
  const store: Db = db;

  // One write at a time per document, as the database asks.
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = (path: string, task: () => Promise<void>) => {
    const next = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(task);
    queues.set(path, next);
    return next;
  };
  const withId = (snap: DocSnap) => ({ ...snap.data(), id: snap.id }) as never;

  return {
    kind: 'shared',
    async get(collection, id) {
      const snap = await store.doc(`${collection}/${id}`).get();
      return snap.exists ? withId(snap) : null;
    },
    set(collection, id, data) {
      const path = `${collection}/${id}`;
      return enqueue(path, () => store.doc(path).set(JSON.parse(JSON.stringify(data))));
    },
    update(collection, id, patch) {
      const path = `${collection}/${id}`;
      return enqueue(path, () => store.doc(path).update(JSON.parse(JSON.stringify(patch))));
    },
    watchDoc(collection, id, onChange) {
      return store.doc(`${collection}/${id}`).onSnapshot(
        (snap) => onChange(snap.exists ? withId(snap) : null),
        () => onChange(null),
      );
    },
    watchQuery(collection, filters: Filters, onChange) {
      let query = store.collection(collection);
      for (const [field, value] of filters) query = query.where(field, '==', value);
      return query.onSnapshot((snap) => onChange(snap.docs.map(withId)));
    },
  };
}
