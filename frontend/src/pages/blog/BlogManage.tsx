import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { blogApi, type BlogLocale, type BlogPostSummary } from '@/api/blog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/shared/utils/errors';
import { formatPostDate } from './BlogList';

// The two languages of an article share a slug, so the list shows them as one row.
const groupBySlug = (posts: BlogPostSummary[]) => {
  const groups = new Map<string, BlogPostSummary[]>();
  posts.forEach((post) => groups.set(post.slug, [...(groups.get(post.slug) ?? []), post]));
  return [...groups.values()];
};

const LOCALES: BlogLocale[] = ['pt', 'en'];

export const BlogManage: React.FC = () => {
  const { t } = useTranslation();
  const { locale = 'pt' } = useParams<{ locale: string }>();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [toDelete, setToDelete] = useState<BlogPostSummary[] | null>(null);

  useEffect(() => {
    blogApi.listAll().then(setPosts).catch((err) => {
      setPosts([]);
      toast({ type: 'error', message: getErrorMessage(err) });
    });
  }, [toast]);

  const remove = async () => {
    if (!toDelete) return;
    try {
      await Promise.all(toDelete.map((post) => blogApi.remove(post.id)));
      setPosts((prev) => prev?.filter((post) => post.slug !== toDelete[0].slug) ?? null);
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('blog.manage.title', 'Articles')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('blog.manage.subtitle', 'Only developers can see drafts and publish.')}</p>
        </div>
        <Link to={`/${locale}/admin/blog/new`} className={buttonVariants({ className: 'gap-2 rounded-xl font-semibold' })}>
          <Plus className="h-4 w-4" /> {t('blog.manage.new', 'New article')}
        </Link>
      </header>

      {posts?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {t('blog.manage.empty', 'Nothing here yet. The blog stays out of the menus until an article is published.')}
        </div>
      )}

      <ul className="space-y-3">
        {posts && groupBySlug(posts).map((group) => {
          const post = group.find((item) => item.locale === locale) ?? group[0];
          return (
            <li key={post.slug} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="min-w-0 flex-1">
                <Link to={`/${locale}/admin/blog/${post.id}`} className="font-bold text-foreground hover:text-primary">{post.title}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {LOCALES.map((item) => {
                    const version = group.find((candidate) => candidate.locale === item);
                    return (
                      <Badge key={item} variant={version?.status === 'PUBLISHED' ? 'default' : 'outline'} className="uppercase">
                        {item} · {!version ? t('blog.manage.missing', 'Missing') : version.status === 'PUBLISHED' ? t('blog.manage.published', 'Published') : t('blog.manage.draft', 'Draft')}
                      </Badge>
                    );
                  })}
                  <span>/{post.slug}</span>
                  {post.featureKey && <span>· {post.featureKey}</span>}
                  <span>· {formatPostDate(post.updatedAt, locale)}</span>
                </div>
              </div>
              <Link to={`/${locale}/admin/blog/${post.id}`} aria-label={t('blog.edit', 'Edit')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                <Pencil className="h-4 w-4" />
              </Link>
              <Button variant="ghost" size="icon" aria-label={t('blog.manage.delete', 'Delete')} onClick={() => setToDelete(group)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <ConfirmDeleteDialog
        isOpen={!!toDelete}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        onConfirm={remove}
        itemName={toDelete?.[0].title}
      />
    </div>
  );
};
