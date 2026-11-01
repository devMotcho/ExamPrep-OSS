import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const SUPPORTED_LOCALES = ['en', 'pt'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'pt';

export const getDetectedLocale = (): Locale => {
  const savedLocale = localStorage.getItem('locale') as Locale | null;
  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
    return savedLocale;
  }
  
  return DEFAULT_LOCALE;
};

export const useLocale = () => {
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();

  const currentLocale: Locale = SUPPORTED_LOCALES.includes(locale as any) ? (locale as Locale) : DEFAULT_LOCALE;

  useEffect(() => {
    if (i18n.language !== currentLocale) {
      i18n.changeLanguage(currentLocale);
      window.dispatchEvent(new Event('app-config-updated'));
    }
  }, [currentLocale, i18n]);

  const setLocale = (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    localStorage.setItem('locale', newLocale);
    window.dispatchEvent(new Event('app-config-updated'));
    
    const segments = location.pathname.split('/');
    if (SUPPORTED_LOCALES.includes(segments[1] as any)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    
    const newPath = segments.join('/');
    navigate(newPath + location.search + location.hash, { replace: true });
  };

  return {
    locale: currentLocale,
    setLocale,
  };
};
