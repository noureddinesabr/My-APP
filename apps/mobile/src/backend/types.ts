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
  /** Local "YYYY-MM-DDTHH:mm", or null for as soon as possible. */
  scheduledAt: string | null;
  /** The client's offered price in DH. */
  price: number;
  km: number;
  status: RequestStatus;
  jobId: string | null;
  /** Drivers who took this request and then cancelled: it no longer shows to them. */
  cancelledDrivers?: string[];
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
  commission: number;
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
  /** Helpers the client asked for (copied from the request). */
  helpers?: number;
  /** For a booking: when the driver confirmed "I take this trip" (needed before setting off). */
  takenAt?: number | null;
  /** An open price update: who asked last, the price asked and the price agreed before. */
  priceAsk?: PriceAsk | null;
  /** The client's answer to "did the helpers come?". */
  helpersCame?: 'yes' | 'fewer' | null;
  /** Why the trip was cancelled (a reason key, or the person's own words). */
  cancelReason?: string | null;
  /** Received, but with a problem: what the client wrote. */
  problem?: string | null;
};

/** The driver asks for a new price before loading; the client and driver answer in turns. */
export type PriceAsk = { by: 'client' | 'driver'; price: number; agreed: number; driverPrice: number; at: number };

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
  | 'late'
  | 'priceAsked'
  | 'priceCountered'
  | 'priceAgreed'
  | 'priceKept'
  | 'priceExpired'
  | 'helpersFewer'
  | 'handedOver'
  | 'received'
  | 'receivedProblem'
  | 'taken';

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
  /** Sent by the app for the driver (marked "automatic"): the text is this translation key. */
  auto?: string;
  /** A phone number was taken out of this message. */
  phoneHidden?: boolean;
};

export type WalletEntry = { at: number; amount: number; reason: 'testCredit' | 'commission' | 'refund'; jobId?: string };

/** A driver's public profile and wallet. */
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
  wallet: number;
  walletHistory: WalletEntry[];
  photo: string | null;
  email: string;
  stats: DriverStats;
  /** How many times each compliment tag was given by clients. */
  compliments: Record<string, number>;
  joinedAt: number;
  /** When the driver read and agreed to "Our promises to each other". */
  rulesAt?: number | null;
  /** When the driver cancelled a trip (counts for gentle pauses; not price or helper cancels). */
  cancels?: number[];
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

export type Collections = {
  requests: FreightRequest;
  offers: Offer;
  jobs: Job;
  messages: Message;
  drivers: DriverRecord;
  clients: ClientRecord;
};
export type CollectionName = keyof Collections;
