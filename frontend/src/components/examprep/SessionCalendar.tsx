import React, { useState, useRef } from 'react';
import type { ExamSession } from '@/api/examprep';
import { Calendar, Info, Award, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocale } from '@/hooks/useLocale';
import { formatDecimal } from '@/lib/format';

interface SessionCalendarProps {
  sessions: ExamSession[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
}

export const SessionCalendar: React.FC<SessionCalendarProps> = ({
  sessions,
  selectedDate,
  onSelectDate,
}) => {
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to the far right to show the most recent days (today)
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [sessions]);

  const [hoveredDay, setHoveredDay] = useState<{
    dateStr: string;
    count: number;
    date: Date;
    x: number;
    y: number;
  } | null>(null);

  // Parse sessions count per day
  const sessionsCountMap: { [dateStr: string]: number } = {};
  sessions.forEach((session) => {
    if (session.startedAt) {
      const dateStr = session.startedAt.split('T')[0]; // YYYY-MM-DD
      sessionsCountMap[dateStr] = (sessionsCountMap[dateStr] || 0) + 1;
    }
  });

  const today = new Date();

  // Generate date range: past 364 days to today, aligned to Sunday at start and Saturday at end
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  const startDay = startDate.getDay(); // 0 = Sunday, 1 = Monday...
  startDate.setDate(startDate.getDate() - startDay); // Align to Sunday

  const endDate = new Date(today);
  const endDay = endDate.getDay();
  endDate.setDate(today.getDate() + (6 - endDay)); // Align to Saturday

