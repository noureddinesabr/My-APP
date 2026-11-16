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
