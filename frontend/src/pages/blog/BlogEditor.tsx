import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/lib/config/useConfig';
import { ArrowLeft, Bold, Check, Code, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, Loader2, PenLine, Quote, Upload, X } from 'lucide-react';
import { BLOG_FEATURES, blogApi, mediaUrl, type BlogLocale, type BlogPostInput, type BlogStatus } from '@/api/blog';
import { MarkdownArticle } from '@/components/blog/MarkdownArticle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/shared/utils/errors';
import { AuthorSignature } from './BlogPost';

const TEMPLATES: Record<BlogLocale, string> = {
  en: `## What it does

Explain the feature in one or two sentences, from the student's point of view.

## How to use it

<!-- Add a short demonstration here with the "Add video or image" button. -->

1. First step
2. Second step

## How it was made

The decisions, what was tried and why it ended up this way.
`,
  pt: `## O que faz

Explica a funcionalidade em uma ou duas frases, do ponto de vista do estudante.

## Como usar

<!-- Adiciona aqui uma demonstração curta com o botão "Adicionar vídeo ou imagem". -->

1. Primeiro passo
2. Segundo passo

## Como foi feito

As decisões, o que foi experimentado e porque ficou assim.
`,
};

const toSlug = (title: string) =>
  title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

const LOCALES: BlogLocale[] = ['pt', 'en'];

type Versions = Record<BlogLocale, BlogPostInput>;

const blankVersion = (locale: BlogLocale): BlogPostInput => ({
  title: '', slug: '', locale, excerpt: '', contentMd: TEMPLATES[locale], featureKey: '', status: 'DRAFT', coverUrl: '',
});

const hasBody = (version: BlogPostInput) => !!version.contentMd.trim() && version.contentMd !== TEMPLATES[version.locale];
const isEmpty = (version: BlogPostInput) => !version.title.trim() && !hasBody(version);
const isComplete = (version: BlogPostInput) => !!version.title.trim() && !!version.excerpt.trim() && hasBody(version);

const backupKey = (id?: string) => `blog-editor-versions:${id ?? 'new'}`;

const readBackup = (id?: string): Versions | null => {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Versions) : null;
  } catch {
    return null;
  }
};

