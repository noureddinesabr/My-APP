// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Uber-style black & white. Light: pure white with black text and black buttons.
 * Dark: a pure black base (#000000), depth shown by lighter grey surfaces with a light edge
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#000000',
    primaryPressed: '#333333',
    primarySoft: '#EEEEEE',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#000000',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#000000',
    accentSoft: '#F3F3F3',
    accentFill: '#000000',
    success: '#09583C',
    successSoft: '#E3F4EC',
    successFill: '#0A6444',
    star: '#000000',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#000000',
    onCta: '#FFFFFF',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#000000',
    heroEnd: '#1F1F1F',
    onHero: '#FFFFFF',
    onHeroMuted: '#D9D9D9',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#FFFFFF',
    backgroundGlow: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#F3F3F3',
    // Neutral round action buttons.
    control: '#EEEEEE',
    onControl: '#000000',
    border: '#E2E2E2',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(0, 0, 0, 0.09)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#000000',
    textMuted: '#4A4A4A',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.86)',
    scrim: 'rgba(0, 0, 0, 0.45)',
    shadow: '#000000',
    // The "you are here" dot, the same blue people know from map apps.
    location: '#276EF1',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#BDBDBD',
  },
  dark: {
    primary: '#FFFFFF',
    primaryPressed: '#D6D6D6',
    primarySoft: '#1F1F1F',
    primaryFill: '#333333',
    onPrimary: '#FFFFFF',
    accent: '#FFFFFF',
    accentSoft: '#1F1F1F',
    accentFill: '#333333',
    success: '#4BDFA0',
    successSoft: '#0D2A1F',
    successFill: '#0A6444',
    star: '#FFFFFF',
    cta: '#FFFFFF',
    onCta: '#000000',
    hero: '#1F1F1F',
    heroEnd: '#000000',
    onHero: '#FFFFFF',
    onHeroMuted: '#D9D9D9',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#000000',
    // Levels step up clearly so cards, fields and sheets stand apart from the black base.
    surface: '#141414',
    surfaceRaised: '#1C1C1C',
    surfaceFloating: '#242424',
    // Fields to fill in and progress tracks: lighter than cards, so they read as "type here".
    surfaceMuted: '#262626',
    control: '#2E2E2E',
    onControl: '#FFFFFF',
    border: '#3A3A3A',
    rim: 'rgba(255, 255, 255, 0.14)',
    rimHighlight: 'rgba(255, 255, 255, 0.1)',
    text: '#FFFFFF',
    textMuted: '#B8B8B8',
    glass: 'rgba(20, 20, 20, 0.72)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    location: '#4C8DF6',
    // The map stays light in dark mode too (same streets and colours people know).
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#BDBDBD',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#2B2B2B', border: '#5E5E5E', rim: 'rgba(0, 0, 0, 0.5)', primary: '#000000', glass: '#FFFFFF' },
  dark: { textMuted: '#E6E6E6', border: '#9E9E9E', rim: 'rgba(255, 255, 255, 0.5)', primary: '#FFFFFF', glass: '#1C1C1C' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#1F1F1F', '#000000'],
  hero: ['#2B2B2B', '#141414', '#000000'],
  accent: ['#1F1F1F', '#000000'],
  success: ['#0A6444', '#08533A'],
} as const;

