import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useBandLabel } from '@/components/reports/PrintableReport';
import type { Readiness } from '@/api/examprep';

export const ReadinessCard: React.FC<{ report: Readiness; locale: string }> = ({ report, locale }) => {
  const { t } = useTranslation();
  const bandLabel = useBandLabel();
  return (
    <Card className="rounded-2xl border border-border/50 bg-card/65 p-4 space-y-2 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Gauge className="h-4 w-4" aria-hidden="true" /> {t('dashboardPlan.readinessTitle', { defaultValue: 'Readiness: {{area}}', area: report.areaTitle })}
      </h2>
      <p className="text-lg font-black text-foreground">{bandLabel(report.band)}</p>
      <p className="text-xs text-muted-foreground">
        {t('dashboardPlan.readinessDesc', {
          defaultValue: 'You have seen {{coverage}}% of the questions. This describes your answers and does not predict a grade.',
          coverage: report.coveragePercent,
        })}
      </p>
      <Link to={`/${locale}/study-areas/${report.studyAreaId}/readiness`} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-primary">
        {t('readiness.open', 'Readiness report')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
};
