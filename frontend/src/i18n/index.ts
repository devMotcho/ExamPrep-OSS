import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import ptTranslations from './locales/pt.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  pt: {
    translation: ptTranslations,
  },
};

// Initialize i18next synchronously to prevent translation flashes
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: window.location.pathname.split('/')[1] === 'en' ? 'en' : 'pt', // Kept in sync with the URL by useLocale
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
  });

export default i18n;
