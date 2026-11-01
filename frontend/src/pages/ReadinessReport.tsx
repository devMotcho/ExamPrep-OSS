import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileDown, Gauge } from 'lucide-react';
import { examprepApi, type Readiness } from '@/api/examprep';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useLocale } from '@/hooks/useLocale';
import { formatDecimal } from '@/lib/format';
import { printReport, ReadinessPrint, useBandLabel } from '@/components/reports/PrintableReport';

export const ReadinessReport: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();
  const bandLabel = useBandLabel();
  const [report, setReport] = useState<Readiness | null>(null);
  const [error, setError] = useState<number | null>(null);

  useEffect(() => {
    setError(null);
    examprepApi.getReadiness(id).then(setReport).catch((err) => setError(err?.response?.status ?? 500));
  }, [id]);

  const back = (
    <Button render={<Link to={`/${locale}/study-areas/${id}`} />} variant="ghost" size="sm" className="min-h-11 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('readiness.backToArea', 'Back to the area')}
    </Button>
  );

  if (error !== null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-2 sm:py-8">
        {back}
        <Card className="rounded-2xl border border-border/50 bg-card/65 p-5 text-sm text-foreground">
          {error === 403
            ? t('readiness.noAccess', 'You no longer have access to this study area.')
            : t('readiness.loadFailed', 'We could not load this report right now.')}
        </Card>
      </div>
    );
  }

  if (!report) return <PageSkeleton />;

  const insufficient = report.band === 'INSUFFICIENT_DATA';
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const answersMissing = Math.max(0, report.minAnswers - report.answersCounted);

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2 sm:py-8">
      {back}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-foreground">{t('readiness.title', 'Readiness report')}</h1>
          <p className="text-sm text-muted-foreground truncate">{report.areaTitle}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => printReport(`${t('readiness.title', 'Readiness report')} - ${report.areaTitle}`)} className="min-h-11 rounded-xl font-semibold gap-2 shrink-0">
          <FileDown className="h-4 w-4" aria-hidden="true" /> {t('report.exportPdf', 'Export PDF')}
        </Button>
      </div>

      <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6 space-y-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Gauge className="h-4 w-4" aria-hidden="true" /> {t('readiness.estimateTitle', 'Estimate')}
        </h2>
        {insufficient ? (
          <>
            <p className="text-2xl font-black text-foreground">{bandLabel(report.band)}</p>
            <p className="text-sm text-foreground leading-normal">
              {t('readiness.insufficientDesc', 'We only show an estimate from {{answers}} answers and {{coverage}}% of the questions seen. You have {{have}} answers and {{seen}}%.', { answers: report.minAnswers, coverage: report.minCoveragePercent, have: report.answersCounted, seen: report.coveragePercent })}
              {answersMissing > 0 && ` ${t('readiness.answersMissing', 'That is {{count}} answers to go.', { count: answersMissing })}`}
            </p>
          </>
        ) : (
          <p className="text-3xl font-black text-foreground">{report.estimatePercent}% <span className="text-lg font-bold">· {bandLabel(report.band)}</span></p>
        )}
        <p className="text-xs text-muted-foreground leading-normal">{t('readiness.disclaimer', 'This is an estimate from your practice here. It is not a grade forecast and promises no result.')}</p>
      </Card>

      <Card className="rounded-2xl border border-border/50 bg-card/65 p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-black text-foreground">{t('readiness.basisTitle', 'What it is based on')}</h2>
        <ul className="space-y-1.5 text-sm text-foreground list-disc pl-5">
          <li>{t('readiness.basisCoverage', 'Questions seen: {{seen}} of {{total}} ({{percent}}%)', { seen: report.seen, total: report.questionCount, percent: report.coveragePercent })}</li>
          <li>{t('readiness.basisAnswers', '{{answers}} answers in {{sessions}} sessions. Reviewing mistakes and marked questions does not count.', { answers: report.answersCounted, sessions: report.sessionsCounted })}</li>
          {report.lastActivityAt && <li>{t('readiness.basisLast', 'Last answer: {{date}}', { date: date(report.lastActivityAt) })}</li>}
          <li>
            {report.simulationAveragePercent !== null
              ? t('readiness.basisFormulaSim', 'Calculation: 60% chapter mastery, where what you have not seen counts as zero, and 40% the average of your latest simulations.')
              : t('readiness.basisFormula', 'Calculation: chapter mastery, where what you have not seen counts as zero. There are no simulations yet.')}
          </li>
        </ul>
      </Card>

      <Card className="rounded-2xl border border-border/50 bg-card/65 p-5 sm:p-6 space-y-3">
        <div>
          <h2 className="text-base font-black text-foreground">{t('readiness.chaptersTitle', 'By chapter')}</h2>
          <p className="text-xs text-muted-foreground">{t('readiness.chaptersHelp', 'Accuracy over your last {{count}} answers in each chapter.', { count: report.answersPerChapterWindow })}</p>
        </div>
        {report.chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('readiness.noQuestions', 'This area has no questions yet.')}</p>
        ) : (
          <ul className="space-y-3">
            {report.chapters.map((c) => (
              <li key={c.chapterId ?? 'none'} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-foreground min-w-0 break-words">{c.title ?? t('readiness.noChapter', 'No chapter')}</span>
                  <span className="shrink-0 font-bold text-muted-foreground text-xs">
                    {c.recentAccuracyPercent !== null ? `${c.recentAccuracyPercent}%` : t('readiness.chapterInsufficient', 'Insufficient data')}
                  </span>
                </div>
                <div role="progressbar" aria-label={c.title ?? t('readiness.noChapter', 'No chapter')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.recentAccuracyPercent ?? 0} className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.recentAccuracyPercent ?? 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('readiness.chapterBasis', '{{seen}} of {{total}} questions seen · {{answers}} recent answers', { seen: c.seen, total: c.questionCount, answers: c.recentAnswers })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="rounded-2xl border border-border/50 bg-card/65 p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-black text-foreground">{t('readiness.simulationsTitle', 'Latest simulations')}</h2>
        {report.simulations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('readiness.noSimulations', 'No simulations yet. Only sessions started with the Exam simulation preset count here.')}</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {report.simulations.map((s) => (
              <li key={s.sessionId}>
                <Link to={`/${locale}/exam/${s.sessionId}/result`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm rounded-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-foreground">{date(s.completedAt)}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-foreground tabular-nums">{formatDecimal(s.score, i18n.language)} / 20</span>
                    <Badge variant="outline" className={s.passed ? 'border-success/40 bg-success/10 text-foreground' : 'border-destructive/40 bg-destructive/10 text-foreground'}>
                      {s.passed ? t('report.passed', 'Passed') : t('report.notPassed', 'Below the minimum')}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReadinessPrint report={report} />
    </div>
  );
};
