import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { mediaUrl } from '@/api/blog';
import { useBlogPosts } from './FeatureGuideLink';

// Shows the newest articles in the page's language. Shows nothing until one is published.
export const LatestArticles: React.FC = () => {
  const { t } = useTranslation();
  const { locale = 'pt' } = useParams<{ locale: string }>();
  const posts = useBlogPosts().slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className="py-20 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">{t('blog.latestTitle', 'From the dev blog')}</h2>
          <Link to={`/${locale}/blog`} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
            {t('blog.latestAll', 'See all articles')} <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/${locale}/blog/${post.slug}`}
                className="block h-full rounded-2xl border border-border/60 bg-card/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
              >
                {post.coverUrl && <img src={mediaUrl(post.coverUrl)} alt="" loading="lazy" className="mb-4 aspect-video w-full rounded-xl object-cover" />}
                <h3 className="text-lg font-bold tracking-tight text-foreground">{post.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
