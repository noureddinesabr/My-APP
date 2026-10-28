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
  tons: number;
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
