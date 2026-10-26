import { useTranslation } from 'react-i18next';

import { useLanguage } from '@/i18n/language-provider';
import type { Language } from '@/i18n/languages';
import { dayKey, fromLocalString } from '@/lib/schedule';

const LOCALES: Record<Language, string> = { ar: 'ar-MA', fr: 'fr-MA', en: 'en-GB' };

function format(locale: string, date: Date, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, numberingSystem: 'latn' }).format(date);
  } catch {
    return date.toDateString();
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date labels in the app language, Western digits, 24-hour time as used in Morocco. */
export function useDateFormat() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = LOCALES[language];

  const relativeDay = (date: Date, now = new Date()) => {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (dayKey(date) === dayKey(now)) return t('request.today');
    if (dayKey(date) === dayKey(tomorrow)) return t('request.tomorrow');
    return null;
  };

  return {
    weekday: (date: Date) => format(locale, date, { weekday: 'short' }),
    month: (date: Date) => format(locale, date, { month: 'short' }),
    time: (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    relativeDay,
    /** "Today 14:05" / "Thu 30 Oct 09:30", for past events in lists. */
    dayTime: (date: Date) =>
      `${relativeDay(date) ?? format(locale, date, { weekday: 'short', day: 'numeric', month: 'short' })} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    /** "Tomorrow at 09:30" / "Thu 30 Oct at 14:00". */
    pickupAt: (value: string) => {
      const date = fromLocalString(value);
      const day = relativeDay(date) ?? format(locale, date, { weekday: 'short', day: 'numeric', month: 'short' });
      return t('request.pickupAt', { date: day, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` });
    },
  };
}
