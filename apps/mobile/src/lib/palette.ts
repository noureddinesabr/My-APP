// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Charcoal & lime (logistics-app style): a charcoal base (#1C1C1E), lighter grey cards,
 * bright lime for main actions, coral for highlight cards; depth shown by lighter surfaces with a light edge
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#334807',
    primaryPressed: '#2C3E05',
    primarySoft: '#EEF8D6',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#B7E94B',
    onPrimary: '#111111',
    // Warnings, lateness, destructive actions.
    accent: '#8A1F17',
    accentSoft: '#FDE8E6',
    accentFill: '#FF8A80',
    success: '#074A33',
    successSoft: '#E3F4EC',
    successFill: '#5BE39A',
    star: '#7A5200',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#B7E94B',
    onCta: '#111111',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#FF7A70',
    heroEnd: '#FF8A80',
    onHero: '#111111',
    onHeroMuted: '#1A0F0E',
    heroControl: 'rgba(0, 0, 0, 0.12)',
    background: '#F2F2F7',
    backgroundGlow: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#E5E5EA',
    // Neutral round action buttons.
    control: '#E5E5EA',
    onControl: '#111111',
    border: '#C7C7CC',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(0, 0, 0, 0.08)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#111111',
    textMuted: '#3C3C43',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.8)',
    scrim: 'rgba(0, 0, 0, 0.45)',
    shadow: '#000000',
    // The "you are here" dot, the same blue people know from map apps.
    location: '#1A73E8',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B2CC',
  },
  dark: {
    primary: '#C5F05A',
    primaryPressed: '#A9D93F',
    primarySoft: '#26301A',
    primaryFill: '#B7E94B',
    onPrimary: '#111111',
    accent: '#FFC7C2',
    accentSoft: '#331A19',
    accentFill: '#FF8A80',
    success: '#7AEBB0',
    successSoft: '#132A1F',
    successFill: '#5BE39A',
    star: '#FFD166',
    cta: '#B7E94B',
    onCta: '#111111',
    hero: '#FF7A70',
    heroEnd: '#FF8A80',
    onHero: '#111111',
    onHeroMuted: '#1A0F0E',
    heroControl: 'rgba(0, 0, 0, 0.12)',
    background: '#1C1C1E',
    backgroundGlow: '#1C1C1E',
    // Levels step up clearly so cards, fields and sheets stand apart from the black base.
    surface: '#2C2C2E',
    surfaceRaised: '#323234',
    surfaceFloating: '#3A3A3C',
    // Fields to fill in and progress tracks: lighter than cards, so they read as "type here".
    surfaceMuted: '#3A3A3C',
    control: '#3A3A3C',
    onControl: '#FFFFFF',
    border: '#48484A',
    rim: 'rgba(255, 255, 255, 0.08)',
    rimHighlight: 'rgba(255, 255, 255, 0.06)',
    text: '#FFFFFF',
    textMuted: '#D1D1D6',
    glass: 'rgba(44, 44, 46, 0.72)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    location: '#4C8DF6',
    // The map stays light in dark mode too (same streets and colours people know).
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B2CC',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#1C1C1E', border: '#636366', rim: 'rgba(0, 0, 0, 0.5)', primary: '#2C3E05', glass: '#FFFFFF' },
  dark: { textMuted: '#F2F2F7', border: '#AEAEB2', rim: 'rgba(255, 255, 255, 0.5)', primary: '#D4F57A', glass: '#2C2C2E' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end): bright lime / coral / green, always with dark text (onPrimary, onHero). */
export const Gradients = {
  primary: ['#C5F05A', '#B7E94B'],
  hero: ['#FF8A80', '#FF7A70'],
  accent: ['#FF8A80', '#FF7A70'],
  success: ['#5BE39A', '#4CD98C'],
} as const;

