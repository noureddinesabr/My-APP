// The Xapp Simple look in the Stitch design: mint, forest green and sage, the same for customers and drivers.

export type Palette = {
  bg: string;
  surface: string;
  raised: string;
  line: string;
  fg: string;
  muted: string;
  accent: string;
  /** The deeper end of the main buttons' soft gradient (simple design). */
  accent2: string;
  onAccent: string;
  live: string;
  liveSoft: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  ink: string;
  onInk: string;
  danger: string;
  /** Mint cards (the main content boxes). */
  card: string;
  /** Small orange touches: badges, the logo, things to check. */
  orange: string;
  /** Titles and prices (deep teal; light mint on dark). */
  title: string;
  // ---- Inverse surface: the dark boxes inside a page (price, active trip, delivered, duty card). ----
  /** Deep teal of the call screen, the distance pill and the driver's load header (a darker inverse surface). */
  inverseDeep: string;
  /** Inverse surface (Material: inverse-surface). */
  inverse: string;
  /** A second, softer inverse shade (camera frame, photo placeholders). */
  inverse2: string;
  /** Text and icons on the inverse surface, on photos and on filled colour (Material: inverse-on-surface). */
  onInverse: string;
  /** Quieter text on the inverse surface. */
  onInverseMuted: string;
  /** The small tags on the inverse surface. */
  inverseLabel: string;
  /** Highlights on the inverse surface (live dot, ETA, price). */
  inverseAccent: string;
  // ---- Overlays ----
  /** The veil over the map behind a page. */
  veil: string;
  /** Shadow colour; shades behind sheets and menus are fade(shadow, strength) (Material: shadow / scrim). */
  shadow: string;
  /** Filled danger (end a call, recording). */
  dangerFill: string;
  /** WhatsApp's own green (brand colour of a third party). */
  whatsapp: string;
  // ---- Maps ----
  /** The map's background before tiles load. */
  mapBg: string;
};

// The Stitch design (owner's redesign, 16 Nov 2026), the same for both sides: pale mint pages, white
// and sage cards, deep forest-green titles and pill buttons, sage-green "[ LABEL ]" tags.
export const customer: Palette = {
  bg: '#F3FCF5',
  surface: '#FFFFFF',
  raised: '#EDF6F0',
  card: '#E7F0EA',
  line: '#DCE5DF',
  fg: '#151D1A',
  muted: '#5A6460',
  accent: '#021E1A',
  accent2: '#18332F',
  onAccent: '#FFFFFF',
  live: '#3F665D',
  liveSoft: '#BEE8DE',
  ok: '#2C6E57',
  okSoft: '#C1EBE0',
  warn: '#A4520F',
  warnSoft: '#FCEBDD',
  ink: '#021E1A',
  onInk: '#FFFFFF',
  danger: '#BA1A1A',
  orange: '#C98A1B',
  title: '#021E1A',
  inverseDeep: '#163F3A',
  inverse: '#021E1A',
  inverse2: '#18332F',
  onInverse: '#FFFFFF',
  onInverseMuted: '#C1EBE0',
  inverseLabel: '#A6F2CF',
  inverseAccent: '#4EDEA3',
  veil: 'rgba(255,255,255,0.72)',
  shadow: '#000000',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#EEF4F2',
};

// Dark: a green-black night with emerald buttons (Stitch dark screens).
export const driver: Palette = {
  bg: '#0A1613',
  surface: '#121E1B',
  raised: '#16221F',
  card: '#1C2926',
  line: '#2B3734',
  fg: '#D8E6E0',
  muted: '#9AA9A2',
  accent: '#4EDEA3',
  accent2: '#10B981',
  onAccent: '#00291C',
  live: '#4EDEA3',
  liveSoft: '#123A2D',
  ok: '#4EDEA3',
  okSoft: '#123A2D',
  warn: '#FFB86B',
  warnSoft: '#3A2716',
  ink: '#D8E6E0',
  onInk: '#0A1613',
  danger: '#FFB4AB',
  orange: '#F2C14E',
  title: '#A6F2CF',
  inverseDeep: '#163F3A',
  inverse: '#021E1A',
  inverse2: '#18332F',
  onInverse: '#FFFFFF',
  onInverseMuted: '#C1EBE0',
  inverseLabel: '#A6F2CF',
  inverseAccent: '#4EDEA3',
  veil: 'rgba(15,25,24,0.82)',
  shadow: '#000000',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#EEF4F2',
};

/** Customers in dark mode: the same deep teal night as drivers. */
export const customerDark: Palette = { ...driver };

/** Drivers in light mode: the same white and mint as customers. */
export const driverLight: Palette = { ...customer };

export type Appearance = 'light' | 'dark';

