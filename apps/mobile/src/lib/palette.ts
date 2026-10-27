// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Brand: coral. Light mode puts the whole app on a coral canvas (#FF6B70) with white cards;
 * buttons and accents are deep wine (#7A1020 / #9B1B2A) with white text.
 * Dark is an OLED black base with a wine glow at the top, coral main buttons with
 * dark text, and depth shown by lighter warm surfaces with a light edge
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#8A1525',
    primaryPressed: '#7A1020',
    primarySoft: '#FFE3E4',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#9B1B2A',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#7C2D12',
    accentSoft: '#FFEDE3',
    accentFill: '#9A3412',
    success: '#09583C',
    successSoft: '#E3F4EC',
    successFill: '#0A6444',
    star: '#8A5A00',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#7A1020',
    onCta: '#FFFFFF',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#9B1B2A',
    heroEnd: '#4A0710',
    onHero: '#FFFFFF',
    onHeroMuted: '#FFFFFF',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#FF6B70',
    backgroundGlow: '#FF9EA1',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#FFF1F1',
    // Neutral round action buttons.
    control: '#FFE3E4',
    onControl: '#1A0507',
    border: '#EDB2B5',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(122, 16, 32, 0.18)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#1A0507',
    textMuted: '#4A1F22',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.72)',
    scrim: 'rgba(26, 5, 7, 0.45)',
    shadow: '#4A0710',
    // The "you are here" dot, the same blue people know from map apps.
    location: '#1A73E8',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B2CC',
  },
  dark: {
    primary: '#FF9EA1',
    primaryPressed: '#FF8085',
    primarySoft: '#3D1418',
    primaryFill: '#9B1B2A',
    onPrimary: '#FFFFFF',
    accent: '#FFB38A',
    accentSoft: '#3A1D10',
    accentFill: '#9A3412',
    success: '#4BDFA0',
    successSoft: '#0D2A1F',
    successFill: '#0A6444',
    star: '#FFC83D',
    cta: '#FF6B70',
    onCta: '#1A0507',
    hero: '#9B1B2A',
    heroEnd: '#4A0710',
    onHero: '#FFFFFF',
    onHeroMuted: '#FFFFFF',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#5C1A20',
    // Levels step up clearly so cards, fields and sheets stand apart from the black base.
    surface: '#24100F',
    surfaceRaised: '#2E1517',
    surfaceFloating: '#381B1E',
    // Fields to fill in and progress tracks: lighter than cards, so they read as "type here".
    surfaceMuted: '#3A1D20',
    control: '#47262A',
    onControl: '#FFF4F4',
    border: '#6A3A3F',
    rim: 'rgba(255, 200, 202, 0.22)',
    rimHighlight: 'rgba(255, 255, 255, 0.14)',
    text: '#FFF5F5',
    textMuted: '#E6CACC',
    glass: 'rgba(46, 21, 23, 0.62)',
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
  light: { textMuted: '#1A0507', border: '#7A1020', rim: 'rgba(26, 5, 7, 0.5)', primary: '#7A1020', glass: '#FFFFFF' },
  dark: { textMuted: '#F7E6E7', border: '#B57A7F', rim: 'rgba(255, 228, 229, 0.5)', primary: '#FFC2C4', glass: '#381B1E' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#9B1B2A', '#7A1020'],
  hero: ['#9B1B2A', '#7A1020', '#4A0710'],
  accent: ['#A10F38', '#88102F'],
  success: ['#0A6444', '#08533A'],
} as const;

