import type { FreightTypeId } from '@/constants/freight';
import type { Location } from '@/constants/places';
import type { LatLng } from '@/lib/geo';
import type { DriverStats } from '@/lib/trip';
import type { VehicleId } from '@/lib/pricing';
import type { Eta } from '@/state/driver';
import type { ItemOption, Place, When } from '@/state/request-draft';

export type RequestStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

/** A client's freight request, visible to drivers while open. */
/** A photo, video or voice note. `url` is a stored file (preview asset, or a file on the phone). */
export type Media = {
  kind: 'photo' | 'video' | 'audio';
  url: string;
  /** Length of a video or voice note. */
  durationMs?: number;
};

export type FreightRequest = {
  id: string;
  createdAt: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  from: Location;
  fromDetails: string;
  to: Location;
  toDetails: string;
  freightType: FreightTypeId;
  /** Every kind the client picked (several allowed); `freightType` is the first. Missing on older requests. */
  freightTypes?: FreightTypeId[];
  tons: number;
  /** False when the client answered "I don't know" (then `tons` is a typical guess). Missing on older requests. */
  weightKnown?: boolean;
  helpers: number;
  pickup: Place;
  dropoff: Place;
  itemOptions: ItemOption[];
  notes: string;
  /** The client's spoken explanation for drivers. Missing on older requests. */
  voiceNote?: Media | null;
  /** Photos and videos of the load. Missing on older requests. */
  media?: Media[];
  vehicle: VehicleId;
  when: When;
  /** For "now" requests: as soon as possible or within the hour. Missing on older requests. */
  pickupWindow?: 'asap' | '1h';
  /** The client rides along with the goods. Missing on older requests. */
  rideAlong?: boolean;
  /** Who travels with the cargo. Missing on older requests. */
  accompaniment?: 'none' | 'me' | 'someone';
  /** The client allows other customers' goods in the vehicle. Missing on older requests. */
  allowSharing?: boolean;
  /** Local "YYYY-MM-DDTHH:mm", or null for as soon as possible. */
  scheduledAt: string | null;
  /** The client's offered price in DH. */
  price: number;
  km: number;
  status: RequestStatus;
  jobId: string | null;
};

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

/** A driver's offer on a request. One per driver per request (id = requestId_driverId). */
export type Offer = {
  id: string;
  requestId: string;
  /** The request's client, so they can follow every offer on their requests. */
  clientId: string;
  createdAt: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicle: VehicleId;
  plate: string;
  rating: number;
  trips: number;
  price: number;
  eta: Eta;
  status: OfferStatus;
  driverPhoto: string | null;
  /** Share of accepted jobs done as promised (0–100). */
  reliability: number;
  /** For scheduled requests: the driver confirmed they will be at the pickup at the requested time. */
  committed: boolean;
};

/** 'loading' is kept for older jobs; new trips go from atPickup straight to inTransit. */
export type JobStatus = 'scheduled' | 'toPickup' | 'atPickup' | 'loading' | 'inTransit' | 'atDropoff' | 'delivered' | 'completed' | 'cancelled';

export type Rating = { stars: number; tags: string[] };

/** An accepted offer becomes a job: the trip itself, followed live by both sides. */
export type Job = {
  id: string;
  requestId: string;
  offerId: string;
  createdAt: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicle: VehicleId;
  plate: string;
  price: number;
  /** The app's share of the price (rate agreed at acceptance). Owed only once the trip is completed, on the weekly invoice. */
  commission: number;
  /** The weekly invoice this completed trip is billed on. */
  invoiceId?: string | null;
  from: Location;
  to: Location;
  km: number;
  status: JobStatus;
  /** When each status was reached (ms). */
  timeline: Partial<Record<JobStatus, number>>;
  driverPos: LatLng | null;
  driverPosAt: number | null;
  /** True when the position comes from the test simulation rather than GPS. */
  simulated: boolean;
  clientRating: Rating | null;
  driverRating: Rating | null;
  cancelledBy: 'client' | 'driver' | null;
  /** Local "YYYY-MM-DDTHH:mm" pickup time for a scheduled booking, else null. */
  scheduledAt: string | null;
  /** Given by the client to the driver at delivery; entering it completes the trip. */
  deliveryCode: string;
  clientPhoto: string | null;
  driverPhoto: string | null;
  /** Reminders already shown, as "role:reminder". */
  remindersSent: string[];
  /** When each side last opened the chat (ms), for unread counts and read receipts. */
  clientReadAt: number;
  driverReadAt: number;
};

