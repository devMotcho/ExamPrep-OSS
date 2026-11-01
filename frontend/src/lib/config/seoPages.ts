/**
 * Single source of page metadata. Imported by the SEO component at runtime and by
 * vite.config.ts at build time, so it must stay free of browser and Vite-only imports.
 */
export const SITE_NAME = 'ExamPrep';

/** VITE_SITE_URL wins, then the current origin. Empty at build time unless the build passes one. */
export const siteUrl = (override?: string): string => {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SITE_URL;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (override || env || origin).replace(/\/$/, '');
};

export type SeoLocale = 'pt' | 'en';

interface PageText {
  title: string;
  description: string;
}

export interface SeoPage {
  /** Path after the locale prefix, '' for the landing page. */
  path: string;
  /** Emit a static HTML file for /pt{path} at build time. */
  prerender: boolean;
  text: Record<SeoLocale, PageText>;
}

export const SEO_PAGES: SeoPage[] = [
  {
    path: '',
    prerender: true,
    text: {
      pt: {
        title: 'Exames de escolha múltipla para estudantes',
        description: 'Treina para os teus exames com perguntas de escolha múltipla, nota de 0 a 20 e revisão de cada resposta.',
      },
      en: {
        title: 'Multiple-choice exam practice for students',
        description: 'Practise for your exams with multiple-choice questions, a 0–20 grade and a review of every answer.',
      },
    },
  },
  {
    path: '/blog',
    prerender: false,
    text: {
      pt: {
        title: 'Dev blog',
        description: 'Guias de cada funcionalidade e as decisões por trás delas.',
      },
      en: {
        title: 'Dev blog',
        description: 'Guides to each feature and the decisions behind them.',
      },
    },
  },
  {
    path: '/contact',
    prerender: true,
    text: {
      pt: {
        title: 'Contactos',
        description: 'Tens uma dúvida ou uma sugestão? Fala connosco.',
      },
      en: {
        title: 'Contact',
        description: 'Got a question or a suggestion? Get in touch.',
      },
    },
  },
  {
    path: '/study-areas',
    prerender: false,
    text: {
      pt: {
        title: 'Áreas de estudo públicas',
        description: 'Explora áreas de estudo partilhadas por outros estudantes e pratica com as suas questões.',
      },
      en: {
        title: 'Public study areas',
        description: 'Browse study areas shared by other students and practise with their questions.',
      },
    },
  },
];

/** Locale-prefixed URL. hreflang x-default points at Portuguese, the default locale. */
export const pageUrl = (locale: SeoLocale, path: string, base = siteUrl()): string => `${base}/${locale}${path}`;

/** The landing page leads with the site name; every other page ends with it. */
export const pageTitle = (page: SeoPage, locale: SeoLocale, siteName: string = SITE_NAME): string =>
  page.path === '' ? `${siteName} | ${page.text[locale].title}` : `${page.text[locale].title} | ${siteName}`;
