import type { Booking } from '../../src/models/booking';
import { sampleOffers } from '../../src/marketplace/offers';

/**
 * Marketplace search. Today it returns SAMPLE offers (flagged `sample: true`), so the journey can be
 * tested end to end. Real integration: query online, verified drivers whose vehicle fits the
 * booking, send them the request, and stream their offers back (driver app + database).
 */
export function searchOffers(booking: Booking, page: number) {
  return { source: 'sample' as const, offers: sampleOffers(booking, page), more: page === 0 };
}
