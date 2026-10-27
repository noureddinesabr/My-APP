// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Black and white only (the owner's choice): dark mode is white text on an OLED black base,
 * light mode black text on white. Depth and selection come from greys, borders and weight,
 * never from hue. The map keeps its own colours.
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#000000',
    primaryPressed: '#222222',
    primarySoft: '#E8E8E8',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#111111',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#000000',
    accentSoft: '#E8E8E8',
    accentFill: '#2B2B2B',
    success: '#000000',
    successSoft: '#E8E8E8',
    successFill: '#1F1F1F',
    star: '#000000',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#000000',
    onCta: '#FFFFFF',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#1A1A1A',
    heroEnd: '#000000',
    onHero: '#FFFFFF',
    onHeroMuted: '#E0E0E0',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#FFFFFF',
    backgroundGlow: '#EBEBEB',
    surface: '#F4F4F4',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#EDEDED',
    // Neutral round action buttons.
    control: '#E6E6E6',
    onControl: '#000000',
    border: '#C9C9C9',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(0, 0, 0, 0.14)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#000000',
    textMuted: '#3A3A3A',
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
    primary: '#FFFFFF',
    primaryPressed: '#E0E0E0',
    primarySoft: '#2A2A2A',
    primaryFill: '#3A3A3A',
    onPrimary: '#FFFFFF',
    accent: '#FFFFFF',
    accentSoft: '#2A2A2A',
    accentFill: '#3A3A3A',
    success: '#FFFFFF',
    successSoft: '#2A2A2A',
    successFill: '#3A3A3A',
    star: '#FFFFFF',
    cta: '#FFFFFF',
    onCta: '#000000',
    hero: '#262626',
    heroEnd: '#000000',
    onHero: '#FFFFFF',
    onHeroMuted: '#D6D6D6',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#1C1C1C',
    // Levels step up clearly so cards, fields and sheets stand apart from the black base.
    surface: '#141414',
    surfaceRaised: '#1C1C1C',
    surfaceFloating: '#242424',
    // Fields to fill in and progress tracks: lighter than cards, so they read as "type here".
    surfaceMuted: '#262626',
    control: '#303030',
    onControl: '#FFFFFF',
    border: '#4A4A4A',
    rim: 'rgba(255, 255, 255, 0.18)',
    rimHighlight: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    textMuted: '#C7C7C7',
    glass: 'rgba(28, 28, 28, 0.7)',
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
  light: { textMuted: '#000000', border: '#000000', rim: 'rgba(0, 0, 0, 0.6)', primary: '#000000', glass: '#FFFFFF' },
  dark: { textMuted: '#FFFFFF', border: '#FFFFFF', rim: 'rgba(255, 255, 255, 0.6)', primary: '#FFFFFF', glass: '#1C1C1C' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#2B2B2B', '#1A1A1A'],
  hero: ['#2B2B2B', '#141414', '#000000'],
  accent: ['#3A3A3A', '#262626'],
  success: ['#2B2B2B', '#1A1A1A'],
} as const;

