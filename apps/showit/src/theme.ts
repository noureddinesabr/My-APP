// Xapp Freight, redesign 2: warm glass and colour gradients from the owner's reference images, light by default.

export type Palette = {
  /** The page background is a soft blurred wash: bgTop (olive haze) → bg (cream) → bgWarm (peach glow). */
  bgTop: string;
  bg: string;
  bgWarm: string;
  /** Glass cards: a gradient from surface (top) to surfaceTo (warm cream), with a bright glassEdge. */
  surfaceTo: string;
  glassEdge: string;
  /** The third stop of the main button's green → yellow → orange gradient. */
  accent3: string;
  /** The hero card's sky → mint → butter gradient (sky, sky2, sky3). */
  sky2: string;
  sky3: string;
  /** The dark cards' gradient end (charcoal → deep olive). */
  inverseTo: string;
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

// Xapp Freight, redesign 2 (owner's reference images, 17 Nov 2026): a warm blurred wash behind
// everything (olive haze → cream → peach), frosted cream glass cards, a green → yellow → orange main
// button, a sky → mint → butter hero card, near-black chips with coloured dots, soft pastel badges and
// light, airy numbers. Light by default.
export const customer: Palette = {
  bgTop: '#C9CFAE',
  bg: '#F3EEE5',
  bgWarm: '#F6E3C8',
  surface: '#FFFFFF',
  surfaceTo: '#F7F1E7',
  glassEdge: 'rgba(255,255,255,0.9)',
  raised: '#F1ECE2',
  card: '#F3EEE5',
  line: '#E6DFD2',
  fg: '#1C1D19',
  muted: '#6F6A5F',
  accent: '#93D27E',
  accent2: '#E9D46A',
  accent3: '#F4B46C',
  onAccent: '#1F2414',
  live: '#56761C',
  liveSoft: '#E2ECD2',
  ok: '#4F7A20',
  okSoft: '#E2ECD2',
  warn: '#C2412D',
  warnSoft: '#FADFD9',
  ink: '#1E1E1B',
  onInk: '#FFFFFF',
  danger: '#C2412D',
  orange: '#F2A65A',
  title: '#1C1D19',
  sky: '#8EC4F2',
  sky2: '#CFE3EC',
  sky3: '#F5E7A3',
  onSky: '#1C2A33',
  inverseDeep: '#232420',
  inverse: '#1E1E1B',
  inverseTo: '#2E3524',
  inverse2: '#2B2C27',
  onInverse: '#FFFFFF',
  onInverseMuted: '#C9C5BA',
  inverseLabel: '#C8E38A',
  inverseAccent: '#B9DE7A',
  veil: 'rgba(243,238,229,0.72)',
  shadow: '#3A3424',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#ECE6DA',
};

// Dark: the same wash at night (deep olive → charcoal → ember), smoked glass, the same gradients.
export const driver: Palette = {
  bgTop: '#2A3120',
  bg: '#151612',
  bgWarm: '#2B2116',
  surface: '#23241F',
  surfaceTo: '#1C1D19',
  glassEdge: 'rgba(255,255,255,0.08)',
  raised: '#2C2D27',
  card: '#1C1D19',
  line: '#34352E',
  fg: '#ECE8DF',
  muted: '#A9A497',
  accent: '#93D27E',
  accent2: '#E9D46A',
  accent3: '#F4B46C',
  onAccent: '#1F2414',
  live: '#B9DE7A',
  liveSoft: '#2C3720',
  ok: '#A6D47E',
  okSoft: '#2C3720',
  warn: '#F4A38F',
  warnSoft: '#3A2620',
  ink: '#ECE8DF',
  onInk: '#151612',
  danger: '#F4A38F',
  orange: '#F2A65A',
  title: '#F4F0E8',
  sky: '#3D6A8F',
  sky2: '#3A5A5C',
  sky3: '#6B6236',
  onSky: '#EEF5FA',
  inverseDeep: '#0F100D',
  inverse: '#0E0F0C',
  inverseTo: '#222A18',
  inverse2: '#1E1F1B',
  onInverse: '#FFFFFF',
  onInverseMuted: '#C9C5BA',
  inverseLabel: '#C8E38A',
  inverseAccent: '#B9DE7A',
  veil: 'rgba(21,22,18,0.82)',
  shadow: '#000000',
  dangerFill: '#DC2626',
  whatsapp: '#1FA855',
  mapBg: '#1E1F1B',
};

/** Customers in dark mode: the same night as drivers. */
export const customerDark: Palette = { ...driver };

/** Drivers in light mode: the same warm wash as customers. */
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
  regular: 'Inter_400Regular',
  semibold: 'Inter_500Medium',
  bold: 'Inter_600SemiBold',
  /** Words in bold (buttons, names): Inter SemiBold. */
  heavy: 'Inter_600SemiBold',
  /** Big titles and numbers: light and airy, like the reference ("36.4%", "1,545"). */
  display: 'Inter_300Light',
  /** Small labels: Inter Medium, written as they are (no capitals). */
  label: 'Inter_500Medium',
  arabic: 'Tajawal_500Medium',
  arabicBold: 'Tajawal_700Bold',
};

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** The near-black boxes inside a light page (mission, price, summary): charcoal, white text, soft lime. */
export const stitchDark: Palette = { ...driver, bg: '#1E1E1B', surface: '#262722', surfaceTo: '#1E1E1B', raised: '#2E2F29', line: '#3A3B33', fg: '#FFFFFF', muted: '#C9C5BA', title: '#FFFFFF', glassEdge: 'rgba(255,255,255,0.08)' };

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
