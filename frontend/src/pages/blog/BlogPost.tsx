import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, Languages } from 'lucide-react';
import { blogApi, mediaUrl, type BlogLocale, type BlogPost as Post } from '@/api/blog';
import { extractHeadings, MarkdownArticle } from '@/components/blog/MarkdownArticle';
import { siteUrl } from '@/lib/config/seoPages';
import { useConfig } from '@/lib/config/useConfig';
import { formatPostDate } from './BlogList';
import { useAuth } from '@/context/AuthContext';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

export const AuthorSignature: React.FC<{ name: string }> = ({ name }) => {
  const { t } = useTranslation();
  const config = useConfig();
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/40 p-5">
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-black text-primary-foreground">
        {initials(name)}
      </span>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{t('blog.writtenBy', 'Written by')}</p>
        <p className="font-bold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{t('blog.authorRole', 'Developer of {{site}}', { site: config.company_name })}</p>
      </div>
    </div>
  );
};

export const BlogPost: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig();
  const { locale = 'pt', slug = '' } = useParams<{ locale: string; slug: string }>();
  const { user } = useAuth();
  const requestKey = `${locale}/${slug}`;
  const [result, setResult] = useState<{ key: string; post: Post | null; status: 'ready' | 'missing' | 'failed'; otherLocale?: BlogLocale } | null>(null);

  useEffect(() => {
    let active = true;
    blogApi.get(locale, slug)
      .then((post) => {
        if (active) setResult({ key: requestKey, post, status: 'ready' });
      })
      .catch(async (err) => {
        if (err?.response?.status !== 404) {
          if (active) setResult({ key: requestKey, post: null, status: 'failed' });
          return;
        }
        // Switching language on an article with no translation should lead back to it.
        const other: BlogLocale = locale === 'pt' ? 'en' : 'pt';
        const exists = await blogApi.get(other, slug).then(() => true, () => false);
        if (active) setResult({ key: requestKey, post: null, status: 'missing', otherLocale: exists ? other : undefined });
      });
    return () => { active = false; };
  }, [locale, slug, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const post = current?.post ?? null;
  const status = current?.status ?? 'loading';

  const headings = useMemo(() => extractHeadings(post?.contentMd ?? ''), [post]);
  const backLink = (
    <Link to={`/${locale}/blog`} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" /> {t('blog.back', 'All articles')}
    </Link>
  );

  if (status !== 'ready' || !post) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        {status === 'loading' && <div aria-hidden="true" className="h-72 animate-pulse rounded-3xl bg-muted/40" />}
        {status !== 'loading' && (
          <>
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
            <p className="mb-4 font-semibold text-foreground">
              {current?.otherLocale ? t('blog.notInLanguage', 'This article is not available in this language yet.') : status === 'missing' ? t('blog.notFound', 'This article does not exist or is not published.') :t('blog.loadFailed', 'Could not load the articles. Please try again.')}
            </p>
            {current?.otherLocale && (
              <Link to={`/${current.otherLocale}/blog/${slug}`} lang={current.otherLocale} className="mb-4 flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                <Languages aria-hidden="true" className="h-4 w-4" />
                {current.otherLocale === 'pt' ? 'Ler em português' : 'Read in English'}
              </Link>
            )}
            {backLink}
          </>
        )}
      </div>
    );
  }

  const base = siteUrl();
  const url = `${base}/${locale}/blog/${post.slug}`;
  const pageTitle = `${post.title} | ${config.company_name}`;
  const cover = post.coverUrl ? mediaUrl(post.coverUrl) : null;
  const shareImage = !cover ? null : cover.startsWith('http') ? cover : `${base}${cover}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={post.excerpt} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        {post.translations.map((other) => (
          <link key={other} rel="alternate" hrefLang={other} href={`${base}/${other}/blog/${post.slug}`} />
        ))}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        {shareImage && <meta property="og:image" content={shareImage} />}
        <meta name="twitter:card" content={shareImage ? 'summary_large_image' : 'summary'} />
      </Helmet>

      <article className="min-w-0 max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          {backLink}
          {(user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_DEV') && (
            <Link to={`/${locale}/admin/blog/${post.id}`} className="text-xs font-bold text-primary hover:underline">{t('blog.edit', 'Edit')}</Link>
          )}
        </div>
        {cover && <img src={cover} alt="" className="mb-8 aspect-video w-full rounded-2xl border border-border/60 object-cover shadow-lg" />}
        <header className="mb-10">
          <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl">{post.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
            <span className="font-bold text-foreground">{post.authorName}</span>
            <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt, locale)}</time>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="h-3 w-3" />
              {t('blog.readingTime', '{{minutes}} min read', { minutes: post.readingMinutes })}
            </span>
            {post.translations.map((other) => (
              <Link key={other} to={`/${other}/blog/${post.slug}`} lang={other} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                <Languages aria-hidden="true" className="h-3 w-3" />
                {other === 'pt' ? 'Ler em português' : 'Read in English'}
              </Link>
            ))}
          </p>
        </header>

        <MarkdownArticle markdown={post.contentMd} />

        <footer className="mt-14 border-t border-border/50 pt-8">
          <AuthorSignature name={post.authorName} />
        </footer>
      </article>

      {headings.length > 1 && (
        <nav aria-label={t('blog.onThisPage', 'On this page')} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{t('blog.onThisPage', 'On this page')}</p>
            <ul className="space-y-2 border-l border-border/60">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`} className="block -ml-px border-l border-transparent pl-3 text-xs font-medium leading-snug text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
};
