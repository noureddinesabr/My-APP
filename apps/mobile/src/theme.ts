import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, type ViewStyle } from 'react-native';

import { highContrast, palette, type ThemeColors } from '@/lib/palette';

export { Gradients } from '@/lib/palette';

export type { ThemeColors } from '@/lib/palette';
/** 'role' (the default): light for customers, ink dark for drivers, as in the Show it app. */
export type Appearance = 'dark' | 'light' | 'system' | 'role';

/** Plus Jakarta Sans for French and English; Arabic swaps to Noto Kufi Arabic (`arabicFont`). */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

const ARABIC: Record<string, string> = {
  PlusJakartaSans_400Regular: 'NotoKufiArabic_400Regular',
  PlusJakartaSans_500Medium: 'NotoKufiArabic_500Medium',
  PlusJakartaSans_600SemiBold: 'NotoKufiArabic_600SemiBold',
  PlusJakartaSans_700Bold: 'NotoKufiArabic_700Bold',
  PlusJakartaSans_800ExtraBold: 'NotoKufiArabic_800ExtraBold',
};

/** The Arabic face for a Latin one (same weight). */
export function arabicFont(family: string | undefined) {
  return (family && ARABIC[family]) || family;
}

/** 4-pt scale; screens use 16 outer margins and 12 gaps between modules. */
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Cards 22, buttons and fields 16–18, chips pills (the Show it shapes). */
export const Radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export function themeColors(scheme: 'light' | 'dark', contrast = false): ThemeColors {
  return contrast ? { ...palette[scheme], ...highContrast[scheme] } : palette[scheme];
}

type ThemeValue = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  /** The current side of the app, which picks the look when the appearance is 'role'. */
  setRoleScheme: (scheme: 'light' | 'dark') => void;
  /** System "Reduce transparency" (or the in-app switch): floating parts become opaque. */
  reduceTransparency: boolean;
  /** System "Increase contrast" (or the in-app switch). */
  highContrast: boolean;
  setPreference: (key: 'reduceTransparency' | 'highContrast', on: boolean) => void;
};

// v3: the Show it look starts everyone on the role-based appearance.
const STORAGE_KEY = 'xapp.appearance.v3';
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
    appearance: 'role',
    reduceTransparency: false,
    highContrast: false,
  });
  const systemTransparency = useSystemFlag('reduceTransparency');
  const systemContrast = useSystemFlag('highContrast');
  const webTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const webContrast = useMediaQuery('(prefers-contrast: more)');
  const [roleScheme, setRoleScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => value && setSaved((current) => ({ ...current, ...JSON.parse(value) })))
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = saved.appearance === 'role' ? roleScheme : saved.appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : saved.appearance;
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
      setRoleScheme,
      reduceTransparency: saved.reduceTransparency || systemTransparency || webTransparency || highContrast,
      highContrast,
      setPreference: (key, on) => store({ ...saved, [key]: on }),
    };
  }, [saved, system, roleScheme, systemTransparency, systemContrast, webTransparency, webContrast]);

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

/**
 * The light edge on cards and floating parts: a fine lavender border plus a brighter
 * line along the top, as if lit from above.
 */
export function rim(colors: ThemeColors): ViewStyle {
  return { borderWidth: 1, borderColor: colors.rim, boxShadow: `inset 0 1px 0 ${colors.rimHighlight}` };
}
