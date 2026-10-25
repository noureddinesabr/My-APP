import { Platform, useColorScheme, type ViewStyle } from 'react-native';

const palette = {
  light: {
    primary: '#5B4BFF',
    primaryPressed: '#4636E0',
    primarySoft: '#EEECFF',
    accent: '#FF5E5B',
    accentSoft: '#FFEDEB',
    background: '#F6F6FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F0F8',
    border: '#ECEBF5',
    text: '#12122B',
    textMuted: '#6E6D8C',
    onPrimary: '#FFFFFF',
    success: '#12B886',
    successSoft: '#E3F8F1',
    shadow: '#2B2470',
  },
  dark: {
    primary: '#8A7DFF',
    primaryPressed: '#7466F5',
    primarySoft: '#232048',
    accent: '#FF7A6E',
    accentSoft: '#3A1E22',
    background: '#0B0B18',
    surface: '#16162B',
    surfaceMuted: '#1F1F38',
    border: '#29294A',
    text: '#F4F4FF',
    textMuted: '#A3A2C4',
    onPrimary: '#FFFFFF',
    success: '#2BD4A0',
    successSoft: '#123328',
    shadow: '#000000',
  },
} as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

export function useColors(): ThemeColors {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/** Brand gradients (start → end). */
export const Gradients = {
  primary: ['#7B5CFF', '#4F6BFF', '#2AA8FF'],
  accent: ['#FF8A4C', '#FF5E5B', '#F2467E'],
  success: ['#1FD1A0', '#12B886'],
} as const;

export const Fonts = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;

/** Soft, colored drop shadow used on cards and floating buttons. */
export function softShadow(color: string, strength = 1): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${8 * strength}px ${24 * strength}px ${color}1F` },
    default: {
      shadowColor: color,
      shadowOpacity: 0.12,
      shadowRadius: 16 * strength,
      shadowOffset: { width: 0, height: 6 * strength },
      elevation: 4 * strength,
    },
  });
}
