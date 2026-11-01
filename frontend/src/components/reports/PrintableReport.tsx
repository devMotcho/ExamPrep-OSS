import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Readiness, SessionReport } from '@/api/examprep';
import { formatDecimal } from '@/lib/format';
import { useConfig } from '@/lib/config/useConfig';

/**
 * The paper version of a report. It sits directly under <body>, outside the app, so printing shows this and nothing
 * else: no nav and no dialogs. It has its own light palette in globals.css, so dark mode never reaches the page.
 */
const PrintSheet: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => {
  const { t, i18n } = useTranslation();
  const config = useConfig();
  return createPortal(
    <article className="print-root" lang={i18n.language}>
      <header className="pr-header">
        <p className="pr-brand">{config.company_name}</p>
        <h1>{title}</h1>
        <p className="pr-muted">{subtitle}</p>
        <p className="pr-muted">
          {t('report.generatedOn', 'Generated on {{date}}', { date: new Date().toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })}
        </p>
      </header>
      {children}
    </article>,
    document.body,
  );
};

/** Sets the suggested PDF file name, opens the browser's print dialog and puts the title back. */
export const printReport = (fileName: string) => {
  const previous = document.title;
  document.title = fileName;
  const restore = () => {
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
};

export const formatDuration = (seconds: number, t: (key: string, fallback: string, options?: Record<string, unknown>) => string) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return t('report.durationHours', '{{hours}} h {{minutes}} min', { hours, minutes });
  if (minutes > 0) return t('report.durationMinutes', '{{minutes}} min {{seconds}} s', { minutes, seconds: rest });
  return t('report.durationSeconds', '{{seconds}} s', { seconds: rest });
};

export const useBandLabel = () => {
  const { t } = useTranslation();
  return (band: Readiness['band']) => ({
    INSUFFICIENT_DATA: t('readiness.band.insufficient', 'Insufficient data'),
    LOW: t('readiness.band.low', 'Still far off'),
    MODERATE: t('readiness.band.moderate', 'On the way'),
    GOOD: t('readiness.band.good', 'Well prepared'),
  }[band]);
};

