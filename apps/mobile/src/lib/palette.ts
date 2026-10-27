// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Brand: Strava-style orange. The bright orange (#FF7A30, `cta`) carries dark text; white
 * text sits on the deep burnt orange (#9A3412, `primaryFill`, `hero`).
 * Dark is an OLED theme: a pure black base (#000000) with an ember glow at the top,
 * and depth shown by lighter, warm graphite surfaces with a light edge
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#7C2D12',
    primaryPressed: '#651F0A',
    primarySoft: '#FFEDE3',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#9A3412',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#881337',
    accentSoft: '#FDE8EE',
    accentFill: '#A10F38',
    success: '#09583C',
    successSoft: '#E3F4EC',
    successFill: '#0A6444',
    star: '#8A5A00',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#FF7A30',
    onCta: '#140600',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#9A3412',
    heroEnd: '#431407',
    onHero: '#FFFFFF',
    onHeroMuted: '#FFFFFF',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#F6F1EE',
    backgroundGlow: '#FFDCC7',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#F4EDE8',
    // Neutral round action buttons.
    control: '#F2E8E1',
    onControl: '#1C130E',
    border: '#DCCABD',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(154, 52, 18, 0.16)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#1C130E',
    textMuted: '#4E433C',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.72)',
    scrim: 'rgba(28, 19, 14, 0.45)',
    shadow: '#3B1A08',
    // The "you are here" dot, the same blue people know from map apps.
    location: '#1A73E8',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B2CC',
  },
  dark: {
    primary: '#FFAE85',
    primaryPressed: '#FF7A3D',
    primarySoft: '#3A1A0A',
    primaryFill: '#9A3412',
    onPrimary: '#FFFFFF',
    accent: '#FFB3C4',
    accentSoft: '#33111B',
    accentFill: '#A10F38',
    success: '#4BDFA0',
    successSoft: '#0D2A1F',
    successFill: '#0A6444',
    star: '#FFC83D',
    cta: '#FF7A30',
    onCta: '#140600',
    hero: '#9A3412',
    heroEnd: '#431407',
    onHero: '#FFFFFF',
    onHeroMuted: '#FFFFFF',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#5A1E04',
    // Levels step up clearly so cards, fields and sheets stand apart from the black base.
    surface: '#1D1714',
    surfaceRaised: '#27201C',
    surfaceFloating: '#312823',
    // Fields to fill in and progress tracks: lighter than cards, so they read as "type here".
    surfaceMuted: '#322924',
    control: '#3F342E',
    onControl: '#FFF6F0',
    border: '#5E4D43',
    rim: 'rgba(255, 214, 190, 0.22)',
    rimHighlight: 'rgba(255, 255, 255, 0.14)',
    text: '#FFF8F3',
    textMuted: '#D9CBC1',
    glass: 'rgba(39, 32, 28, 0.62)',
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
  light: { textMuted: '#2B211B', border: '#6B5A4F', rim: 'rgba(28, 19, 14, 0.5)', primary: '#7C2D12', glass: '#FFFFFF' },
  dark: { textMuted: '#F2E8E1', border: '#B09A8C', rim: 'rgba(255, 236, 224, 0.5)', primary: '#FFD6BF', glass: '#312823' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#9A3412', '#7C2D12'],
  hero: ['#9A3412', '#7C2D12', '#431407'],
  accent: ['#A10F38', '#88102F'],
  success: ['#0A6444', '#08533A'],
} as const;

