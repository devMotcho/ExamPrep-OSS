import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, FileDown, FileText, Target } from 'lucide-react';
import { examprepApi, type ExamSession, type SessionReport } from '@/api/examprep';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocale } from '@/hooks/useLocale';
import { formatDuration, nextStepText, printReport, SessionPrint } from './PrintableReport';

export const SessionReportCard: React.FC<{ session: ExamSession }> = ({ session }) => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    examprepApi.getSessionReport(session.id).then(setReport).catch(() => setFailed(true));
  }, [session.id]);

  if (failed || !report) return null;

  return (
    <Card className="rounded-2xl border border-border/50 bg-card/65 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          {report.simulation ? t('report.simulationTitle', 'Simulation report') : t('report.sessionTitle', 'Session report')}
        </h3>
        {report.simulation && (
          <Badge variant="outline" className={report.passed ? 'border-success/40 bg-success/10 text-foreground' : 'border-destructive/40 bg-destructive/10 text-foreground'}>
            {report.passed ? t('report.passed', 'Passed') : t('report.notPassed', 'Below the minimum')}
          </Badge>
        )}
      </div>

      <p className="text-sm text-foreground flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        {t('report.timeUsed', 'Time used: {{time}}', { time: formatDuration(report.timeUsedSeconds, t) })}
        {report.timeLimitMinutes > 0 && ` ${t('report.ofLimit', 'of {{minutes}} min', { minutes: report.timeLimitMinutes })}`}
      </p>

      <ul className="space-y-2.5">
        {report.chapters.map((c) => (
          <li key={c.chapterId ?? 'none'} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-foreground truncate">{c.title ?? t('readiness.noChapter', 'No chapter')}</span>
              <span className="shrink-0 font-bold text-muted-foreground tabular-nums">{c.correct}/{c.total} · {c.percent}%</span>
            </div>
            <div role="progressbar" aria-label={c.title ?? t('readiness.noChapter', 'No chapter')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.percent} className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
        <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <span><span className="font-bold">{t('report.nextTitle', 'Recommended next step')}:</span> {nextStepText(report, t)}</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={() => printReport(t('report.fileName', 'Session report'))} className="min-h-11 rounded-xl font-semibold gap-2 sm:flex-1">
          <FileDown className="h-4 w-4" aria-hidden="true" /> {t('report.exportPdf', 'Export PDF')}
        </Button>
        <Button render={<Link to={`/${locale}/study-areas/${report.studyAreaId}/readiness`} />} variant="outline" className="min-h-11 rounded-xl font-semibold sm:flex-1">
          {t('readiness.open', 'Readiness report')}
        </Button>
      </div>
      <SessionPrint report={report} />
    </Card>
  );
};