/** Trip events written into the chat so both sides see the same story. */
export type ChatEvent =
  | 'booked'
  | 'bookedScheduled'
  | 'started'
  | 'arrivedPickup'
  | 'leftPickup'
  | 'arrivedDropoff'
  | 'delivered'
  | 'completed'
  | 'cancelledByClient'
  | 'cancelledByDriver'
  | 'late';

export type Message = {
  id: string;
  jobId: string;
  at: number;
  from: 'client' | 'driver' | 'system';
  kind: 'text' | 'event' | 'location' | 'photo' | 'video' | 'audio';
  text: string;
  event?: ChatEvent;
  /** Values for the event text, e.g. the pickup time. */
  params?: Record<string, string | number>;
  location?: LatLng;
  /** Photo URL (older messages: a small data URI). */
  photo?: string;
  /** Video or voice note. */
  media?: Media;
};

/** A driver's public profile. (Older records may still carry an unused `wallet`.) */
export type DriverRecord = {
  id: string;
  name: string;
  phone: string;
  vehicle: VehicleId;
  plate: string;
  homeCity: string;
  rating: number;
  ratingCount: number;
  trips: number;
  photo: string | null;
  email: string;
  stats: DriverStats;
  /** How many times each compliment tag was given by clients. */
  compliments: Record<string, number>;
  joinedAt: number;
  /** Prototype verification state set by the admin desk. */
  verification?: 'pending' | 'verified' | 'suspended';
};

export type SavedPlace = { id: string; label: 'home' | 'work' | 'other'; name: string; location: Location };

export type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  ratingCount: number;
  photo: string | null;
  email: string;
  company: string;
  trips: number;
  savedPlaces: SavedPlace[];
  joinedAt: number;
};

/**
 * The operating company: who runs the marketplace and bills drivers. Kept apart from the
 * app's brand ("X App"), set by the company admin. Empty legal fields mean "not set yet",
 * and invoices say so instead of inventing them.
 */
export type CompanySettings = {
  id: 'company';
  legalName: string;
  tradeName: string;
  legalForm: string;
  /** Identifiant Commun de l'Entreprise. */
  ice: string;
  /** Registre de commerce number. */
  rc: string;
  /** Identifiant fiscal. */
  taxId: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  bankName: string;
  /** Account (RIB) drivers transfer the share to. */
  rib: string;
  /** Other ways to pay, in the company's words (cash agent, office…). */
  payInstructions: string;
  /** App share of each completed trip, 0–1. */
  commissionRate: number;
  dueDays: number;
  graceDays: number;
  updatedAt: number;
  /** Every commission change: kept, never rewritten (Doc 3 §1.1). */
  commissionHistory?: { rate: number; from: number; by: string; reason: string }[];
  /** PROTOTYPE shared-load discount policy (awaiting the approved formula). */
  sharingRate?: number;
  sharingCap?: number;
  sharingVersion?: string;
};

export type InvoiceLine = { jobId: string; completedAt: number; from: Location; to: Location; price: number; share: number };

/** A driver's weekly invoice for the app's share of the cash trips completed that week. */
export type Invoice = {
  id: string;
  number: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  /** The week's Monday, "YYYY-MM-DD". */
  week: string;
  issuedAt: number;
  dueAt: number;
  lines: InvoiceLine[];
  totalPrice: number;
  totalShare: number;
  status: 'open' | 'paymentSent' | 'paid';
  /** The driver says they paid: how, and the transfer or receipt reference. */
  paymentSentAt: number | null;
  paymentMethod: 'transfer' | 'cash' | null;
  paymentReference: string;
  /** The company confirmed it received the money. */
  paidAt: number | null;
  /** The company said a reported payment didn't arrive. */
  rejectedAt: number | null;
  /** The company's details when the invoice was issued. */
  company: Omit<CompanySettings, 'id' | 'commissionRate' | 'dueDays' | 'graceDays' | 'updatedAt' | 'commissionHistory' | 'sharingRate' | 'sharingCap' | 'sharingVersion'>;
  /** Issued early with test mode. */
  test: boolean;
  /** Payments the company recorded (amount, method, reference, who). Sum = amount paid. */
  payments?: { amount: number; method: 'transfer' | 'cash' | 'agent'; reference: string; at: number; by: string }[];
  /** An open dispute about this invoice. */
  disputed?: boolean;
};