/** Light until the person picks dark in Settings (both sides). */
export const appearanceFor = (_role: 'customer' | 'driver', chosen?: Appearance): Appearance => chosen ?? 'light';

export function paletteFor(role: 'customer' | 'driver', chosen?: Appearance): Palette {
  const dark = appearanceFor(role, chosen) === 'dark';
  if (role === 'driver') return dark ? driver : driverLight;
  return dark ? customerDark : customer;
}

export const Font = {
  regular: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  /** Titles and prices: Outfit (Stitch headlines). */
  heavy: 'Outfit_600SemiBold',
  display: 'Outfit_600SemiBold',
  /** The small "[ LABEL ]" tags and technical numbers: Space Grotesk. */
  label: 'SpaceGrotesk_600SemiBold',
  arabic: 'Tajawal_500Medium',
  arabicBold: 'Tajawal_700Bold',
};

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Stitch's dark boxes inside a light page (the price, the trip's ETA): forest green, light text, emerald. */
export const stitchDark: Palette = { ...driver, surface: '#021E1A', card: '#021E1A', raised: '#18332F', line: '#18332F', bg: '#021E1A' };

// ---- Fixed colours that don't change with light / dark (still kept here, never in screens) ----

/** Map pins and the route (the same in both themes, so the map reads the same). */
export const PIN_COLORS = { pickup: '#1E5B53', dropoff: '#F07A3A', me: '#2F8A7A', route: '#1E5B53', halo: '#0F766E', label: '#FFFFFF', labelText: '#163F3A', shadow: '#000000' } as const;

/** Drawings (the little vehicles, the furniture on the camera): their own fixed colours. */
export const ART = {
  body: '#1E5B53',
  cab: '#272833',
  glass: '#BFE3F2',
  glass2: '#9CC9DC',
  ink: '#163F3A',
  light: '#FCD34D',
  bumper: '#9A9894',
  rear: '#B91C1C',
  crate: '#E8D2B0',
  crateEdge: '#C9AE86',
  wheel: '#D9D6CF',
  wheelSpoke: '#6B6A66',
  white: '#FFFFFF',
  shadow: '#000000',
  fridge: '#E9E7E1',
  fridgeLine: '#B9B6AE',
  box: '#D9A274',
  box2: '#C98A5B',
} as const;

/** Avatar backgrounds for people's initials (picked from the name). */
export const PERSON_COLORS = ['#1E5B53', '#0E7490', '#7C3AED', '#15803D', '#B45309', '#BE185D', '#1E5B53'] as const;

/** One colour per trip stage (My requests / My trips). */
export const STAGE_COLORS = { accepted: '#1E5B53', enroute: '#0E7490', arrived: '#0E7490', loaded: '#15803D', dropoff: '#15803D', delivered: '#475569', cancelled: '#B91C1C' } as const;

/** Signal colours with one fixed job each, the same in both themes. */
export const SIGNAL = {
  /** Rating stars. */
  star: '#F07A3A',
  /** The count badge on the driver's open loads. */
  countBadge: '#F07A3A',
  /** Accent of the driver's load cards and online switch. */
  loadAccent: '#1E5B53',
  /** "Committed" badge: icon, its soft background, its text. */
  committed: '#15803D',
  committedSoft: '#DCFCE7',
  onCommitted: '#14532D',
  /** The voice button while recording, and its text. */
  recording: '#7C2D12',
  onRecording: '#FDEEE4',
  /** The "call support by phone" circle in Help. */
  supportPhone: '#334155',
  /** The usual-price band on the price slider. */
  pricePulse: '#86EFAC',
  /** The ring and fill around the driver's vehicle photo. */
  vehicleRing: '#2563EB',
  vehicleRingSoft: '#DBEAFE',
  /** Dark text on bright tiles. */
  onBright: '#1C1917',
  /** Call screen: the "not available" notice (fade(callNotice, 0.18) behind callNoticeText) and the phone button. */
  callNotice: '#D97706',
  callNoticeText: '#FBBF24',
  callPhone: '#16A34A',
  /** Confetti pieces when a load is delivered. */
  confetti: ['#1E5B53', '#0F766E', '#F07A3A', '#1E5B53'],
} as const;

/** The driver's Earnings page: its own forest-green and sage design, the same in both themes. */
export const EARN_COLORS = { orange: '#021E1A', orange2: '#18332F', green: '#2C6E57', greenSoft: '#C1EBE0', blue: '#3F665D', blueSoft: '#E7F0EA', amberSoft: '#EDF6F0', pickup: '#021E1A', drop: '#3F665D' } as const;

/** A colour at a given strength (shades, glass, halos): fade(c.shadow, 0.25) gives rgba(0,0,0,0.25). */
export function fade(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
