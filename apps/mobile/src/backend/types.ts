import type { FreightTypeId } from '@/constants/freight';
import type { Location } from '@/constants/places';
import type { LatLng } from '@/lib/geo';
import type { VehicleId } from '@/lib/pricing';
import type { Eta } from '@/state/driver';
import type { ItemOption, Place, When } from '@/state/request-draft';

export type RequestStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

/** A client's freight request, visible to drivers while open. */
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
  vehicle: VehicleId;
  when: When;
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
};

export const JOB_STEPS = ['toPickup', 'atPickup', 'loading', 'inTransit', 'atDropoff', 'delivered', 'completed'] as const;
export type JobStatus = (typeof JOB_STEPS)[number] | 'cancelled';

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
};

export type Message = {
  id: string;
  jobId: string;
  at: number;
  from: 'client' | 'driver';
  text: string;
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
};

export type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  ratingCount: number;
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
