import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CalendarClock, ChevronDown, Flame, Goal, Settings2, X } from 'lucide-react';
import { examprepApi, type ReminderFrequency, type RetentionState } from '@/api/examprep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/context/ToastContext';

interface ReturnPanelProps {
  retention: RetentionState;
  areaOptions: { id: string; title: string }[];
  onChange: (state: RetentionState) => void;
}

const statClass = 'flex min-w-0 flex-col gap-0.5 rounded-2xl border border-border/50 bg-card/65 p-3 text-left shadow-sm';
const statLabelClass = 'flex items-center gap-1 text-[11px] font-bold text-muted-foreground';
const cardClass = 'min-w-0 space-y-3';
const titleClass = 'text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5';
const fieldClass = 'h-9 w-full min-w-0 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium text-foreground';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const ReturnPanel: React.FC<ReturnPanelProps> = ({ retention, areaOptions, onChange }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [areaId, setAreaId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [goal, setGoal] = useState(String(retention.dailyGoal));
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => setGoal(String(retention.dailyGoal)), [retention.dailyGoal]);

  const save = async (action: () => Promise<RetentionState>) => {
    setSaving(true);
    try {
      onChange(await action());
    } catch {
      toast({ type: 'error', message: t('retention.errors.saveFailed', 'Could not save. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const selectedAreaId = areaId || areaOptions[0]?.id || '';
  const goalNumber = Number(goal);
  const goalValid = Number.isInteger(goalNumber) && goalNumber >= 1 && goalNumber <= 500;
  const goalPercent = Math.min(100, Math.round((retention.answeredToday / retention.dailyGoal) * 100));

  const countdownLabel = (days: number) => {
    if (days === 0) return t('retention.exam.today', 'Today');
    if (days === 1) return t('retention.exam.tomorrow', 'Tomorrow');
    return t('retention.exam.inDays', { defaultValue: 'In {{days}} days', days });
  };

  return (
    <section aria-label={t('retention.sectionLabel', 'Your study plan')} className="space-y-3">
      {/* At a glance */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className={statClass}>
          <span className={statLabelClass}>
            <Flame className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{t('retention.streak.title', 'Streak')}</span>
          </span>
          <span className="text-lg font-black text-foreground">{retention.currentStreak}</span>
          <span
            className="truncate text-[11px] text-muted-foreground"
            title={retention.completedToday ? t('retention.streak.doneToday', 'Today already counts. Come back tomorrow.') : t('retention.streak.todoToday', 'Finish an exam today to keep it going.')}
          >
            {t('retention.streak.longest', { defaultValue: 'Best: {{days}}', days: retention.longestStreak })}
          </span>
        </div>
        <div className={statClass}>
          <span className={statLabelClass}>
            <Goal className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{t('retention.goal.today', 'Today')}</span>
          </span>
          <span className="text-lg font-black text-foreground tabular-nums">{retention.answeredToday}/{retention.dailyGoal}</span>
          <div
            role="progressbar"
            aria-label={t('retention.goal.progress', { defaultValue: '{{answered}} of {{goal}} questions today', answered: retention.answeredToday, goal: retention.dailyGoal })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={goalPercent}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${goalPercent}%` }} />
          </div>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} className={`${statClass} hover:border-primary/30`}>
          <span className={statLabelClass}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{t('retention.exam.short', 'Exam')}</span>
          </span>
          {retention.examDates[0] ? (
            <>
              <span className="truncate text-sm font-black leading-7 text-foreground">{countdownLabel(retention.examDates[0].daysLeft)}</span>
              <span className="truncate text-[11px] text-muted-foreground">{retention.examDates[0].title}</span>
            </>
          ) : (
            <>
              <span className="truncate text-sm font-black leading-7 text-primary">{t('retention.exam.set', 'Set date')}</span>
              <span className="truncate text-[11px] text-muted-foreground">{t('retention.exam.countdown', 'Countdown')}</span>
            </>
          )}
        </button>
      </div>

      {/* Settings stay collapsed, so the study areas are the next thing on the page */}
      <div className="rounded-2xl border border-border/50 bg-card/65 shadow-sm">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-sm font-bold text-foreground"
        >
          <span className="flex items-center gap-2 text-left">
            <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {t('retention.settingsTitle', 'Exam date, goal and reminders')}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {settingsOpen && (
      <div className="grid gap-5 border-t border-border/40 p-4 md:grid-cols-3">
      {/* Exam date */}
      <div className={cardClass}>
        <h3 className={titleClass}>
          <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {t('retention.exam.title', 'Exam date')}
        </h3>
        {retention.examDates.length > 0 && (
          <ul className="space-y-2">
            {retention.examDates.map((d) => (
              <li key={d.studyAreaId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{countdownLabel(d.daysLeft)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.title} · {new Date(`${d.examDate}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  aria-label={t('retention.exam.remove', { defaultValue: 'Remove exam date of {{area}}', area: d.title })}
                  onClick={() => save(() => examprepApi.clearExamDate(d.studyAreaId))}
                  className="h-7 w-7 p-0 rounded-lg shrink-0"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {areaOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('retention.exam.noAreas', 'Add a study area to set an exam date.')}</p>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedAreaId || !examDate) return;
              save(() => examprepApi.setExamDate(selectedAreaId, examDate)).then(() => setExamDate(''));
            }}
          >
            <select
              aria-label={t('retention.exam.areaLabel', 'Study area of the exam')}
              value={selectedAreaId}
              onChange={(e) => setAreaId(e.target.value)}
              className={fieldClass}
            >
              {areaOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                aria-label={t('retention.exam.dateLabel', 'Date of the exam')}
                min={localToday()}
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={fieldClass}
              />
              <Button type="submit" size="sm" variant="outline" disabled={saving || !examDate} className="h-9 rounded-xl text-xs font-semibold shrink-0">
                {t('retention.save', 'Save')}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Daily goal */}
      <div className={cardClass}>
        <h3 className={titleClass}>
          <Goal className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {t('retention.goal.title', 'Daily goal')}
        </h3>
        <p className="text-sm font-black text-foreground">
          {t('retention.goal.progress', { defaultValue: '{{answered}} of {{goal}} questions today', answered: retention.answeredToday, goal: retention.dailyGoal })}
        </p>
        <div
          role="progressbar"
          aria-label={t('retention.goal.title', 'Daily goal')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goalPercent}
          className="h-1.5 rounded-full bg-muted overflow-hidden"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${goalPercent}%` }} />
        </div>
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (goalValid) save(() => examprepApi.updateRetentionSettings({ dailyGoal: goalNumber }));
          }}
        >
          <Label htmlFor="daily-goal" className="text-[11px] font-semibold text-muted-foreground">
            {t('retention.goal.label', 'Questions per day')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="daily-goal"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="h-9 rounded-xl border-border/60 text-xs font-medium"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={saving || !goalValid || goalNumber === retention.dailyGoal}
              className="h-9 rounded-xl text-xs font-semibold shrink-0"
            >
              {t('retention.save', 'Save')}
            </Button>
          </div>
        </form>
      </div>

      {/* Reminders */}
      <div className={cardClass}>
        <h3 className={titleClass}>
          <BellRing className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {t('retention.reminder.title', 'Email reminders')}
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="reminder-frequency" className="text-[11px] font-semibold text-muted-foreground">
            {t('retention.reminder.label', 'How often')}
          </Label>
          <select
            id="reminder-frequency"
            value={retention.reminderFrequency}
            disabled={saving || (!retention.remindersAvailable && retention.reminderFrequency === 'OFF')}
            onChange={(e) => save(() => examprepApi.updateRetentionSettings({ reminderFrequency: e.target.value as ReminderFrequency }))}
            className={`${fieldClass} disabled:opacity-60`}
          >
            <option value="OFF">{t('retention.reminder.off', 'Off')}</option>
            <option value="DAILY">{t('retention.reminder.daily', 'Daily')}</option>
            <option value="WEEKLY">{t('retention.reminder.weekly', 'Weekly (Mondays)')}</option>
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground leading-normal">
          {retention.remindersAvailable
            ? t('retention.reminder.help', 'Every email has a link to cancel.')
            : t('retention.reminder.unavailable', 'Email reminders are not available right now.')}
        </p>
      </div>
      </div>
        )}
      </div>
    </section>
  );
};
