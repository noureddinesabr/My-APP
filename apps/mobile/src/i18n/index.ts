import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar';
import en from './locales/en';
import fr from './locales/fr';

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
