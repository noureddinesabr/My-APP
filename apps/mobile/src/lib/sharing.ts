/**
 * Shared transportation and return-journey rules (Doc 3 §4–5), as pure functions.
 *
 * Capacity is weight + volume + passenger seats, never one number (Doc 4 §4). The
 * original customer's discount follows an administrator-set policy and is applied only once
 * a second booking is CONFIRMED. The policy below is a PROTOTYPE placeholder until the
 * business approves the real formula (Phase 1 decision 8).
 *
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type Capacity = { tons: number; volumeM3: number; seats: number };

export const EMPTY_CAPACITY: Capacity = { tons: 0, volumeM3: 0, seats: 0 };

export function remaining(total: Capacity, reserved: Capacity): Capacity {
  return {
    tons: round(total.tons - reserved.tons),
    volumeM3: round(total.volumeM3 - reserved.volumeM3),
    seats: total.seats - reserved.seats,
  };
}

export function add(a: Capacity, b: Capacity): Capacity {
  return { tons: round(a.tons + b.tons), volumeM3: round(a.volumeM3 + b.volumeM3), seats: a.seats + b.seats };
}

/** Which dimensions a request would overflow (empty = it fits). Passengers are checked apart from cargo. */
export function overflow(total: Capacity, reserved: Capacity, want: Capacity): ('tons' | 'volumeM3' | 'seats')[] {
  const left = remaining(total, reserved);
  const out: ('tons' | 'volumeM3' | 'seats')[] = [];
  if (want.tons > left.tons + 1e-9) out.push('tons');
  if (want.volumeM3 > left.volumeM3 + 1e-9) out.push('volumeM3');
  if (want.seats > left.seats) out.push('seats');
  return out;
}

export type SharingPolicy = {
  /** Share of the joining customer's price given back to the original customer (0–1). */
  rate: number;
  /** The discount never exceeds this share of the original price (0–1). */
  capOfOriginal: number;
  /** Version recorded on every adjustment, so an old discount can be explained later. */
  version: string;
};

/** PROTOTYPE default — to be replaced by the approved policy. */
export const DEFAULT_SHARING_POLICY: SharingPolicy = { rate: 0.25, capOfOriginal: 0.2, version: 'proto-1' };

/**
 * The original customer's discount once a second booking is confirmed: a share of the joining
 * price, capped by a share of the original price, and never so large that the driver earns less
 * than the original price on the trip (minimum viable driver revenue).
 */
export function sharedDiscount(originalPrice: number, joinerPrice: number, policy: SharingPolicy = DEFAULT_SHARING_POLICY) {
  if (originalPrice <= 0 || joinerPrice <= 0) return 0;
  const byRate = joinerPrice * policy.rate;
  const byCap = originalPrice * policy.capOfOriginal;
  // Driver keeps at least the original price in total: original − discount + joiner ≥ original.
  const byDriver = joinerPrice;
  return Math.max(0, Math.floor(Math.min(byRate, byCap, byDriver)));
}

/** Prices after a confirmed join, kept per customer (each has its own booking). */
export function sharedSettlement(originalPrice: number, joinerPrice: number, commissionRate: number, policy: SharingPolicy = DEFAULT_SHARING_POLICY) {
  const discount = sharedDiscount(originalPrice, joinerPrice, policy);
  const revisedOriginal = originalPrice - discount;
  const commissionOriginal = Math.round(revisedOriginal * commissionRate);
  const commissionJoiner = Math.round(joinerPrice * commissionRate);
  const driverGross = revisedOriginal + joinerPrice;
  return {
    discount,
    revisedOriginal,
    joinerPrice,
    driverGross,
    commission: commissionOriginal + commissionJoiner,
    commissionOriginal,
    commissionJoiner,
    driverKeeps: driverGross - commissionOriginal - commissionJoiner,
  };
}

/** A suggested return price: the outbound price times the driver's chosen share (default 70%), rounded to 10. */
export function suggestedReturnPrice(outboundPrice: number, share = 0.7) {
  return Math.max(10, Math.round((outboundPrice * share) / 10) * 10);
}

/** Booking reference: XB-<yymmdd>-<4 chars of the id>, readable on the phone and in disputes. */
export function bookingRef(id: string, at: number) {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tail = id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `XB-${String(date.getFullYear()).slice(2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${tail}`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