export const ReadinessPrint: React.FC<{ report: Readiness }> = ({ report }) => {
  const { t, i18n } = useTranslation();
  const bandLabel = useBandLabel();
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <PrintSheet title={t('readiness.title', 'Readiness report')} subtitle={report.areaTitle}>
      <section className="pr-section">
        <h2>{t('readiness.estimateTitle', 'Estimate')}</h2>
        <p className="pr-big">
          {report.estimatePercent !== null ? `${report.estimatePercent}% · ${bandLabel(report.band)}` : bandLabel(report.band)}
        </p>
        <p>{t('readiness.disclaimer', 'This is an estimate from your practice here. It is not a grade forecast and promises no result.')}</p>
      </section>

      <section className="pr-section">
        <h2>{t('readiness.basisTitle', 'What it is based on')}</h2>
        <ul>
          <li>{t('readiness.basisCoverage', 'Questions seen: {{seen}} of {{total}} ({{percent}}%)', { seen: report.seen, total: report.questionCount, percent: report.coveragePercent })}</li>
          <li>{t('readiness.basisAnswers', '{{answers}} answers in {{sessions}} sessions. Reviewing mistakes and marked questions does not count.', { answers: report.answersCounted, sessions: report.sessionsCounted })}</li>
          {report.lastActivityAt && <li>{t('readiness.basisLast', 'Last answer: {{date}}', { date: date(report.lastActivityAt) })}</li>}
          {report.simulationAveragePercent !== null
            ? <li>{t('readiness.basisFormulaSim', 'Calculation: 60% chapter mastery, where what you have not seen counts as zero, and 40% the average of your latest simulations.')}</li>
            : <li>{t('readiness.basisFormula', 'Calculation: chapter mastery, where what you have not seen counts as zero. There are no simulations yet.')}</li>}
        </ul>
      </section>

      <section className="pr-section">
        <h2>{t('readiness.chaptersTitle', 'By chapter')}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('readiness.colChapter', 'Chapter')}</th>
              <th scope="col" className="pr-num">{t('readiness.colSeen', 'Seen')}</th>
              <th scope="col" className="pr-num">{t('readiness.colRecent', 'Recent answers')}</th>
              <th scope="col" className="pr-num">{t('readiness.colAccuracy', 'Accuracy')}</th>
            </tr>
          </thead>
          <tbody>
            {report.chapters.map((c) => (
              <tr key={c.chapterId ?? 'none'}>
                <td>{c.title ?? t('readiness.noChapter', 'No chapter')}</td>
                <td className="pr-num">{c.seen}/{c.questionCount}</td>
                <td className="pr-num">{c.recentAnswers}</td>
                <td className="pr-num">{c.recentAccuracyPercent !== null ? `${c.recentAccuracyPercent}%` : t('readiness.chapterInsufficient', 'Insufficient data')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pr-section">
        <h2>{t('readiness.simulationsTitle', 'Latest simulations')}</h2>
        {report.simulations.length === 0 ? (
          <p>{t('readiness.noSimulations', 'No simulations yet. Only sessions started with the Exam simulation preset count here.')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t('readiness.colDate', 'Date')}</th>
                <th scope="col" className="pr-num">{t('readiness.colScore', 'Score')}</th>
                <th scope="col">{t('readiness.colResult', 'Result')}</th>
              </tr>
            </thead>
            <tbody>
              {report.simulations.map((s) => (
                <tr key={s.sessionId}>
                  <td>{date(s.completedAt)}</td>
                  <td className="pr-num">{formatDecimal(s.score, i18n.language)} / 20</td>
                  <td>{s.passed ? t('report.passed', 'Passed') : t('report.notPassed', 'Below the minimum')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PrintSheet>
  );
};

export const nextStepText = (report: SessionReport, t: (key: string, fallback: string, options?: Record<string, unknown>) => string) => {
  if (report.nextStep === 'TRAIN_CHAPTER') {
    return t('report.nextChapter', 'Train {{chapter}} next, your weakest chapter in this session, then review the rest of your mistakes.', { chapter: report.nextChapterTitle });
  }
  if (report.nextStep === 'REVIEW_MISTAKES') {
    return t('report.nextMistakes', 'Review the {{count}} questions you missed while they are fresh.', { count: report.wrong + report.unanswered });
  }
  return t('report.nextSimulate', 'Nothing left to fix here. Try a new simulation to check it holds.');
};

export const SessionPrint: React.FC<{ report: SessionReport }> = ({ report }) => {
  const { t, i18n } = useTranslation();
  const when = new Date(report.completedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PrintSheet
      title={report.simulation ? t('report.simulationTitle', 'Simulation report') : t('report.sessionTitle', 'Session report')}
      subtitle={`${report.areaTitle} · ${when}`}
    >
      <section className="pr-section">
        <h2>{t('report.resultTitle', 'Result')}</h2>
        <p className="pr-big">
          {formatDecimal(report.score, i18n.language)} / 20
          {report.simulation && ` · ${report.passed ? t('report.passed', 'Passed') : t('report.notPassed', 'Below the minimum')}`}
        </p>
        <ul>
          <li>{t('report.minimum', 'Minimum to pass: {{minimum}}', { minimum: formatDecimal(report.passingScore, i18n.language) })}</li>
          <li>{t('report.timeUsed', 'Time used: {{time}}', { time: formatDuration(report.timeUsedSeconds, t) })}{report.timeLimitMinutes > 0 && ` ${t('report.ofLimit', 'of {{minutes}} min', { minutes: report.timeLimitMinutes })}`}</li>
          <li>{t('report.counts', '{{correct}} correct, {{wrong}} wrong and {{unanswered}} unanswered, out of {{total}}', { correct: report.correct, wrong: report.wrong, unanswered: report.unanswered, total: report.total })}</li>
        </ul>
      </section>
      <section className="pr-section">
        <h2>{t('readiness.chaptersTitle', 'By chapter')}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('readiness.colChapter', 'Chapter')}</th>
              <th scope="col" className="pr-num">{t('report.colCorrect', 'Correct')}</th>
              <th scope="col" className="pr-num">{t('report.colWrong', 'Wrong')}</th>
              <th scope="col" className="pr-num">{t('report.colBlank', 'Blank')}</th>
              <th scope="col" className="pr-num">%</th>
            </tr>
          </thead>
          <tbody>
            {report.chapters.map((c) => (
              <tr key={c.chapterId ?? 'none'}>
                <td>{c.title ?? t('readiness.noChapter', 'No chapter')}</td>
                <td className="pr-num">{c.correct}/{c.total}</td>
                <td className="pr-num">{c.wrong}</td>
                <td className="pr-num">{c.unanswered}</td>
                <td className="pr-num">{c.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pr-section">
        <h2>{t('report.nextTitle', 'Recommended next step')}</h2>
        <p>{nextStepText(report, t)}</p>
      </section>
    </PrintSheet>
  );
};
