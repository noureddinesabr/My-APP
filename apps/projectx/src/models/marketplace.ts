import type { Booking, VehicleType } from './booking';

/**
 * Marketplace data model. The prototype fills these with clearly-labelled sample data; the shapes
 * are what the real backend and the future admin dashboard will store.
 */

export type ID = string;

export type Customer = { id: ID; name: string; phone: string; language: 'darija' | 'ar' | 'fr' | 'en'; business: boolean; companyName?: string; recurring?: boolean; createdAt: string };

export type DocumentStatus = 'missing' | 'pending' | 'approved' | 'rejected';
export type Driver = {
  id: ID;
  name: string;
  initials: string;
  hue: number;
  rating: number;
  trips: number;
  yearsActive: number;
  languages: string[];
  homeCity: string;
  phoneMasked: string;
  verification: { identity: DocumentStatus; license: DocumentStatus; insurance: DocumentStatus };
  availability: 'online' | 'busy' | 'offline';
  /** Last known position. Only real when `gps.live` is true (a connected device). */
  gps: { lat: number; lng: number; live: boolean; updatedAt: string | null };
};

export type Vehicle = { id: ID; driverId: ID; type: VehicleType; model: string; plateMasked: string; capacityKg: number; volumeM3: number; photos: string[]; refrigerated: boolean; insuranceExpires: string };

export type OfferKind = 'solo' | 'shared' | 'return_trip';
export type Offer = {
  id: ID;
  requestId: ID;
  driver: Driver;
  vehicle: Vehicle;
  kind: OfferKind;
  price: number;
  currency: 'MAD';
  /** Minutes from now until pickup (immediate jobs) or the agreed pickup slot (scheduled jobs). */
  pickupInMin: number;
  pickupAt: string;
  deliveryAt: string;
  loadingHelp: boolean;
  helpers: number;
  sharedWith: number;
  returnTo: string | null;
  note: string;
  sample: true;
  createdAt: string;
};

export type TripStatus = 'accepted' | 'preparing' | 'to_pickup' | 'at_pickup' | 'loaded' | 'in_transit' | 'delivered' | 'completed';
export const TRIP_STATUSES: TripStatus[] = ['accepted', 'preparing', 'to_pickup', 'at_pickup', 'loaded', 'in_transit', 'delivered', 'completed'];

export type TransportRequest = {
  id: ID;
  customerId: ID;
  booking: Booking;
  status: 'draft' | 'searching' | 'offers' | 'booked' | 'cancelled' | 'expired';
  mode: 'immediate' | 'scheduled';
  /** For recurring business customers: e.g. every Monday 08:00. */
  recurrence: string | null;
  createdAt: string;
};

export type BookingRecord = {
  id: ID;
  requestId: ID;
  offerId: ID;
  driverId: ID;
  price: number;
  commissionPct: number;
  status: TripStatus;
  history: { status: TripStatus; at: string; source: 'driver_app' | 'gps' | 'simulation' | 'admin' }[];
  /** Shared runs and multi-pickup routes: ordered stops of every customer on the same vehicle. */
  route: { requestId: ID; kind: 'pickup' | 'dropoff'; lat: number; lng: number }[];
};

export type Payment = { id: ID; bookingId: ID; amount: number; method: 'cash' | 'card' | 'wallet'; status: 'pending' | 'paid' | 'refunded'; commission: number; driverPayout: number };
export type Invoice = { id: ID; driverId: ID; period: string; bookings: ID[]; total: number; commission: number; status: 'draft' | 'issued' | 'paid' };
export type Dispute = { id: ID; bookingId: ID; openedBy: 'customer' | 'driver'; reason: string; status: 'open' | 'resolved'; messages: { from: string; text: string; at: string }[] };
export type SupportTicket = { id: ID; bookingId: ID | null; customerId: ID; subject: string; status: 'open' | 'answered' | 'closed'; createdAt: string };