const clearBackup = (id?: string) => {
  try {
    localStorage.removeItem(backupKey(id));
  } catch { /* the backup is only a convenience */ }
};

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const fieldClass = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export const BlogEditor: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig();
  const { locale = 'pt', id } = useParams<{ locale: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [versions, setVersions] = useState<Versions>({ pt: blankVersion('pt'), en: blankVersion('en') });
  const [ids, setIds] = useState<Partial<Record<BlogLocale, string>>>({});
  const [language, setLanguage] = useState<BlogLocale>(locale === 'en' ? 'en' : 'pt');
  const form = versions[language];
  const setForm = (change: (prev: BlogPostInput) => BlogPostInput) =>
    setVersions((prev) => ({ ...prev, [language]: change(prev[language]) }));
  const [saved, setSaved] = useState<Versions | null>(id ? null : versions);
  const [authorName, setAuthorName] = useState(user?.name ?? '');
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [backup, setBackup] = useState<Versions | null>(() => (id ? null : readBackup()));
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => !!saved && JSON.stringify(saved) !== JSON.stringify(versions), [saved, versions]);

  useEffect(() => {
    if (!id) return;
    Promise.all([blogApi.getForEditing(id), blogApi.listAll()]).then(async ([post, all]) => {
      // The two languages of a post share its slug.
      const other = all.find((item) => item.slug === post.slug && item.locale !== post.locale);
      const otherPost = other ? await blogApi.getForEditing(other.id) : null;
      const next: Versions = { pt: blankVersion('pt'), en: blankVersion('en') };
      [post, otherPost].forEach((item) => {
        if (!item) return;
        next[item.locale] = {
          title: item.title, slug: item.slug, locale: item.locale, excerpt: item.excerpt, contentMd: item.contentMd,
          featureKey: item.featureKey ?? '', status: item.status, coverUrl: item.coverUrl ?? '',
        };
      });
      // A post written before this editor keeps its slug, cover and status on the missing language too.
      const status: BlogStatus = post.status === 'PUBLISHED' || otherPost?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
      const coverUrl = post.coverUrl ?? otherPost?.coverUrl ?? '';
      LOCALES.forEach((item) => {
        next[item] = { ...next[item], slug: post.slug, status, coverUrl, featureKey: next[item].featureKey || (post.featureKey ?? '') };
      });
      setVersions(next);
      setSaved(next);
      setIds({ [post.locale]: post.id, ...(otherPost ? { [otherPost.locale]: otherPost.id } : {}) });
      setAuthorName(post.authorName);
      const stored = readBackup(id);
      if (stored && JSON.stringify(stored) !== JSON.stringify(next)) setBackup(stored);
    }).catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  // Keeps unsaved text across a crash or an expired session.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(backupKey(id), JSON.stringify(versions));
      } catch { /* the backup is only a convenience */ }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, versions, id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (change: Partial<BlogPostInput>) => setForm((prev) => ({ ...prev, ...change }));

  // The address, feature, cover and status belong to the post, not to one language.
  const updateShared = (change: Partial<BlogPostInput>) =>
    setVersions((prev) => ({ pt: { ...prev.pt, ...change }, en: { ...prev.en, ...change } }));

  const save = useCallback(async (status: BlogStatus) => {
    setSaving(true);
    setError(null);
    const missing = status === 'PUBLISHED' ? LOCALES.filter((item) => !isComplete(versions[item])) : [];
    if (missing.length > 0) {
      setLanguage(missing[0]);
      setError(t('blog.editor.bothRequired', 'To publish, fill in the title, summary and content in {{languages}}.', { languages: missing.join(', ').toUpperCase() }));
      setSaving(false);
      return;
    }
    const next: Versions = { pt: { ...versions.pt, status }, en: { ...versions.en, status } };
    const savedIds = { ...ids };
    try {
      for (const item of LOCALES) {
        if (isEmpty(next[item])) continue;
        const known = savedIds[item];
        const post = known ? await blogApi.update(known, next[item]) : await blogApi.create(next[item]);
        savedIds[item] = post.id;
      }
      setVersions(next);
      setSaved(next);
      setSlugTouched(true);
      setBackup(null);
      clearBackup(id);
      toast({ type: 'success', message: status === 'PUBLISHED' ? t('blog.editor.publishedToast', 'Article published.') : t('blog.editor.savedToast', 'Saved.') });
      const target = savedIds[language] ?? savedIds.pt ?? savedIds.en;
      if (!id && target) navigate(`/${locale}/admin/blog/${target}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      // A retry after a failure must not create the first language again.
      setIds(savedIds);
      setSaving(false);
    }
  }, [versions, ids, language, id, locale, navigate, t, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving) save(form.status);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form.status, save, saving]);

  const wrap = (before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end) || placeholder;
    update({ contentMd: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}` });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixLine = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const lineStart = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    update({ contentMd: `${el.value.slice(0, lineStart)}${prefix}${el.value.slice(lineStart)}` });
    requestAnimationFrame(() => el.focus());
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setError(t('blog.editor.tooLarge', '{{name}} is over the 50 MB limit.', { name: file.name }));
      return;
    }
    setUploads((count) => count + 1);
    try {
      const media = await blogApi.uploadMedia(file);
      updateShared({ coverUrl: media.url });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploads((count) => count - 1);
    }
  };

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_MEDIA_BYTES) {
        setError(t('blog.editor.tooLarge', '{{name}} is over the 50 MB limit.', { name: file.name }));
        continue;
      }
      const el = textareaRef.current;
      const marker = `<!-- ${t('blog.editor.uploading', 'Uploading')} ${file.name} -->`;
      const at = el?.selectionStart ?? form.contentMd.length;
      setForm((prev) => ({ ...prev, contentMd: `${prev.contentMd.slice(0, at)}\n\n${marker}\n\n${prev.contentMd.slice(at)}` }));
      setUploads((count) => count + 1);
      try {
        const media = await blogApi.uploadMedia(file);
        const caption = file.name.replace(/\.[^.]+$/, '');
        const markdown = media.contentType.startsWith('video/') ? `![video: ${caption}](${media.url})` : `![${caption}](${media.url})`;
        setForm((prev) => ({ ...prev, contentMd: prev.contentMd.replace(marker, markdown) }));
      } catch (err) {
        setForm((prev) => ({ ...prev, contentMd: prev.contentMd.replace(`\n\n${marker}\n\n`, '') }));
        setError(getErrorMessage(err));
      } finally {
        setUploads((count) => count - 1);
      }
    }
  };

  const tools: { label: string; icon: typeof Bold; prefix?: string; wrap?: [string, string, string] }[] = [
    { label: t('blog.editor.heading2', 'Section heading'), icon: Heading2, prefix: '## ' },
    { label: t('blog.editor.heading3', 'Subheading'), icon: Heading3, prefix: '### ' },
    { label: t('blog.editor.bold', 'Bold'), icon: Bold, wrap: ['**', '**', 'text'] },
    { label: t('blog.editor.italic', 'Italic'), icon: Italic, wrap: ['*', '*', 'text'] },
    { label: t('blog.editor.link', 'Link'), icon: Link2, wrap: ['[', '](https://)', 'text'] },
    { label: t('blog.editor.quote', 'Quote'), icon: Quote, prefix: '> ' },
    { label: t('blog.editor.list', 'List'), icon: List, prefix: '- ' },
    { label: t('blog.editor.code', 'Code block'), icon: Code, wrap: ['```\n', '\n```', 'code'] },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-4 py-5 sm:px-6">
      {/* Top bar and notices stay in reach while writing a long article. */}
      <div className="sticky top-[calc(var(--sat)+4rem)] z-20 -mx-4 space-y-2 bg-background px-4 py-2 sm:top-[calc(var(--sat)+5rem)] sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
        <Link to={`/${locale}/admin/blog`} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" /> {t('blog.manage.title', 'Articles')}
        </Link>
        <span aria-live="polite" className="text-xs font-medium text-muted-foreground">
          {uploads > 0 ? t('blog.editor.uploadingFiles', 'Uploading…') : dirty ? t('blog.editor.unsaved', 'Unsaved changes') : t('blog.editor.allSaved', 'All changes saved')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {form.status === 'PUBLISHED' && (
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => save('DRAFT')} className="rounded-xl text-xs">{t('blog.editor.unpublish', 'Back to draft')}</Button>
          )}
          {form.status === 'DRAFT' && (
            <Button variant="outline" size="sm" disabled={saving || !form.slug} onClick={() => save('DRAFT')} className="rounded-xl text-xs font-semibold">{t('blog.editor.saveDraft', 'Save draft')}</Button>
          )}
          <Button size="sm" disabled={saving || uploads > 0 || !form.slug} onClick={() => save('PUBLISHED')} className="gap-2 rounded-xl text-xs font-semibold">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {form.status === 'PUBLISHED' ? t('blog.editor.update', 'Update article') : t('blog.editor.publish', 'Publish')}
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-background px-4 py-2.5 text-sm font-semibold text-destructive">{error}</p>}
      {backup && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-background px-4 py-2.5 text-sm">
          <span className="text-foreground/90">{t('blog.editor.backupFound', 'There is an unsaved copy of this article in this browser.')}</span>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { setVersions(backup); setBackup(null); setSlugTouched(true); }}>{t('blog.editor.restore', 'Restore')}</Button>
          <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => { clearBackup(id); setBackup(null); }}>{t('blog.editor.discard', 'Discard')}</Button>
        </div>
      )}

      </div>

      {/* Keeps a focused field clear of the sticky bar. */}
      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 md:grid-cols-[1fr_1fr_7rem_14rem] [&_input]:scroll-mt-48 [&_select]:scroll-mt-48">
        <div className="space-y-1">
          <Label htmlFor="blog-title" className="text-xs font-semibold">{t('blog.editor.titleLabel', 'Title')}</Label>
          <Input
            id="blog-title"
            maxLength={160}
            value={form.title}
            onChange={(e) => {
              update({ title: e.target.value });
              // The address follows the first title only, so translating never changes it.
              if (!slugTouched && !versions[language === 'pt' ? 'en' : 'pt'].title.trim()) updateShared({ slug: toSlug(e.target.value) });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="blog-slug" className="text-xs font-semibold">{t('blog.editor.slugLabel', 'Address')}</Label>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">/{form.locale}/blog/</span>
            <Input id="blog-slug" maxLength={120} value={form.slug} onChange={(e) => { setSlugTouched(true); updateShared({ slug: toSlug(e.target.value) }); }} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{t('blog.editor.languageLabel', 'Language')}</Label>
          <div id="blog-locale" role="group" aria-label={t('blog.editor.languageLabel', 'Language')} className="flex rounded-xl border border-input p-0.5">
            {LOCALES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={language === item}
                onClick={() => setLanguage(item)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold uppercase ${language === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {item}
                {isComplete(versions[item]) && <Check aria-label={t('blog.editor.versionReady', 'ready')} className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="blog-feature" className="text-xs font-semibold">{t('blog.editor.featureLabel', 'Show on the feature')}</Label>
          <select id="blog-feature" className={fieldClass} value={form.featureKey} onChange={(e) => updateShared({ featureKey: e.target.value })}>
            <option value="">{t('blog.editor.noFeature', 'None')}</option>
            {BLOG_FEATURES.map((feature) => <option key={feature.key} value={feature.key}>{feature.label}</option>)}
          </select>
        </div>
        <div className="space-y-1 md:col-span-4">
          <Label htmlFor="blog-excerpt" className="text-xs font-semibold">{t('blog.editor.excerptLabel', 'Summary (shown in the list and in search results)')}</Label>
          <Input id="blog-excerpt" maxLength={300} value={form.excerpt} onChange={(e) => update({ excerpt: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-4">
          {form.coverUrl && <img src={mediaUrl(form.coverUrl)} alt="" className="h-16 w-28 rounded-lg border border-border/60 object-cover" />}
          <Button type="button" variant="outline" size="sm" onClick={() => coverRef.current?.click()} className="gap-1.5 rounded-xl text-xs font-semibold">
            <ImagePlus className="h-3.5 w-3.5" /> {form.coverUrl ? t('blog.editor.changeCover', 'Change thumbnail') : t('blog.editor.addCover', 'Add thumbnail')}
          </Button>
          {form.coverUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => updateShared({ coverUrl: '' })} className="gap-1.5 rounded-xl text-xs">
              <X className="h-3.5 w-3.5" /> {t('blog.editor.removeCover', 'Remove')}
            </Button>
          )}
          <input
            ref={coverRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      </div>

      <div className="flex rounded-xl border border-border/60 p-1 lg:hidden" role="group" aria-label={t('blog.editor.view', 'View')}>
        {([['write', PenLine, t('blog.editor.write', 'Write')], ['preview', Eye, t('blog.editor.preview', 'Preview')]] as const).map(([tab, Icon, label]) => (
          <button
            key={tab}
            type="button"
            aria-pressed={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${mobileTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('blog.editor.write', 'Write')} className={`${mobileTab === 'write' ? 'flex' : 'hidden'} h-[calc(100vh-11rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 lg:flex`}>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 p-2">
            {tools.map(({ label, icon: Icon, prefix, wrap: pair }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="icon"
                title={label}
                aria-label={label}
                onClick={() => (prefix ? prefixLine(prefix) : pair && wrap(...pair))}
                className="h-8 w-8"
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="ml-auto h-8 gap-1.5 rounded-lg text-xs font-semibold">
              <Upload className="h-3.5 w-3.5" /> {t('blog.editor.addMedia', 'Add video or image')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            />
          </div>
          <textarea
            ref={textareaRef}
            aria-label={t('blog.editor.contentLabel', 'Article content in Markdown')}
            spellCheck
            value={form.contentMd}
            onChange={(e) => update({ contentMd: e.target.value })}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) { e.preventDefault(); uploadFiles(files); }
            }}
            className={`flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-7 text-foreground focus:outline-none ${dragging ? 'ring-2 ring-inset ring-primary' : ''}`}
          />
          <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
            {t('blog.editor.hint', 'Markdown. Drag a file here to upload it (up to 50 MB). Ctrl or Cmd + S saves.')}
          </p>
        </section>

        <section aria-label={t('blog.editor.preview', 'Preview')} className={`${mobileTab === 'preview' ? 'block' : 'hidden'} h-[calc(100vh-11rem)] min-h-[32rem] overflow-y-auto rounded-2xl border border-border/60 bg-background p-6 sm:p-10 lg:block`}>
          {form.coverUrl && <img src={mediaUrl(form.coverUrl)} alt="" className="mb-6 aspect-video w-full rounded-2xl border border-border/60 object-cover" />}
          <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
            {form.title || <span className="text-muted-foreground/50">{t('blog.editor.titleLabel', 'Title')}</span>}
          </h1>
          {form.excerpt && <p className="mt-4 mb-8 text-lg leading-relaxed text-muted-foreground">{form.excerpt}</p>}
          <div className="mt-8"><MarkdownArticle markdown={form.contentMd} /></div>
          <div className="mt-12 border-t border-border/50 pt-6"><AuthorSignature name={authorName || config.company_name} /></div>
        </section>
      </div>
    </div>
  );
};