/* ------------------------------------------------------------------------------------------
 * Phase 2 PROTOTYPE entities: driver routes, route bookings (dedicated and shared), return
 * journeys, disputes, in-app notifications and the admin audit log. They run in the same
 * store as the rest of the preview, carry `prototype: true`, and the screens label them as
 * prototype data. No money moves; nothing here is a real transaction.
 * ------------------------------------------------------------------------------------------ */

export type Capacity = { tons: number; volumeM3: number; seats: number };

/** A route a driver publishes (or a return journey the driver has confirmed). */
export type DriverRoute = {
  id: string;
  createdAt: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverRating: number;
  driverTrips: number;
  verified: boolean;
  vehicle: VehicleId;
  plate: string;
  from: Location;
  to: Location;
  /** Optional intermediate stops, in order. */
  stops: Location[];
  /** Local "YYYY-MM-DDTHH:mm". */
  departAt: string;
  arriveAt: string;
  capacity: Capacity;
  /** Taken by confirmed bookings. */
  reserved: Capacity;
  /** Price for the whole vehicle (dedicated). */
  price: number;
  /** Starting price for one shared slot. */
  sharePrice: number;
  sharing: 'dedicated' | 'shared' | 'both';
  kind: 'outbound' | 'return';
  /** For a return journey: the outbound route it comes back from. */
  outboundId: string | null;
  status: 'draft' | 'published' | 'full' | 'inTransit' | 'completed' | 'withdrawn';
  prototype: true;
};

export type BookingStatus = 'requested' | 'awaitingOriginal' | 'confirmed' | 'inTransit' | 'delivered' | 'completed' | 'cancelled' | 'declined';

/** A customer's booking on a driver route. Each customer has their own booking, price and record. */
export type RouteBooking = {
  id: string;
  ref: string;
  createdAt: number;
  routeId: string;
  driverId: string;
  driverName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  from: Location;
  to: Location;
  cargo: { description: string; tons: number; volumeM3: number; items: number };
  mode: 'dedicated' | 'shared';
  /** The original customer's consent to share the vehicle (saved with the booking terms). */
  allowSharing: boolean;
  role: 'original' | 'joiner';
  /** For a joiner: the original booking it joins. */
  joinOf: string | null;
  accompaniment: 'me' | 'someone' | 'none';
  seats: number;
  /** Adds pickup or drop-off stops outside the original route: the original customer must approve. */
  extraStops: boolean;
  approvals: { driver: boolean | null; original: boolean | null };
  originalPrice: number;
  discount: number;
  price: number;
  /** Rate snapshot taken when the booking is confirmed. */
  commissionRate: number | null;
  discountPolicy: string | null;
  status: BookingStatus;
  payment: 'notDue' | 'cashPending' | 'cashConfirmed' | 'disputed';
  timeline: Partial<Record<BookingStatus, number>>;
  prototype: true;
};

export type Dispute = {
  id: string;
  createdAt: number;
  ref: string;
  raisedBy: 'customer' | 'driver' | 'admin';
  raisedByName: string;
  kind: 'cash' | 'damage' | 'late' | 'invoice' | 'other';
  text: string;
  status: 'open' | 'investigating' | 'resolved';
  resolution: string;
  prototype: true;
};

/** Who did what to which record, before and after, and why (Doc 3 §10). */
export type AuditEntry = {
  id: string;
  at: number;
  actor: string;
  actorRole: 'superAdmin' | 'financeAdmin' | 'operationsAdmin' | 'system' | 'driver' | 'customer';
  action: string;
  entity: string;
  entityId: string;
  before: string;
  after: string;
  reason: string;
  prototype: true;
};

/** An in-app notification (the list behind the bell). Text is a translation key + values. */
export type AppNotification = {
  id: string;
  at: number;
  userId: string;
  key: string;
  params: Record<string, string | number>;
  link: string | null;
  read: boolean;
  prototype: true;
};

export type Collections = {
  requests: FreightRequest;
  offers: Offer;
  jobs: Job;
  messages: Message;
  drivers: DriverRecord;
  clients: ClientRecord;
  invoices: Invoice;
  settings: CompanySettings;
  routes: DriverRoute;
  bookings: RouteBooking;
  disputes: Dispute;
  audit: AuditEntry;
  notifications: AppNotification;
};
export type CollectionName = keyof Collections;
