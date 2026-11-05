// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * The "Show it, say it" look: the customer side is warm white (#F7F6F3) with white cards,
 * ink text (#13141A) and burnt orange (#C2410C) for the main buttons; the driver side is the
 * same app in ink dark. Depth: background (level 0) → surface (1, cards) → surfaceRaised
 * (2, sheets) → surfaceFloating (3, toasts). Text pairs are checked against WCAG AA (4.5:1)
 * in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines (a touch darker than the button orange so small text stays readable).
    primary: '#A93A0B',
    primaryPressed: '#9A3412',
    primarySoft: '#FFEDD5',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#C2410C',
    onPrimary: '#FFFFFF',
    // Warnings, lateness, destructive actions.
    accent: '#B91C1C',
    accentSoft: '#FEE2E2',
    accentFill: '#B91C1C',
    success: '#166534',
    successSoft: '#DCFCE7',
    successFill: '#166534',
    star: '#B45309',
    // Main call-to-action: the burnt orange button.
    cta: '#C2410C',
    onCta: '#FFFFFF',
    // Ink hero surfaces (delivery code, trip modules) always carry white text.
    hero: '#13141A',
    heroEnd: '#2A2C35',
    onHero: '#FFFFFF',
    onHeroMuted: '#C9CBD3',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#F7F6F3',
    backgroundGlow: '#F7F6F3',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#EFEDE8',
    // Neutral round action buttons.
    control: '#EFEDE8',
    onControl: '#13141A',
    border: '#E4E2DC',
    // The fine edge on cards (see `rim()` in theme.ts).
    rim: 'rgba(19, 20, 26, 0.08)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#13141A',
    textMuted: '#555762',
    // Translucent floating material (menu, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.86)',
    scrim: 'rgba(19, 20, 26, 0.45)',
    shadow: '#13141A',
    // Live things (GPS, the trip in progress): teal.
    location: '#0F766E',
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B6AE',
  },
  dark: {
    primary: '#FDBA74',
    primaryPressed: '#FB923C',
    primarySoft: '#3A2414',
    primaryFill: '#C2410C',
    onPrimary: '#FFFFFF',
    accent: '#FCA5A5',
    accentSoft: '#3B1414',
    accentFill: '#B91C1C',
    success: '#86EFAC',
    successSoft: '#14532D',
    successFill: '#166534',
    star: '#FCD34D',
    // The driver's main button: off-white on ink, as in the Show it driver screens.
    cta: '#F7F6F3',
    onCta: '#13141A',
    hero: '#C2410C',
    heroEnd: '#9A3412',
    onHero: '#FFFFFF',
    onHeroMuted: '#FFEDD5',
    heroControl: 'rgba(255, 255, 255, 0.18)',
    background: '#13141A',
    backgroundGlow: '#13141A',
    surface: '#1F2129',
    surfaceRaised: '#24262F',
    surfaceFloating: '#2A2C35',
    surfaceMuted: '#2A2C35',
    control: '#2A2C35',
    onControl: '#FFFFFF',
    border: '#3B3D47',
    rim: 'rgba(255, 255, 255, 0.08)',
    rimHighlight: 'rgba(255, 255, 255, 0.06)',
    text: '#FFFFFF',
    textMuted: '#B4B6C0',
    glass: 'rgba(31, 33, 41, 0.88)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    location: '#5EEAD4',
    // The map stays light on the driver side too (same streets and colours people know).
    mapSea: '#DCE7F7',
    mapLand: '#FBFAF7',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9B6AE',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#3B3D47', border: '#555762', rim: 'rgba(19, 20, 26, 0.4)', primary: '#7C2D12', glass: '#FFFFFF' },
  dark: { textMuted: '#E4E5EA', border: '#8A8C96', rim: 'rgba(255, 255, 255, 0.4)', primary: '#FED7AA', glass: '#1F2129' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text passes AA on all of them. */
export const Gradients = {
  primary: ['#C2410C', '#9A3412'],
  hero: ['#C2410C', '#9A3412', '#7C2D12'],
  accent: ['#B91C1C', '#991B1B'],
  success: ['#166534', '#14532D'],
} as const;
