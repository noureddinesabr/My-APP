// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Dark is an OLED theme: a pure black base (#000000) with the navy glow of the
 * reference design at the top, and depth shown by lighter, slightly blue surfaces
 * (tonal elevation) instead of heavy shadows:
 *   background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) → surfaceFloating (3, toasts, dock)
 * Text pairs are checked against WCAG AAA (7:1) in src/lib/contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent used for text, icons and outlines.
    primary: '#1B42B4',
    primaryPressed: '#16389C',
    primarySoft: '#E6ECFB',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#1D47C2',
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
    cta: '#0B1220',
    onCta: '#FFFFFF',
    // Navy hero surfaces (balance / earnings modules) always carry white text.
    hero: '#0B4A8C',
    heroEnd: '#021B38',
    onHero: '#FFFFFF',
    onHeroMuted: '#DFE7F3',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#F2F4F7',
    backgroundGlow: '#DCE6F7',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#E8ECF2',
    // Neutral round action buttons (Add money / Move / … in the reference).
    control: '#E3E8F0',
    onControl: '#0B1220',
    border: '#D5DBE5',
    rim: 'rgba(11, 18, 32, 0.08)',
    text: '#0B1220',
    textMuted: '#434E5E',
    // Translucent floating material (dock, toasts, headers) before blur.
    glass: 'rgba(255, 255, 255, 0.72)',
    scrim: 'rgba(5, 10, 20, 0.45)',
    shadow: '#0B1220',
    mapSea: '#DCEBFA',
    mapLand: '#FBFAF6',
    mapNeighbour: '#EEEDE8',
    mapBorder: '#B9C2D0',
  },
  dark: {
    primary: '#94BCFF',
    primaryPressed: '#6FA0F5',
    primarySoft: '#11213D',
    primaryFill: '#1D47C2',
    onPrimary: '#FFFFFF',
    accent: '#FFA39A',
    accentSoft: '#2E1416',
    accentFill: '#A3221A',
    success: '#4BDFA0',
    successSoft: '#0D2A1F',
    successFill: '#0A6444',
    star: '#FFC83D',
    cta: '#F5F7FA',
    onCta: '#0B1220',
    hero: '#0B4A8C',
    heroEnd: '#021B38',
    onHero: '#FFFFFF',
    onHeroMuted: '#DFE7F3',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#000000',
    backgroundGlow: '#01386C',
    surface: '#10151D',
    surfaceRaised: '#1A212C',
    surfaceFloating: '#262E3A',
    surfaceMuted: '#1A212C',
    control: '#3A4250',
    onControl: '#F5F7FA',
    border: '#2A3342',
    rim: 'rgba(255, 255, 255, 0.08)',
    text: '#F5F7FA',
    textMuted: '#B4BDCB',
    glass: 'rgba(20, 26, 36, 0.62)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    mapSea: '#071526',
    mapLand: '#141B26',
    mapNeighbour: '#0D121A',
    mapBorder: '#3A4558',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#1F2937', border: '#4B5563', rim: 'rgba(11, 18, 32, 0.5)', primary: '#0F2F8F', glass: '#FFFFFF' },
  dark: { textMuted: '#E2E8F0', border: '#8A96A8', rim: 'rgba(255, 255, 255, 0.45)', primary: '#B5D0FF', glass: '#262E3A' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#1D47C2', '#16389C'],
  hero: ['#0B4A8C', '#01386C', '#021B38'],
  accent: ['#A3221A', '#8E1B13'],
  success: ['#0A6444', '#08533A'],
} as const;

