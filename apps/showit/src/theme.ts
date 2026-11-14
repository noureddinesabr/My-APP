// The Xapp Simple look: white and mint with deep teal (the redesign), the same for customers and drivers.

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

// The mint design (same for both sides): white pages, soft mint cards, deep teal titles and buttons,
// orange only for small touches (logo, badges, things to check).
export const customer: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  raised: '#F3F6F5',
  card: '#E4F2EE',
  line: '#E6EDEB',
  fg: '#1D2A28',
  muted: '#7A8985',
  accent: '#1E5B53',
  accent2: '#1E5B53',
  onAccent: '#FFFFFF',
  live: '#1E5B53',
  liveSoft: '#E4F2EE',
  ok: '#2F7D55',
  okSoft: '#E4F2EE',
  warn: '#C2571B',
  warnSoft: '#FDEEE4',
  ink: '#163F3A',
  onInk: '#FFFFFF',
  danger: '#D64545',
  orange: '#F07A3A',
  title: '#1E5B53',
};

export const driver: Palette = {
  bg: '#0F1918',
  surface: '#16211F',
  raised: '#1C2B29',
  card: '#16302C',
  line: '#24413C',
  fg: '#E8F2EF',
  muted: '#8EA6A0',
  accent: '#2F8A7A',
  accent2: '#2F8A7A',
  onAccent: '#FFFFFF',
  live: '#8FD6C6',
  liveSoft: '#16302C',
  ok: '#5FD39A',
  okSoft: '#16302C',
  warn: '#FF9D66',
  warnSoft: '#3A2316',
  ink: '#E8F2EF',
  onInk: '#0F1918',
  danger: '#FF7B7B',
  orange: '#FF8C4D',
  title: '#8FD6C6',
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
  regular: 'Urbanist_500Medium',
  semibold: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
  heavy: 'Urbanist_800ExtraBold',
  arabic: 'Tajawal_500Medium',
  arabicBold: 'Tajawal_700Bold',
};

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
