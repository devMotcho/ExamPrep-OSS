import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { blogApi, type BlogFeatureKey, type BlogPostSummary } from '@/api/blog';

const requests = new Map<string, Promise<BlogPostSummary[]>>();

const postsFor = (locale: string, feature?: BlogFeatureKey) => {
  const key = `${locale}:${feature ?? ''}`;
  if (!requests.has(key)) {
    requests.set(key, blogApi.list(locale, feature).then((found) => (Array.isArray(found) ? found : [])).catch(() => {
      requests.delete(key);
      return [];
    }));
  }
  return requests.get(key)!;
};

export const useBlogPosts = (feature?: BlogFeatureKey) => {
  const { locale = 'pt' } = useParams<{ locale: string }>();
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  useEffect(() => {
    let active = true;
    postsFor(locale, feature).then((found) => { if (active) setPosts(found); });
    return () => { active = false; };
  }, [locale, feature]);
  return posts;
};

// Points a feature's screen to its newest article. Shows nothing until one is published.
export const FeatureGuideLink: React.FC<{ feature: BlogFeatureKey; className?: string }> = ({ feature, className = '' }) => {
  const { t } = useTranslation();
  const { locale = 'pt' } = useParams<{ locale: string }>();
  const [post] = useBlogPosts(feature);
  if (!post) return null;
  return (
    <Link
      to={`/${locale}/blog/${post.slug}`}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline ${className}`}
    >
      <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
      {t('blog.featureLink', 'Read the guide and how it was made')}
    </Link>
  );
};
