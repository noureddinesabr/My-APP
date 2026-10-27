import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { I18nManager, Platform, View } from 'react-native';

import i18n from './index';
import { isLanguage, isRTL, resolveDeviceLanguage, type Language } from './languages';

const STORAGE_KEY = 'xapp.language';

type LanguageContextValue = {
  language: Language;
  /** True when the user hasn't picked a language and we follow the phone. */
  followsDevice: boolean;
  rtl: boolean;
  setLanguage: (language: Language | 'device') => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function deviceLanguage() {
  return resolveDeviceLanguage(getLocales().map((locale) => locale.languageCode));
}

function applyDirection(language: Language) {
  if (Platform.OS === 'web') {
    const rtl = isRTL(language);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    return;
  }
  // Our root view's `direction` below lays Arabic out right to left, as on the web.
  // The phone's own RTL mode stays off: with both on, sides were flipped twice (e.g.
  // the ☰ menu opened on the left). Turning it off takes effect on the next launch.
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  I18nManager.swapLeftAndRightInRTL(false);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(null);
  const [followsDevice, setFollowsDevice] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        const chosen = isLanguage(saved) ? saved : deviceLanguage();
        setFollowsDevice(!isLanguage(saved));
        setLanguageState(chosen);
      });
  }, []);

  useEffect(() => {
    if (!language) return;
    i18n.changeLanguage(language);
    applyDirection(language);
  }, [language]);

  const setLanguage = useCallback((next: Language | 'device') => {
    if (next === 'device') {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      setFollowsDevice(true);
      setLanguageState(deviceLanguage());
    } else {
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      setFollowsDevice(false);
      setLanguageState(next);
    }
  }, []);

  if (!language) return null;

  const rtl = isRTL(language);
  return (
    <LanguageContext.Provider value={{ language, followsDevice, rtl, setLanguage }}>
      <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>{children}</View>
    </LanguageContext.Provider>
  );
}

/**
 * `{ direction }` for the root of a layer that starts its own layout, like a Modal (a separate
 * window on Android, which doesn't inherit the app's right-to-left direction).
 */
export function useDirectionStyle() {
  const { rtl } = useLanguage();
  return { direction: rtl ? ('rtl' as const) : ('ltr' as const) };
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
