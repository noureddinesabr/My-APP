/**
 * Pickup scheduling: which days and time slots a client can pick.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 * Times are local and stored as "YYYY-MM-DDTHH:mm".
 */

export const FIRST_SLOT_HOUR = 7;
export const LAST_SLOT_HOUR = 21;
export const SLOT_MINUTES = 30;
/** Drivers need at least this much notice for a scheduled pickup. */
export const MIN_NOTICE_MINUTES = 60;
export const BOOKABLE_DAYS = 14;

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalString(value: string) {
  const [day, time = '00:00'] = value.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function dayKey(date: Date) {
  return toLocalString(date).slice(0, 10);
}

/** The bookable days, starting today. */
export function bookableDays(now: Date, count = BOOKABLE_DAYS) {
  return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
}

/** All slots of a day, each flagged available or not (too soon). */
export function slotsForDay(day: Date, now: Date) {
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60_000;
  const slots: { value: string; hour: number; minute: number; available: boolean }[] = [];
  for (let minutes = FIRST_SLOT_HOUR * 60; minutes <= LAST_SLOT_HOUR * 60; minutes += SLOT_MINUTES) {
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
    slots.push({
      value: toLocalString(slot),
      hour: slot.getHours(),
      minute: slot.getMinutes(),
      available: slot.getTime() >= earliest,
    });
  }
  return slots;
}

/** Smart default: the next available slot today, otherwise tomorrow at 09:00. */
export function defaultSchedule(now: Date) {
  const today = slotsForDay(now, now).find((slot) => slot.available);
  if (today) return today.value;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  return toLocalString(tomorrow);
}

/** A saved time that is now too soon (e.g. a draft reopened later) moves to the default. */
export function ensureBookable(value: string | undefined, now: Date) {
  if (!value) return defaultSchedule(now);
  const time = fromLocalString(value);
  if (Number.isNaN(time.getTime())) return defaultSchedule(now);
  return time.getTime() >= now.getTime() + MIN_NOTICE_MINUTES * 60_000 ? value : defaultSchedule(now);
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export function periodOf(hour: number): DayPeriod {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