  const days: { date: Date; count: number; dateStr: string }[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const count = sessionsCountMap[dateStr] || 0;

    // We only track counts for days <= today. Future days in the current week show 0 or are disabled.
    const isFuture = currentDate > today;

    days.push({
      date: new Date(currentDate),
      count: isFuture ? 0 : count,
      dateStr,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Chunk days into weeks (each column has 7 days)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Count total sessions in the past 365 days
  const oneYearAgo = new Date();
  oneYearAgo.setDate(today.getDate() - 365);
  const sessionsInLastYear = sessions.filter((s) => {
    if (!s.startedAt) return false;
    const sessionDate = new Date(s.startedAt);
    return sessionDate >= oneYearAgo && sessionDate <= today;
  }).length;

  // Calculate Average Student Note KPI (on a 0-20 scale)
  const completedSessions = sessions.filter(
    (s) => s.completedAt !== null && s.finalScore !== null
  );
  const totalCompleted = completedSessions.length;

  // Averaged per area: a global mix hides which subject needs the work. Mistake drills are left out.
  const areaAverages = Object.values(
    completedSessions
      .filter((s) => !s.practiceOfSessionId && s.sessionKind !== 'MARKED')
      .reduce<Record<string, { id: string; title: string; sum: number; count: number }>>((acc, s) => {
        const entry = acc[s.studyAreaId] ?? { id: s.studyAreaId, title: s.studyAreaTitle, sum: 0, count: 0 };
        entry.sum += Number(s.finalScore || 0);
        entry.count += 1;
        acc[s.studyAreaId] = entry;
        return acc;
      }, {}),
  )
    .map((a) => ({ id: a.id, title: a.title, average: a.sum / a.count }))
    .sort((a, b) => a.average - b.average);
  const weakestArea = areaAverages[0] ?? null;

  const getCellClass = (count: number) => {
    if (count === 0) return 'bg-foreground/[0.15] dark:bg-foreground/[0.15] border border-foreground/[0.02] dark:border-foreground/[0.02]';
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900 border border-emerald-200/10 dark:border-emerald-900/10';
    if (count === 2) return 'bg-emerald-400 dark:bg-emerald-750 border border-emerald-400/15 dark:border-emerald-700/15';
    if (count === 3 || count === 4) return 'bg-emerald-600 dark:bg-emerald-550 border border-emerald-600/20 dark:border-emerald-500/20';
    return 'bg-emerald-800 dark:bg-emerald-300 border border-emerald-800/30 dark:border-emerald-300/30';
  };

  // Month labels positioning
  const monthLabels: { label: string; colIndex: number }[] = [];
  let currentMonth = -1;
  weeks.forEach((week, index) => {
    const month = week[0].date.getMonth();
    if (month !== currentMonth) {
      currentMonth = month;
      monthLabels.push({
        label: week[0].date.toLocaleString(i18n.language, { month: 'short' }),
        colIndex: index,
      });
    }
  });

  const handleMouseEnter = (e: React.MouseEvent, day: typeof days[0]) => {
    const isFuture = day.date > today;
    if (isFuture) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      setHoveredDay({
        dateStr: day.dateStr,
        count: day.count,
        date: day.date,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const handleCellClick = (day: typeof days[0]) => {
    const isFuture = day.date > today;
    if (isFuture) return;

    if (selectedDate === day.dateStr) {
      onSelectDate(null); // Toggle filter off
    } else {
      onSelectDate(day.dateStr); // Set active filter
    }
  };

  // What to do next, based on the weakest area
  const getNextActionText = () => {
    if (!weakestArea) return t('calendar.motivation.none', 'Start practicing to calculate your average');
    if (weakestArea.average >= 14) return t('calendar.next.excellent', { defaultValue: 'Great work. Try a full exam in {{area}} to confirm it.', area: weakestArea.title });
    if (weakestArea.average >= 10) return t('calendar.next.passing', { defaultValue: 'A passing grade. Practise {{area}} again to aim for 14 or more.', area: weakestArea.title });
    return t('calendar.next.review', { defaultValue: 'Start with {{area}}: repeat the questions you got wrong in your last exam.', area: weakestArea.title });
  };

  return (
    <div className="bg-card/65 backdrop-blur border border-border/50 rounded-3xl p-5 md:p-6 shadow-sm bg-gradient-to-br from-card to-primary/[0.005]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-stretch">
        
        {/* Left Column: Calendar Grid */}
        <div ref={containerRef} className="relative flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2 tracking-tight">
                <Calendar className="h-4 w-4 text-primary" />
                {t('calendar.title', 'Practice Sessions Calendar')}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('calendar.subtitle', 'Click on a day square to filter exam sessions.')}
              </p>
            </div>
            <div className="text-[11px] font-bold text-foreground sm:text-right shrink-0">
              <span className="text-primary text-xs font-black mr-1">{sessionsInLastYear}</span>
              {sessionsInLastYear === 1 ? t('calendar.sessionInLastYear', 'session in the last year') : t('calendar.sessionsInLastYear', 'sessions in the last year')}
            </div>
          </div>

          {/* Scrollable Grid wrapper */}
          <div ref={scrollContainerRef} className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="w-fit flex flex-col relative pr-2">
              
              {/* Months Header */}
              <div className="grid grid-cols-[25px_1fr] text-[11px] text-muted-foreground mb-1 select-none font-semibold">
                <div />
                <div className="relative h-4">
                  {monthLabels.map((m, i) => (
                    <span
                      key={i}
                      className="absolute"
                      style={{ left: `${(m.colIndex * 100) / weeks.length}%` }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grid Layout containing weekdays and cells */}
              <div className="grid grid-cols-[25px_1fr] items-center">
                {/* Day of Week Labels */}
                <div className="grid grid-rows-7 pr-1.5 text-[11px] text-muted-foreground font-semibold h-[92px] items-center leading-none">
                  <div />
                  <div>{t('calendar.weekday.mon', 'Mon')}</div>
                  <div />
                  <div>{t('calendar.weekday.wed', 'Wed')}</div>
                  <div />
                  <div>{t('calendar.weekday.fri', 'Fri')}</div>
                  <div />
                </div>

                {/* Weeks flex columns */}
                <div className="flex gap-[3px] h-[92px] items-stretch">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px] justify-between">
                      {week.map((day) => {
                        const isFuture = day.date > today;
                        const isSelected = selectedDate === day.dateStr;
                        return (
                          <button
                            type="button"
                            data-no-tap
                            key={day.dateStr}
                            disabled={isFuture}
                            tabIndex={isFuture ? -1 : 0}
                            aria-pressed={isSelected}
                            aria-label={`${day.date.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}: ${day.count} ${day.count === 1 ? t('calendar.session', 'session') : t('calendar.sessions', 'sessions')}`}
                            onMouseEnter={(e) => handleMouseEnter(e, day)}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => handleCellClick(day)}
                            className={`block p-0 w-[10px] h-[10px] rounded-[2px] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              isFuture
                                ? 'bg-transparent cursor-default pointer-events-none'
                                : getCellClass(day.count)
                            } ${
                              isSelected
                                ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-background scale-110 z-10'
                                : ''
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-3 select-none font-medium">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3 text-primary shrink-0" />
              <span>{t('calendar.legendHint', 'Hover a square for the count. Click to filter.')}</span>
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <span>{t('calendar.less', 'Less')}</span>
              <div className="w-[8px] h-[8px] rounded-[1px] bg-foreground/[0.04] border border-foreground/[0.02]" />
              <div className="w-[8px] h-[8px] rounded-[1px] bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200/10 dark:border-emerald-900/10" />
              <div className="w-[8px] h-[8px] rounded-[1px] bg-emerald-300 dark:bg-emerald-800/80 border border-emerald-400/15 dark:border-emerald-700/15" />
              <div className="w-[8px] h-[8px] rounded-[1px] bg-emerald-500 dark:bg-emerald-600 border border-emerald-600/20 dark:border-emerald-500/20" />
              <div className="w-[8px] h-[8px] rounded-[1px] bg-emerald-750 dark:bg-emerald-400 border border-emerald-800/30 dark:border-emerald-300/30" />
              <span>{t('calendar.more', 'More')}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Avg Student Note KPI Card */}
        <div className="flex flex-col justify-center items-center bg-muted/20 dark:bg-muted/5 border border-border/30 rounded-2xl p-4 text-center space-y-2 shrink-0 lg:w-[260px] relative overflow-hidden bg-gradient-to-br from-muted/30 to-primary/[0.005]">
          <div className="absolute top-2 right-2 opacity-10">
            <Activity className="w-16 h-16 text-primary" />
          </div>
          
          <span className="text-[11px] font-black tracking-wider uppercase text-muted-foreground flex items-center gap-1">
            <Award className="w-3 h-3 text-primary" />
            {areaAverages.length > 1 ? t('calendar.avgPerArea', 'Average per area') : t('calendar.avgNote', 'Average Grade')}
          </span>
          
          {areaAverages.length <= 1 ? (
            <div className="space-y-0.5">
              <div
                className={`text-3xl font-black tracking-tight ${
                  weakestArea
                    ? weakestArea.average >= 10
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {weakestArea ? formatDecimal(weakestArea.average, i18n.language) : t('calendar.notAvailable', 'N/A')}
              </div>
              <div className="text-[11px] text-muted-foreground font-semibold line-clamp-1">
                {weakestArea ? weakestArea.title : t('calendar.noGraded', 'No graded sessions')}
              </div>
            </div>
          ) : (
            <ul className="w-full space-y-1.5 relative">
              {areaAverages.slice(0, 4).map((area) => (
                <li key={area.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-foreground" title={area.title}>{area.title}</span>
                  <span className={`shrink-0 font-black ${area.average >= 10 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                    {formatDecimal(area.average, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="w-full h-px bg-border/40 my-1" />

          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {totalCompleted} {totalCompleted === 1 ? t('calendar.examCompleted', 'exam completed') : t('calendar.examsCompleted', 'exams completed')}
            </span>
            <p className="text-[11px] text-muted-foreground leading-normal font-medium px-2">
              {getNextActionText()}
            </p>
            {weakestArea && (
              <Link
                to={`/${locale}/study-areas/${weakestArea.id}`}
                className="inline-flex min-h-11 items-center text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2"
              >
                {t('calendar.next.open', 'Open {{area}}', { area: weakestArea.title })}
              </Link>
            )}
          </div>
        </div>

      </div>

      {/* Floating Tooltip */}
      {hoveredDay && (
        <div
          className="absolute z-20 bg-popover text-popover-foreground border border-border/60 px-2.5 py-1.5 rounded-xl shadow-lg text-[11px] font-semibold -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150 zoom-in-95 backdrop-blur-md"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y - 6,
          }}
        >
          <div>
            {hoveredDay.count} {hoveredDay.count === 1 ? t('calendar.session', 'session') : t('calendar.sessions', 'sessions')}
          </div>
          <div className="text-[11px] text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
            {hoveredDay.date.toLocaleDateString(i18n.language, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      )}
    </div>
  );
};
