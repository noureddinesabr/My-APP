// Self-contained (no imports) so the contrast test can load it with plain Node.

/**
 * Semantic colour tokens. Screens only use these names, never hex values.
 *
 * Design system v2 (Phase 2): a professional logistics look — a light interface with deep
 * navy structure (#142B49), a blue accent for actions and links, teal for live / location
 * information, green for success and red for problems. Dark mode is a deep navy version of the
 * same tokens. Depth: background (level 0) → surface (1, cards) → surfaceRaised (2, sheets) →
 * surfaceFloating (3, toasts). Text pairs are checked against WCAG AAA (7:1) in contrast.test.ts.
 */
export const palette = {
  light: {
    // Accent for links, icons, outlines and selected states.
    primary: '#1746A2',
    primaryPressed: '#123A88',
    primarySoft: '#E8EFFC',
    // Filled accent backgrounds (selected chips, badges, chat bubbles) with `onPrimary` text.
    primaryFill: '#1746A2',
    onPrimary: '#FFFFFF',
    // Problems, cancellations, destructive actions.
    accent: '#951B12',
    accentSoft: '#FCEBEA',
    accentFill: '#A3221A',
    success: '#07514A',
    successSoft: '#E3F5EF',
    successFill: '#0A5C47',
    star: '#6B4400',
    // Main call-to-action: solid navy, the most contrasted element on screen.
    cta: '#142B49',
    onCta: '#FFFFFF',
    // Navy hero surfaces (headers, summary modules) always carry white text.
    hero: '#142B49',
    heroEnd: '#0B1A2F',
    onHero: '#FFFFFF',
    onHeroMuted: '#DCE5F2',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#F4F6F9',
    backgroundGlow: '#E3EAF4',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceFloating: '#FFFFFF',
    surfaceMuted: '#EDF1F6',
    // Neutral round action buttons.
    control: '#E6ECF3',
    onControl: '#142B49',
    border: '#CBD5E1',
    rim: 'rgba(20, 43, 73, 0.12)',
    rimHighlight: 'rgba(255, 255, 255, 0.9)',
    text: '#0F1E33',
    textMuted: '#3A4A63',
    glass: 'rgba(255, 255, 255, 0.82)',
    scrim: 'rgba(11, 26, 47, 0.45)',
    shadow: '#142B49',
    // Teal: live and location information (GPS, "you are here", live trips).
    location: '#0B7A70',
    teal: '#0B7A70',
    tealSoft: '#E1F4F1',
    mapSea: '#D6E4F2',
    mapLand: '#FAFBFC',
    mapNeighbour: '#EEF1F4',
    mapBorder: '#B4C0CF',
  },
  dark: {
    primary: '#A9C4FF',
    primaryPressed: '#86A9F5',
    primarySoft: '#14254A',
    primaryFill: '#1746A2',
    onPrimary: '#FFFFFF',
    accent: '#FFA39A',
    accentSoft: '#2E1416',
    accentFill: '#A3221A',
    success: '#5EE0B5',
    successSoft: '#0B2A24',
    successFill: '#0A5C47',
    star: '#FFC83D',
    cta: '#FFFFFF',
    onCta: '#142B49',
    hero: '#142B49',
    heroEnd: '#0B1A2F',
    onHero: '#FFFFFF',
    onHeroMuted: '#DCE5F2',
    heroControl: 'rgba(255, 255, 255, 0.16)',
    background: '#0A1220',
    backgroundGlow: '#14254A',
    surface: '#111C2E',
    surfaceRaised: '#16233A',
    surfaceFloating: '#1C2B45',
    surfaceMuted: '#1E2D47',
    control: '#24365A',
    onControl: '#F1F5FB',
    border: '#33476B',
    rim: 'rgba(169, 196, 255, 0.2)',
    rimHighlight: 'rgba(255, 255, 255, 0.12)',
    text: '#F1F5FB',
    textMuted: '#C3CEDF',
    glass: 'rgba(17, 28, 46, 0.82)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    location: '#4FD1C1',
    teal: '#4FD1C1',
    tealSoft: '#0E2E2B',
    // The map stays light in dark mode too (same streets and colours people know).
    mapSea: '#D6E4F2',
    mapLand: '#FAFBFC',
    mapNeighbour: '#EEF1F4',
    mapBorder: '#B4C0CF',
  },
} as const;

/** High-contrast mode: stronger text, borders and rims; floating parts become opaque. */
export const highContrast = {
  light: { textMuted: '#1E2B40', border: '#3A4A63', rim: 'rgba(15, 30, 51, 0.5)', primary: '#123A88', glass: '#FFFFFF' },
  dark: { textMuted: '#E6ECF5', border: '#8EA2C4', rim: 'rgba(241, 245, 251, 0.5)', primary: '#C9DAFF', glass: '#16233A' },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/** Brand gradients (start → end); white text on all of them passes AAA. */
export const Gradients = {
  primary: ['#1746A2', '#142B49'],
  hero: ['#1E3A66', '#142B49', '#0B1A2F'],
  accent: ['#A3221A', '#8E1B13'],
  success: ['#0A5C47', '#08493A'],
} as const;
