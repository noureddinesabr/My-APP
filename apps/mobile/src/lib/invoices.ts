/**
 * Weekly invoices for the app's share of cash jobs.
 *
 * Clients pay drivers in cash, so the app never holds money and drivers never
 * prepay a wallet. Each completed trip adds the app's share (the rate agreed
 * when the client accepted the offer) to that week's invoice. Weeks run Monday
 * to Sunday; once a week ends, the driver gets an invoice for it, due a few
 * days later. If an invoice is still unpaid well after its due date, new
 * offers pause until it is settled (a payment the driver reported counts as
 * settled until the company says it didn't arrive).
 *
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type InvoiceTerms = {
  /** Days after the end of the week before the invoice is due. */
  dueDays: number;
  /** Days after the due date before new offers pause. */
  graceDays: number;
};

export type InvoiceStatus = 'open' | 'paymentSent' | 'paid';

/** How an invoice stands today, for colours and wording. */
export type InvoiceState = 'paid' | 'paymentSent' | 'due' | 'overdue' | 'paused';

export type BillableJob = {
  id: string;
  price: number;
  /** The app's share for this job, fixed when the offer was accepted. */
  share: number;
  completedAt: number;
};

const DAY = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Monday 00:00 (device time) of the week holding `ms`. */
export function weekStart(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  const sinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - sinceMonday);
  return date.getTime();
}

/** The week's Monday as "YYYY-MM-DD". */
export function weekKey(ms: number) {
  const date = new Date(weekStart(ms));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday 00:00 and the next Monday 00:00 of a week key (the end is exclusive). */
export function weekRange(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 7).getTime();
  return { start, end };
}

/** Sunday of the week, for "Mon 3 – Sun 9" labels. */
export function weekLastDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d + 6).getTime();
}

export function dueDate(key: string, terms: InvoiceTerms) {
  return weekRange(key).end + terms.dueDays * DAY - 1;
}

/** The share for a price at a rate, rounded to whole dirhams. */
export function shareOf(price: number, rate: number) {
  return Math.round(price * rate);
}

export function totals(lines: { price: number; share: number }[]) {
  return lines.reduce((sum, line) => ({ price: sum.price + line.price, share: sum.share + line.share }), { price: 0, share: 0 });
}

/**
 * Jobs not yet on an invoice, grouped by the finished week they were completed in.
 * The current week stays open (it is "this week so far"); pass `includeCurrent`
 * to close it early (test mode).
 */
export function weeksToInvoice(jobs: BillableJob[], now: number, includeCurrent = false) {
  const current = weekKey(now);
  const groups = new Map<string, BillableJob[]>();
  for (const job of jobs) {
    const key = weekKey(job.completedAt);
    if (key === current && !includeCurrent) continue;
    if (key > current) continue;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, list]) => ({ week: key, jobs: [...list].sort((a, b) => a.completedAt - b.completedAt) }));
}

/** Readable, stable invoice number: XA-<week>-<driver tail>[-<n>]. */
export function invoiceNumber(week: string, driverId: string, extra = 0) {
  const tail = driverId.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  return `XA-${week.replace(/-/g, '')}-${tail}${extra ? `-${extra}` : ''}`;
}

export function invoiceState(invoice: { status: InvoiceStatus; dueAt: number }, now: number, terms: InvoiceTerms): InvoiceState {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'paymentSent') return 'paymentSent';
  if (now <= invoice.dueAt) return 'due';
  if (now <= invoice.dueAt + terms.graceDays * DAY) return 'overdue';
  return 'paused';
}

/** New offers pause while any invoice is unpaid past its grace period. */
export function offersPaused(invoices: { status: InvoiceStatus; dueAt: number }[], now: number, terms: InvoiceTerms) {
  return invoices.some((invoice) => invoiceState(invoice, now, terms) === 'paused');
}

/** When offers will pause if this invoice stays unpaid. */
export function pausesAt(invoice: { dueAt: number }, terms: InvoiceTerms) {
  return invoice.dueAt + terms.graceDays * DAY;
}
