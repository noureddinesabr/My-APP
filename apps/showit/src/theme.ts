// The "Show it, say it" look: warm white and burnt orange for customers, ink dark for drivers.

export type Palette = {
  bg: string;
  surface: string;
  raised: string;
  line: string;
  fg: string;
  muted: string;
  accent: string;
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
};

export const customer: Palette = {
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  raised: '#EFEDE8',
  line: '#E4E2DC',
  fg: '#13141A',
  muted: '#555762',
  accent: '#C2410C',
  onAccent: '#FFFFFF',
  live: '#0F766E',
  liveSoft: '#CCFBF1',
  ok: '#166534',
  okSoft: '#DCFCE7',
  warn: '#92400E',
  warnSoft: '#FEF3C7',
  ink: '#13141A',
  onInk: '#FFFFFF',
  danger: '#B91C1C',
};

export const driver: Palette = {
  bg: '#13141A',
  surface: '#1F2129',
  raised: '#2A2C35',
  line: '#3B3D47',
  fg: '#FFFFFF',
  muted: '#B4B6C0',
  accent: '#F7F6F3',
  onAccent: '#13141A',
  live: '#5EEAD4',
  liveSoft: '#134E4A',
  ok: '#86EFAC',
  okSoft: '#14532D',
  warn: '#FCD34D',
  warnSoft: '#422006',
  ink: '#F7F6F3',
  onInk: '#13141A',
  danger: '#FCA5A5',
};

export const Font = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
  arabic: 'NotoKufiArabic_500Medium',
  arabicBold: 'NotoKufiArabic_700Bold',
};

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
