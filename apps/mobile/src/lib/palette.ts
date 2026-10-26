// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Dark is an OLED theme: a pure black base (#000000) with a violet glow at the top,
 * and depth shown by lighter, slightly violet surfaces with a light edge
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#5B21B6',
    primaryPressed: '#4C1D95',
    primarySoft: '#EFE9FC',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#5B21B6',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#941F18',
    accentSoft: '#FCEBEA',
    accentFill: '#A3221A',
    success: '#09583C',
    successSoft: '#E3F4EC',
    successFill: '#0A6444',
    star: '#8A5A00',
    // Main call-to-action: a solid pill, the most contrasted element on screen.
    cta: '#1E0B45',
    onCta: '#FFFFFF',
    // Violet hero surfaces (balance / new request modules) always carry white text.
    hero: '#5B21B6',
    heroEnd: '#1E0B45',
    onHero: '#FFFFFF',
    onHeroMuted: '#EDE7FF',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#F6F4FB',
    backgroundGlow: '#E6DCFB',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#EEEAF6',
    // Neutral round action buttons.
    control: '#ECE7F7',
    onControl: '#160B2E',
    border: '#DCD5EA',
    // The light edge: a fine border plus a brighter top line (see `rim()` in theme.ts).
    rim: 'rgba(91, 33, 182, 0.10)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#160B2E',
    textMuted: '#4B4560',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.72)',
    scrim: 'rgba(22, 11, 46, 0.45)',
    shadow: '#2A1260',
    // The "you are here" dot, the same blue people know from map apps.
    location: '#1A73E8',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B2CC',
  },
  dark: {
    primary: '#C4B5FD',
    primaryPressed: '#A78BFA',
    primarySoft: '#24133F',
    primaryFill: '#5B21B6',
    onPrimary: '#FFFFFF',
    accent: '#FFA39A',
    accentSoft: '#2E1416',
    accentFill: '#A3221A',
    success: '#4BDFA0',
    successSoft: '#0D2A1F',
    successFill: '#0A6444',
    star: '#FFC83D',
    cta: '#FFFFFF',
    onCta: '#1E0B45',
    hero: '#5B21B6',
    heroEnd: '#1E0B45',
    onHero: '#FFFFFF',
    onHeroMuted: '#EDE7FF',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#3B0F7A',
    surface: '#130D22',
    surfaceRaised: '#1C1430',
    surfaceFloating: '#261C3D',
    surfaceMuted: '#1C1430',
    control: '#352A4F',
    onControl: '#F7F5FF',
    border: '#33284A',
    rim: 'rgba(221, 214, 254, 0.16)',
    rimHighlight: 'rgba(255, 255, 255, 0.12)',
    text: '#F7F5FF',
    textMuted: '#C9C2DC',
    glass: 'rgba(28, 20, 48, 0.62)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    location: '#4C8DF6',
    mapSea: '#0B0A20',
    mapLand: '#17112A',
    mapNeighbour: '#100B1E',
    mapBorder: '#41365C',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#241A3A', border: '#4B4560', rim: 'rgba(22, 11, 46, 0.5)', primary: '#3B0F7A', glass: '#FFFFFF' },
  dark: { textMuted: '#ECE8F7', border: '#9A8FB5', rim: 'rgba(237, 231, 255, 0.5)', primary: '#DDD6FE', glass: '#261C3D' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#5B21B6', '#4C1D95'],
  hero: ['#5B21B6', '#4C1D95', '#1E0B45'],
  accent: ['#A3221A', '#8E1B13'],
  success: ['#0A6444', '#08533A'],
} as const;

