import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock } from 'lucide-react';
import { blogApi, mediaUrl, type BlogPostSummary } from '@/api/blog';

export const formatPostDate = (value: string | null, locale: string) =>
  value ? new Date(value).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const BlogList: React.FC = () => {
  const { t } = useTranslation();
  const { locale = 'pt' } = useParams<{ locale: string }>();
  const [result, setResult] = useState<{ locale: string; posts: BlogPostSummary[] | null } | null>(null);

  useEffect(() => {
    let active = true;
    blogApi.list(locale)
      .then((posts) => { if (active) setResult({ locale, posts }); })
      .catch(() => { if (active) setResult({ locale, posts: null }); });
    return () => { active = false; };
  }, [locale]);

  const loaded = result?.locale === locale ? result : null;
  const posts = loaded?.posts ?? null;
  const failed = !!loaded && !posts;
  const [latest, ...others] = posts ?? [];
  const otherLocale = locale === 'pt' ? 'en' : 'pt';
  const [otherResult, setOtherResult] = useState<{ locale: string; hasPosts: boolean } | null>(null);
  const isEmpty = posts?.length === 0;
  const otherHasPosts = otherResult?.locale === otherLocale && otherResult.hasPosts;

  useEffect(() => {
    if (!isEmpty) return;
    let active = true;
    blogApi.list(otherLocale)
      .then((found) => { if (active) setOtherResult({ locale: otherLocale, hasPosts: found.length > 0 }); })
      .catch(() => { /* the link is only a convenience */ });
    return () => { active = false; };
  }, [isEmpty, otherLocale]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-primary">{t('blog.eyebrow', 'Dev blog')}</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{t('blog.title', 'How the platform is built')}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t('blog.subtitle', 'Video guides to each feature, the decisions behind them and what comes next, written by the developer.')}
        </p>
      </header>

      {failed && <p role="alert" className="text-sm font-semibold text-destructive">{t('blog.loadFailed', 'Could not load the articles. Please try again.')}</p>}
      {!posts && !failed && <div aria-hidden="true" className="h-56 animate-pulse rounded-3xl bg-muted/40" />}
      {posts?.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
          <p className="font-semibold text-foreground">{t('blog.emptyTitle', 'No articles yet')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('blog.emptyDesc', 'The first one is on its way.')}</p>
          {otherHasPosts && (
            <Link to={`/${otherLocale}/blog`} lang={otherLocale} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
              {otherLocale === 'pt' ? 'Ler em português' : 'Read in English'}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {latest && (
        <Link
          to={`/${locale}/blog/${latest.slug}`}
          className="group mb-6 block rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 sm:p-10"
        >
          {latest.coverUrl && <img src={mediaUrl(latest.coverUrl)} alt="" loading="lazy" className="mb-6 aspect-video w-full rounded-2xl object-cover" />}
          <PostMeta post={latest} locale={locale} />
          <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{latest.title}</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{latest.excerpt}</p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
            {t('blog.read', 'Read article')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      )}

      {others.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {others.map((post) => (
            <li key={post.id}>
              <Link
                to={`/${locale}/blog/${post.slug}`}
                className="block h-full rounded-2xl border border-border/60 bg-card/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
              >
                {post.coverUrl && <img src={mediaUrl(post.coverUrl)} alt="" loading="lazy" className="mb-4 aspect-video w-full rounded-xl object-cover" />}
                <PostMeta post={post} locale={locale} />
                <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground">{post.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PostMeta: React.FC<{ post: BlogPostSummary; locale: string }> = ({ post, locale }) => {
  const { t } = useTranslation();
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
      <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt, locale)}</time>
      <span className="inline-flex items-center gap-1">
        <Clock aria-hidden="true" className="h-3 w-3" />
        {t('blog.readingTime', '{{minutes}} min read', { minutes: post.readingMinutes })}
      </span>
    </p>
  );
};
