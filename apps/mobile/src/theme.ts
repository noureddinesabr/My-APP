import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, type ViewStyle } from 'react-native';

import { highContrast, palette, type ThemeColors } from '@/lib/palette';

export { Gradients } from '@/lib/palette';

export type { ThemeColors } from '@/lib/palette';
export type Appearance = 'dark' | 'light' | 'system';

export const Fonts = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
} as const;

/** 4-pt scale; screens use 16 outer margins and 12 gaps between modules. */
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Bento tiles and cards use 20–24, controls 16, chips pills. */
export const Radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export function themeColors(scheme: 'light' | 'dark', contrast = false): ThemeColors {
  return contrast ? { ...palette[scheme], ...highContrast[scheme] } : palette[scheme];
}

type ThemeValue = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  /** System "Reduce transparency" (or the in-app switch): floating parts become opaque. */
  reduceTransparency: boolean;
  /** System "Increase contrast" (or the in-app switch). */
  highContrast: boolean;
  setPreference: (key: 'reduceTransparency' | 'highContrast', on: boolean) => void;
};

const STORAGE_KEY = 'xapp.appearance';
const ThemeContext = createContext<ThemeValue | null>(null);

/** Media-query preference in browsers (prefers-reduced-transparency, prefers-contrast). */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => Platform.OS === 'web' && typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof matchMedia === 'undefined') return;
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/** iOS "Reduce Transparency" and "Increase Contrast" / Android "High contrast text". */
function useSystemFlag(kind: 'reduceTransparency' | 'highContrast') {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const read =
      kind === 'reduceTransparency'
        ? AccessibilityInfo.isReduceTransparencyEnabled
        : Platform.OS === 'ios'
          ? AccessibilityInfo.isDarkerSystemColorsEnabled
          : AccessibilityInfo.isHighTextContrastEnabled;
    read?.call(AccessibilityInfo).then(setOn, () => {});
    const event = kind === 'reduceTransparency' ? 'reduceTransparencyChanged' : Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged';
    const subscription = AccessibilityInfo.addEventListener(event as 'reduceTransparencyChanged', setOn);
    return () => subscription.remove();
  }, [kind]);
  return on;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [saved, setSaved] = useState<{ appearance: Appearance; reduceTransparency: boolean; highContrast: boolean }>({
    appearance: 'dark',
    reduceTransparency: false,
    highContrast: false,
  });
  const systemTransparency = useSystemFlag('reduceTransparency');
  const systemContrast = useSystemFlag('highContrast');
  const webTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const webContrast = useMediaQuery('(prefers-contrast: more)');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => value && setSaved((current) => ({ ...current, ...JSON.parse(value) })))
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = saved.appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : saved.appearance;
    const highContrast = saved.highContrast || systemContrast || webContrast;
    const store = (next: typeof saved) => {
      setSaved(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    };
    return {
      scheme,
      colors: themeColors(scheme, highContrast),
      appearance: saved.appearance,
      setAppearance: (appearance) => store({ ...saved, appearance }),
      reduceTransparency: saved.reduceTransparency || systemTransparency || webTransparency || highContrast,
      highContrast,
      setPreference: (key, on) => store({ ...saved, [key]: on }),
    };
  }, [saved, system, systemTransparency, systemContrast, webTransparency, webContrast]);

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

export function useColors(): ThemeColors {
  return useTheme().colors;
}

/**
 * Depth for floating parts only (dock, toasts, sheets). Cards rely on tonal
 * elevation and the 1 px rim instead, so dark mode stays crisp.
 */
export function softShadow(color: string, strength = 1): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${8 * strength}px ${24 * strength}px ${color}26` },
    default: {
      shadowColor: color,
      shadowOpacity: 0.16,
      shadowRadius: 16 * strength,
      shadowOffset: { width: 0, height: 6 * strength },
      elevation: 4 * strength,
    },
  });
}

/** The 1 px light rim that separates dark cards from the black background. */
export function rim(colors: ThemeColors): ViewStyle {
  return { borderWidth: 1, borderColor: colors.rim };
}
