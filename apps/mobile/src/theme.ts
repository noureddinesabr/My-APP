import { useColorScheme } from 'react-native';

const palette = {
  light: {
    primary: '#1747C8',
    primaryPressed: '#103596',
    primarySoft: '#E8EEFD',
    accent: '#FF7A1A',
    accentSoft: '#FFF0E5',
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF1F7',
    border: '#E1E6F0',
    text: '#0E1A33',
    textMuted: '#5B6785',
    onPrimary: '#FFFFFF',
    success: '#16A34A',
  },
  dark: {
    primary: '#5B85F5',
    primaryPressed: '#3F6AE0',
    primarySoft: '#1B2747',
    accent: '#FF8A33',
    accentSoft: '#3A2414',
    background: '#0A1020',
    surface: '#131B2E',
    surfaceMuted: '#1B2438',
    border: '#26304A',
    text: '#F2F5FB',
    textMuted: '#9AA6C2',
    onPrimary: '#FFFFFF',
    success: '#22C55E',
  },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

export function useColors(): ThemeColors {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Fonts = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
