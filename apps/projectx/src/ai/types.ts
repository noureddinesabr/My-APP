import type { Booking, Lang } from '../models/booking';

/**
 * The contract every AI provider implements (server Claude, claude.ai page, demo rules).
 * Swapping providers never changes the app: they all read and return the same booking object.
 */

export type ChatImage = { id: string; dataUrl: string; name?: string; sample?: string };
export type ChatMsg = { id: string; role: 'user' | 'assistant' | 'system'; text: string; images?: ChatImage[]; lang?: Lang; at: number; card?: 'review' | 'booked' | null; source?: AISource };

export type AISource = 'claude-server' | 'claude-page' | 'demo';

export type TripContext = {
  driverName: string;
  vehicle: string;
  price: number;
  status: string;
  statusIndex: number;
  pickupEta: string;
  deliveryEta: string;
  gpsConnected: boolean;
  instructions: string | null;
};

export type AssistantRequest = {
  mode: 'collect' | 'trip';
  messages: ChatMsg[];
  booking: Booking;
  lang: Lang | null;
  trip?: TripContext;
  /** The client's clock (dates like "tomorrow" are resolved against it). */
  now: string;
};

export type AssistantResponse = {
  reply: string;
  lang: Lang;
  booking: Booking;
  quickReplies: string[];
  ready: boolean;
  source: AISource;
  /** Trip mode: an instruction to forward to the driver. */
  driverNote?: string | null;
  /** Trip mode: the customer wants a new booking / support. */
  action?: 'new_booking' | 'support' | null;
};

export interface AIProvider {
  readonly source: AISource;
  respond(req: AssistantRequest): Promise<AssistantResponse>;
}
