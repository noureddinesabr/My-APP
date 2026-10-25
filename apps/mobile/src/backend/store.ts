import type { CollectionName, Collections } from '@/backend/types';

export type Unsubscribe = () => void;
/** Equality filters: [field, value]. */
export type Filters = [string, unknown][];

/**
 * Minimal document store the app's data layer is written against.
 * Implementations: the preview's shared database (live across devices) and a
 * local one (this device, live across browser tabs). A hosted backend such as
 * Supabase can implement the same interface later.
 */
export type Store = {
  /** 'shared' reaches other devices; 'local' stays on this device. */
  kind: 'shared' | 'local';
  get<C extends CollectionName>(collection: C, id: string): Promise<Collections[C] | null>;
  set<C extends CollectionName>(collection: C, id: string, data: Collections[C]): Promise<void>;
  update<C extends CollectionName>(collection: C, id: string, patch: Partial<Collections[C]>): Promise<void>;
  watchDoc<C extends CollectionName>(collection: C, id: string, onChange: (doc: Collections[C] | null) => void): Unsubscribe;
  watchQuery<C extends CollectionName>(collection: C, filters: Filters, onChange: (docs: Collections[C][]) => void): Unsubscribe;
};

export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function matches(doc: Record<string, unknown>, filters: Filters) {
  return filters.every(([field, value]) => doc[field] === value);
}
