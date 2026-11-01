import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SEO_PAGES, pageTitle, pageUrl, type SeoLocale } from '../../lib/config/seoPages';
import { useConfig } from '../../lib/config/useConfig';

/**
 * Route-driven head tags. Only pages listed in SEO_PAGES are indexable; every other
 * route (auth, private, admin, study area details, not found) gets noindex by default.
 */
export const SEO: React.FC = () => {
  const { pathname } = useLocation();
  const config = useConfig();
  const siteName = config.company_name;

  // The static tags from the built HTML are not managed by Helmet, so drop them to avoid duplicates.
  useEffect(() => {
    document.querySelectorAll('[data-seo-static]').forEach((el) => el.remove());
  }, []);

  const match = pathname.match(/^\/(pt|en)(\/.*)?$/);
  const locale: SeoLocale = match?.[1] === 'en' ? 'en' : 'pt';
  const path = (match?.[2] ?? '').replace(/\/+$/, '');
  const page = match ? SEO_PAGES.find((p) => p.path === path) : undefined;

  // Article pages set their own head tags once the post has loaded.
  if (/^\/blog\/[^/]+$/.test(path)) return null;

  if (!page) {
    return (
      <Helmet>
        <title>{siteName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
    );
  }

  const isHome = page.path === '';
  const title = (isHome && config.meta_title) || pageTitle(page, locale, siteName);
  const description = (isHome && config.meta_description) || page.text[locale].description;
  const url = pageUrl(locale, page.path);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="pt" href={pageUrl('pt', page.path)} />
      <link rel="alternate" hrefLang="en" href={pageUrl('en', page.path)} />
      <link rel="alternate" hrefLang="x-default" href={pageUrl('pt', page.path)} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale === 'pt' ? 'pt_PT' : 'en_GB'} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:card" content="summary" />
    </Helmet>
  );
};
