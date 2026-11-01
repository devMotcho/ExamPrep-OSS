import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, TrendingUp } from 'lucide-react';
import type { AreaProgress, ChapterAccuracy, TrendPoint } from '@/api/examprep';
import { Button } from '@/components/ui/button';
import { formatDecimal } from '@/lib/format';

const WIDTH = 320;
const HEIGHT = 120;
const PAD = { left: 24, right: 28, top: 10, bottom: 10 };

const ScoreTrendChart: React.FC<{ trend: TrendPoint[]; areaTitle: string }> = ({ trend, areaTitle }) => {
  const { t, i18n } = useTranslation();
  const x = (i: number) =>
    trend.length === 1 ? WIDTH / 2 : PAD.left + (i * (WIDTH - PAD.left - PAD.right)) / (trend.length - 1);
  const y = (score: number) => PAD.top + ((20 - score) * (HEIGHT - PAD.top - PAD.bottom)) / 20;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const last = trend[trend.length - 1];

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={t('progress.chartLabel', {
          defaultValue: 'Score trend in {{area}}: {{count}} attempts, latest {{score}} out of 20.',
          area: areaTitle,
          count: trend.length,
          score: formatDecimal(last.score, i18n.language),
        })}
      >
        {[0, 10, 20].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted-foreground">{tick}</text>
          </g>
        ))}
        {trend.length > 1 && (
          <polyline
            points={trend.map((p, i) => `${x(i)},${y(Number(p.score))}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="text-primary"
          />
        )}
        {trend.map((p, i) => (
          <g key={p.sessionId}>
            <circle cx={x(i)} cy={y(Number(p.score))} r={4} fill="currentColor" stroke="var(--background)" strokeWidth={2} className="text-primary" />
            {/* Larger invisible target so the native tooltip is easy to reach. */}
            <circle cx={x(i)} cy={y(Number(p.score))} r={12} fill="transparent">
              <title>{`${formatDate(p.completedAt)}: ${formatDecimal(p.score, i18n.language)} / 20`}</title>
            </circle>
          </g>
        ))}
        <text x={x(trend.length - 1) + 7} y={y(Number(last.score)) + 3} fontSize={10} fontWeight={700} fill="currentColor" className="text-foreground">
          {formatDecimal(last.score, i18n.language)}
        </text>
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground font-medium">
        <span>{formatDate(trend[0].completedAt)}</span>
        {trend.length > 1 && <span>{formatDate(last.completedAt)}</span>}
      </figcaption>
      <table className="sr-only">
        <caption>{t('progress.tableCaption', 'Scores per attempt')}</caption>
        <tbody>
          {trend.map((p) => (
            <tr key={p.sessionId}>
              <th scope="row">{formatDate(p.completedAt)}</th>
              <td>{formatDecimal(p.score, i18n.language)} / 20</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

interface ProgressPanelProps {
  progress: AreaProgress[];
  onTrainChapter: (studyAreaId: string, chapter: ChapterAccuracy) => void;
  training: boolean;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({ progress, onTrainChapter, training }) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (progress.length === 0) return null;

  const area = progress.find((p) => p.studyAreaId === selectedId) ?? progress[0];
  const recommendation = area.recommendation;

  return (
    <section aria-labelledby="progress-heading" className="bg-card/65 backdrop-blur border border-border/50 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 id="progress-heading" className="text-xl font-black text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" /> {t('progress.title', 'Your progress')}
        </h2>
        {progress.length > 1 && (
          <select
            aria-label={t('progress.selectArea', 'Choose a study area')}
            value={area.studyAreaId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold text-foreground max-w-full"
          >
            {progress.map((p) => (
              <option key={p.studyAreaId} value={p.studyAreaId}>{p.title}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 min-w-0">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('progress.trendTitle', 'Score trend')}</h3>
          {area.trend.length > 0 ? (
            <ScoreTrendChart trend={area.trend} areaTitle={area.title} />
          ) : (
            <p className="text-xs text-muted-foreground">{t('progress.noFullExam', 'Finish a full exam in this area to see your trend.')}</p>
          )}
          {area.trend.length === 1 && (
            <p className="text-xs text-muted-foreground">{t('progress.oneAttempt', 'Take another exam to compare your score.')}</p>
          )}
        </div>

        <div className="space-y-3 min-w-0">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('progress.chaptersTitle', 'Accuracy per chapter')}</h3>
          {area.chapters.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('progress.noChapters', 'This area has no chapters yet.')}</p>
          ) : (
            <ul className="space-y-2.5">
              {area.chapters.map((c) => (
                <li key={c.chapterId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-foreground truncate">{c.title}</span>
                    <span className="shrink-0 font-bold text-muted-foreground">
                      {c.accuracyPercent !== null ? `${c.accuracyPercent}%` : t('progress.notTried', 'Not tried yet')}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={c.title}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={c.accuracyPercent ?? 0}
                    className="h-1.5 rounded-full bg-muted overflow-hidden"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.accuracyPercent ?? 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {recommendation && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-primary/20 bg-primary/5">
              <p className="text-xs text-foreground leading-normal min-w-0">
                <Target className="inline h-3.5 w-3.5 text-primary mr-1 align-text-bottom" aria-hidden="true" />
                <span className="font-black">{t('progress.trainNext', 'Train this next:')}</span> {recommendation.title}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={training}
                onClick={() => onTrainChapter(area.studyAreaId, recommendation)}
                className="rounded-xl font-semibold text-xs shrink-0"
              >
                {t('progress.trainButton', 'Train chapter')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
