import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, Play, Trash2 } from 'lucide-react';
import { examprepApi, type QuestionMark } from '@/api/examprep';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useToast } from '@/context/ToastContext';
import { useLocale } from '@/hooks/useLocale';
import { handleSessionStartError } from '@/lib/sessionStartError';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

/** Everything the user marked or wrote, per area. It keeps working after a question is deleted. */
export const MarkedQuestions: React.FC = () => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const areaFilter = params.get('area') ?? undefined;

  const [rows, setRows] = useState<QuestionMark[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    examprepApi.listQuestionMarks(areaFilter).then(setRows).catch(() => setFailed(true));
  }, [areaFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { areaId: string | null; title: string; rows: QuestionMark[] }>();
    (rows ?? []).forEach((row) => {
      const key = row.studyAreaId ?? `gone:${row.areaTitle}`;
      if (!map.has(key)) map.set(key, { areaId: row.studyAreaId, title: row.areaTitle, rows: [] });
      map.get(key)!.rows.push(row);
    });
    return [...map.values()];
  }, [rows]);

  const remove = async (row: QuestionMark, action: () => Promise<void>, next: QuestionMark | null) => {
    const previous = rows;
    setRows((current) => (current ?? []).flatMap((r) => (r.id !== row.id ? [r] : next ? [next] : [])));
    try {
      await action();
    } catch {
      setRows(previous);
      toast({ type: 'error', message: t('marks.errors.deleteFailed', 'Could not delete. Please try again.') });
    }
  };

  const practise = async (areaId: string) => {
    setStarting(true);
    try {
      const session = await examprepApi.practiceMarked(areaId);
      navigate(`/${locale}/exam/${session.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId: areaId, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  if (!rows && !failed) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary shrink-0" aria-hidden="true" />
        {t('marks.title', 'Marks and notes')}
      </h1>

      {failed && <p role="alert" className="text-sm text-foreground">{t('marks.loadFailed', 'We could not load your marks right now.')}</p>}

      {rows?.length === 0 && (
        <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-6 text-center text-sm text-muted-foreground">
          {t('marks.empty', 'Nothing marked yet. Mark a question during an exam, in the results or in the study area.')}
        </Card>
      )}

      {groups.map((group) => {
        const practisable = group.rows.filter((r) => r.marked && r.status === 'AVAILABLE').length;
        return (
          <section key={group.areaId ?? group.title} className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-black text-foreground min-w-0 break-words">{group.title}</h2>
              {group.areaId && practisable > 0 && (
                <Button type="button" disabled={starting} onClick={() => practise(group.areaId!)} className="min-h-11 rounded-xl font-bold gap-2 shrink-0">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {t('marks.practise', 'Practise marked ({{count}})', { count: practisable })}
                </Button>
              )}
            </div>
            <ul className="space-y-2">
              {group.rows.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border/50 bg-card/65 p-4 space-y-2">
                  {row.status === 'AVAILABLE' && row.prompt ? (
                    <div className="text-sm font-semibold text-foreground prose dark:prose-invert max-w-none line-clamp-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.prompt) }} />
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      {row.status === 'NO_ACCESS'
                        ? t('marks.noAccess', 'You no longer have access to this question.')
                        : t('marks.questionDeleted', 'This question was deleted. Your note stays here.')}
                    </p>
                  )}
                  {row.note && <p className="whitespace-pre-wrap break-words rounded-xl border border-border/50 bg-muted/30 p-3 text-xs text-foreground">{row.note}</p>}
                  <div className="flex flex-wrap gap-2">
                    {row.marked && (
                      <Button type="button" variant="outline" size="sm" onClick={() => remove(row, () => examprepApi.unmarkQuestion(row.id), row.note ? { ...row, marked: false } : null)} className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold">
                        <Bookmark className="h-4 w-4 fill-primary text-primary" aria-hidden="true" /> {t('marks.unmark', 'Remove mark')}
                      </Button>
                    )}
                    {row.note && (
                      <Button type="button" variant="outline" size="sm" onClick={() => remove(row, () => examprepApi.deleteQuestionNote(row.id), row.marked ? { ...row, note: null } : null)} className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold">
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('marks.deleteNote', 'Delete note')}
                      </Button>
                    )}
                    {row.status === 'AVAILABLE' && row.studyAreaId && (
                      <Button render={<Link to={`/${locale}/study-areas/${row.studyAreaId}`} />} variant="ghost" size="sm" className="min-h-11 rounded-xl text-xs font-semibold">
                        {t('marks.openArea', 'Open area')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
