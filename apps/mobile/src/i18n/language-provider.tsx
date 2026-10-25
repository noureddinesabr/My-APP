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
  const rtl = isRTL(language);
  if (Platform.OS === 'web') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    return;
  }
  // Native screens (headers, swipe-back) read this on the next launch; the root
  // view's `direction` below flips our own layout immediately.
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
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

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
