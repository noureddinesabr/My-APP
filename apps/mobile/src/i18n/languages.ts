export const LANGUAGES = ['ar', 'fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Used when the phone is set to a language we don't support. Most phones in Morocco use French. */
export const FALLBACK_LANGUAGE: Language = 'fr';

export const LANGUAGE_NAMES: Record<Language, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
};

export function isRTL(language: Language) {
  return language === 'ar';
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Picks the first supported language from the phone's preferred list, e.g. ['fr-MA', 'ar-MA']. */
export function resolveDeviceLanguage(languageCodes: (string | null | undefined)[]): Language {
  for (const code of languageCodes) {
    const base = code?.split('-')[0]?.toLowerCase();
    if (isLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}
