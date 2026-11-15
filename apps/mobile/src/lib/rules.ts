/**
 * The rules between customers and drivers, from Xapp Simple (docs/BUSINESS.md there):
 * gentle pauses after cancels, phone numbers kept out of the chat, chats that close 48 hours
 * after the trip, when a price update may be asked, and the "committed driver" badge.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Gentle and fair: the 1st driver cancel in 7 days changes nothing, the 2nd gives new loads a
 * 15-minute rest, the 3rd and more a 1-hour rest (and maybe a friendly call). Booked trips go
 * on. Customer cancels, helpers who didn't come and price no-deals never count.
 */
export function pauseState(cancels: readonly number[] | undefined, now: number) {
  const week = (cancels ?? []).filter((at) => now - at < 7 * DAY).sort((a, b) => a - b);
  const count = week.length;
  if (count < 2) return { count, pausedUntil: null as number | null, minutes: 0, call: false };
  const last = week[week.length - 1];
  const rest = count === 2 ? 15 * MINUTE : HOUR;
  const until = last + rest;
  return { count, pausedUntil: until > now ? until : null, minutes: Math.max(0, Math.ceil((until - now) / MINUTE)), call: count >= 3 };
}

/** What the next cancel would mean for the driver: 1 = nothing, 2 = 15 min rest, 3 = 1 h rest. */
export function nextCancelLevel(cancels: readonly number[] | undefined, now: number): 1 | 2 | 3 {
  const count = (cancels ?? []).filter((at) => now - at < 7 * DAY).length + 1;
  return count <= 1 ? 1 : count === 2 ? 2 : 3;
}

/** Reasons that never count against anyone. */
export const FREE_REASONS = ['cr_priceNoDeal', 'dr_priceNoDeal', 'cr_helpers'];

/**
 * Phone numbers typed in the chat are hidden, so deals stay in the app (calls go through the
 * call button). Eight or more digits, with spaces, dots, dashes or a leading + in between.
 */
export function hidePhones(text: string) {
  let hidden = false;
  const out = text.replace(/\+?\d[\d\s.\-()]{6,}\d/g, (match) => {
    if (match.replace(/\D/g, '').length < 8) return match;
    hidden = true;
    return '• • •';
  });
  return { text: out, hidden };
}

/** A chat stays open during the trip and for 48 hours after it is done; a cancelled trip's chat is read-only. */
export function chatOpen(status: string, doneAt: number | undefined, now: number) {
  if (status === 'cancelled') return false;
  if (status !== 'completed') return true;
  return doneAt !== undefined && now - doneAt < 48 * HOUR;
}

/**
 * The driver may ask for a new price after taking the trip and before loading. A booking
 * counts as taken once he confirmed "I take this trip".
 */
export function canAskPrice(status: string, scheduled: boolean, takenAt: number | null | undefined) {
  if (status === 'scheduled') return scheduled && !!takenAt;
  return status === 'toPickup' || status === 'atPickup';
}

/** "Committed driver": at least 3 trips done and no cancels. */
export function committedDriver(trips: number, cancelled: number) {
  return trips >= 3 && cancelled === 0;
}
