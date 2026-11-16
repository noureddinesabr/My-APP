// Xapp Freight: the owner's second Stitch design (freight & moving), light by default.

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
  /** Titles and prices. */
  title: string;
  /** The sky-blue card for arrival times and its text (the design's ETA card). */
  sky: string;
  onSky: string;
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

// Xapp Freight (owner's second Stitch export, 17 Nov 2026: stitch_xapp_freight_and_moving_app.zip).
// Light by default (owner): a warm stone page, white glass cards, deep moss-green cards for the one
// thing that matters, bright lime pill buttons with dark text, an amber accent and a sky-blue card for
// arrival times. Dark ("Atlas Freight Glass"): a forest-black night with the same lime.
export const customer: Palette = {
  bg: '#F4F6F1',
  surface: '#FFFFFF',
  raised: '#ECF0E8',
  card: '#F0F4EF',
  line: '#E2E8DF',
  fg: '#132115',
  muted: '#556557',
  accent: '#B7F347',
  accent2: '#A5E232',
  onAccent: '#0E1A11',
  live: '#3B6E1E',
  liveSoft: '#E3F5CF',
  ok: '#2F7D32',
  okSoft: '#DDF3D6',
  warn: '#9A5B00',
  warnSoft: '#FFF0D2',
  ink: '#0E1A11',
  onInk: '#FFFFFF',
  danger: '#BA1A1A',
  orange: '#FFBE53',
  title: '#132115',
  sky: '#DBEEFC',
  onSky: '#0C4A6E',
  inverseDeep: '#162519',
  inverse: '#0E1A11',
  inverse2: '#1E3122',
  onInverse: '#FFFFFF',
  onInverseMuted: '#B9C7B7',
  inverseLabel: '#B7F347',
  inverseAccent: '#B7F347',
  veil: 'rgba(244,246,241,0.72)',
  shadow: '#0E1A11',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#E9EFE6',
};

// Dark ("Atlas Freight Glass"): forest-black pages, deep green glass cards, lime.
export const driver: Palette = {
  bg: '#08160A',
  surface: '#142316',
  raised: '#1E2E20',
  card: '#101F12',
  line: '#29392A',
  fg: '#D5E8D3',
  muted: '#A3B3A0',
  accent: '#B7F347',
  accent2: '#A3E635',
  onAccent: '#121F00',
  live: '#A3E635',
  liveSoft: '#1F3512',
  ok: '#8DE383',
  okSoft: '#173A1C',
  warn: '#FFB95F',
  warnSoft: '#3A2A12',
  ink: '#D5E8D3',
  onInk: '#08160A',
  danger: '#FFB4AB',
  orange: '#FFBE53',
  title: '#ECF7EA',
  sky: '#163247',
  onSky: '#BFE3FA',
  inverseDeep: '#0B1A0D',
  inverse: '#041106',
  inverse2: '#16261A',
  onInverse: '#FFFFFF',
  onInverseMuted: '#B9C7B7',
  inverseLabel: '#B7F347',
  inverseAccent: '#B7F347',
  veil: 'rgba(8,22,10,0.82)',
  shadow: '#000000',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#0F1E12',
};

/** Customers in dark mode: the same forest night as drivers. */
export const customerDark: Palette = { ...driver };

/** Drivers in light mode: the same stone and lime as customers. */
export const driverLight: Palette = { ...customer };

export type Appearance = 'light' | 'dark';

/** Light until the person picks dark in Settings (both sides; the owner's default). */
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
  /** Titles, prices and big numbers: Plus Jakarta Sans ExtraBold (the design's display face). */
  heavy: 'PlusJakartaSans_800ExtraBold',
  display: 'PlusJakartaSans_800ExtraBold',
  /** The small technical labels ("XAPP VISION IA", volumes, codes): JetBrains Mono. */
  label: 'JetBrainsMono_600SemiBold',
  arabic: 'Tajawal_500Medium',
  arabicBold: 'Tajawal_700Bold',
};

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** The deep moss-green boxes inside a light page (mission, price, ETA): moss, white text, lime. */
export const stitchDark: Palette = { ...driver, bg: '#0E1A11', surface: '#0E1A11', card: '#0E1A11', raised: '#1E3122', line: '#2A3F2D', fg: '#FFFFFF', muted: '#B9C7B7', title: '#FFFFFF' };

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
