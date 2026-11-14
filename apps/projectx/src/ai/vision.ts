import type { ChatImage } from './types';
import { host, prepareHost } from '../lib/hostCapabilities';
import { THINGS, thingByKey } from '../models/catalog';

/**
 * The only AI step: reading the cargo photo. Real AI (Claude vision) through the X server or the
 * claude.ai page when available. Otherwise only the sample photos are "read" (known contents); a
 * real photo then gets an honest "pick what's in it" instead of a fake result.
 */
export type SeenItem = { key: string; qty: number; label?: string; x: number; y: number };
export type ScanResult = { items: SeenItem[]; source: 'ai' | 'sample' | 'none' };

const SAMPLE: Record<string, SeenItem[]> = {
  room: [
    { key: 'sofa', qty: 1, x: 0.36, y: 0.64 },
    { key: 'boxes', qty: 7, x: 0.68, y: 0.42 },
    { key: 'table', qty: 1, x: 0.63, y: 0.84 },
  ],
  movers: [{ key: 'boxes', qty: 4, x: 0.76, y: 0.64 }],
};

export const SCAN_PROMPT = `You look at photos of things a customer in Morocco wants transported. List each distinct object to move (ignore walls, floors, people, plants that stay). Count each object once across all photos. For "key" use one of: ${THINGS.map((t) => t.key).join(', ')}; if none fits use "other" and give a short English "label". Give the quantity and where the object's centre is in the FIRST photo it appears in, as x and y between 0 and 1. Reply with JSON only: {"items":[{"key":"sofa","qty":1,"label":"","x":0.5,"y":0.5}]}`;

function clean(raw: unknown): SeenItem[] | null {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return null;
  return items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => {
      const key = typeof i.key === 'string' && thingByKey(i.key) ? i.key : 'other';
      const label = typeof i.label === 'string' && i.label.trim() ? i.label.trim().slice(0, 40) : undefined;
      const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(0.95, Math.max(0.05, v)) : d);
      return { key, qty: Math.max(1, Math.min(99, Math.round(Number(i.qty) || 1))), label: key === 'other' ? label ?? 'Item' : undefined, x: n(i.x, 0.5), y: n(i.y, 0.5) };
    })
    .slice(0, 10);
}

const toBlob = (dataUrl: string) => {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: /data:(.*?);/.exec(head)?.[1] ?? 'image/jpeg' });
};

export async function scanPhotos(images: ChatImage[]): Promise<ScanResult> {
  const real = images.filter((i) => !i.sample);
  if (!real.length) {
    const seen = new Map<string, SeenItem>();
    for (const im of images) for (const it of SAMPLE[im.sample ?? ''] ?? []) if (!seen.has(it.key)) seen.set(it.key, it);
    return { items: [...seen.values()], source: seen.size ? 'sample' : 'none' };
  }
  // 1) X server
  try {
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: images.slice(0, 4).map((i) => i.dataUrl) }), signal: AbortSignal.timeout(45000) });
    if (r.ok && r.headers.get('content-type')?.includes('json')) {
      const items = clean(await r.json());
      if (items) return { items, source: 'ai' };
    }
  } catch {
    // no server — try the page
  }
  // 2) claude.ai page
  await prepareHost();
  if (host.sample) {
    try {
      const items = clean(await host.sample.json(SCAN_PROMPT, { images: images.slice(0, 4).map((i) => toBlob(i.dataUrl)), modelTier: 'default' }));
      if (items) return { items, source: 'ai' };
    } catch {
      // fall through
    }
  }
  return { items: [], source: 'none' };
}
