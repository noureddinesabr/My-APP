import type { Booking } from '../models/booking';
import type { Offer } from '../models/marketplace';
import { sampleOffers } from './offers';

/**
 * Marketplace client: asks the X server for offers; without a server (static preview) it uses the
 * same sample generator locally. Offers are always flagged as samples in this prototype.
 */
export async function fetchOffers(b: Booking, page: number): Promise<{ offers: Offer[]; more: boolean }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('/api/offers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ booking: b, page }), signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok && r.headers.get('content-type')?.includes('json')) return (await r.json()) as { offers: Offer[]; more: boolean };
  } catch {
    // fall through to local samples
  }
  return { offers: sampleOffers(b, page), more: page === 0 };
}
