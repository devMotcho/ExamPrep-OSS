import { useLocale } from '../../hooks/useLocale';
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { examprepApi, type Chapter, type ChapterAccuracy, type ExamSetup, type Question } from '@/api/examprep';
import { Play, Star, ChevronDown, Minus, Plus, Trash2, GraduationCap, Timer, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatDecimal, formatTrimmed } from '@/lib/format';
import { handleSessionStartError } from '@/lib/sessionStartError';

interface ExamSettingsModalProps {
  studyAreaId: string;
  isOpen: boolean;
  onClose: () => void;
  onStart: (sessionId: string) => void;
  questions?: Question[];
}

type Preset = 'TRAINING' | 'SIMULATION' | 'REVIEW';

const PENALTY_OPTIONS = [0, 0.2, 0.25, 0.33, 0.5];
const WEAK_ACCURACY_PERCENT = 70;

const suggestedMinutes = (questionCount: number) =>
  Math.min(180, Math.max(10, Math.ceil((questionCount * 1.5) / 5) * 5));

const Stepper: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  display: string;
  onChange: (value: number) => void;
}> = ({ value, min, max, step = 1, label, display, onChange }) => {
  const { t } = useTranslation();
  const buttonClass = 'h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border border-border/60 bg-background text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 shrink-0">
      <button type="button" className={buttonClass} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={t('examSettings.decrease', 'Decrease: {{label}}', { label })}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="min-w-12 text-center text-sm font-black text-foreground tabular-nums">{display}</span>
      <button type="button" className={buttonClass} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={t('examSettings.increase', 'Increase: {{label}}', { label })}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const ExamSettingsModal: React.FC<ExamSettingsModalProps> = ({
  studyAreaId,
  isOpen,
  onClose,
  onStart,
  questions,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useTranslation();

  const [preset, setPreset] = useState<Preset>('TRAINING');
  const [customizing, setCustomizing] = useState(false);
  const [showAnswerPerQuestion, setShowAnswerPerQuestion] = useState(true);
  const [allowBack, setAllowBack] = useState(true);
  const [discountFactor, setDiscountFactor] = useState(0);
  const [passingScore, setPassingScore] = useState(10);
  const [examDurationMinutes, setExamDurationMinutes] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [accuracy, setAccuracy] = useState<Record<string, ChapterAccuracy>>({});
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [chapterQuestionCounts, setChapterQuestionCounts] = useState<Record<string, number>>({});

  const [setups, setSetups] = useState<ExamSetup[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [savingOpen, setSavingOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupIsDefault, setSetupIsDefault] = useState(true);
  const [savingSetup, setSavingSetup] = useState(false);

  // null = not known (still loading, or the request failed).
  const [hasPastSessions, setHasPastSessions] = useState<boolean | null>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  const questionsByChapter = useMemo(() => {
    const counts: Record<string, number> = {};
    (questions || []).forEach((q) => {
      if (q.chapterId) counts[q.chapterId] = (counts[q.chapterId] || 0) + 1;
    });
    return counts;
  }, [questions]);

  const totalQuestions = questions?.length ?? 0;
  const usableChapters = chapters.filter((c) => (questionsByChapter[c.id] || 0) > 0);

  const applyPreset = (next: Preset, questionCount: number) => {
    setPreset(next);
    setActiveSetupId(null);
    if (next === 'TRAINING') {
      setShowAnswerPerQuestion(true);
      setAllowBack(true);
      setDiscountFactor(0);
      setPassingScore(10);
      setExamDurationMinutes(0);
    } else if (next === 'SIMULATION') {
      setShowAnswerPerQuestion(false);
      setAllowBack(false);
      setDiscountFactor(0.25);
      setPassingScore(10);
      setExamDurationMinutes(suggestedMinutes(questionCount));
    }
  };

  const applySetup = (setup: ExamSetup, available: Chapter[]) => {
    const s = setup.settings;
    setPreset(setup.preset);
    setShowAnswerPerQuestion(s.showAnswerPerQuestion);
    setAllowBack(s.allowBack);
    setDiscountFactor(s.discountFactor);
    setPassingScore(s.passingScore);
    setExamDurationMinutes(s.examDurationMinutes);
    const counts: Record<string, number> = {};
    Object.entries(s.chapterQuestionCounts || {}).forEach(([id, count]) => {
      const inChapter = questionsByChapter[id] || 0;
      if (inChapter > 0 && available.some((c) => c.id === id)) counts[id] = Math.min(count, inChapter);
    });
    setSelectedChapterIds(Object.keys(counts));
    setChapterQuestionCounts(counts);
    setActiveSetupId(setup.id);
  };

  // Everything the screen needs, read fresh each time it opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setHasPastSessions(null);
    setLastSessionId(null);
    setCustomizing(false);
    setSavingOpen(false);
    setSelectedChapterIds([]);
    setChapterQuestionCounts({});
    setSetups([]);
    setChapters([]);
    setAccuracy({});
    applyPreset('TRAINING', totalQuestions);

    examprepApi.listMySessions()
      .then((sessions) => {
        if (cancelled) return;
        setHasPastSessions(sessions.length > 0);
        setLastSessionId(sessions.find((s) => s.studyAreaId === studyAreaId && s.completedAt)?.id ?? null);
      })
      .catch((err) => console.error('Failed to load exam sessions:', err));

    Promise.all([
      examprepApi.listChapters(studyAreaId).catch(() => [] as Chapter[]),
      examprepApi.getProgress().catch(() => []),
      examprepApi.listExamSetups(studyAreaId).catch(() => [] as ExamSetup[]),
    ]).then(([chapterData, progress, setupData]) => {
      if (cancelled) return;
      setChapters(chapterData);
      const byChapter: Record<string, ChapterAccuracy> = {};
      progress.find((p) => p.studyAreaId === studyAreaId)?.chapters.forEach((c) => {
        byChapter[c.chapterId] = c;
      });
      setAccuracy(byChapter);
      setSetups(setupData);
      const remembered = setupData.find((s) => s.isDefault);
      if (remembered) applySetup(remembered, chapterData);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studyAreaId]);

  const weakChapters = usableChapters.filter((c) => {
    const percent = accuracy[c.id]?.accuracyPercent;
    return percent !== null && percent !== undefined && percent < WEAK_ACCURACY_PERCENT;
  });
  const untriedChapters = usableChapters.filter((c) => !accuracy[c.id] || accuracy[c.id].answered === 0);

  const selectChapters = (list: Chapter[]) => {
    setActiveSetupId(null);
    setSelectedChapterIds(list.map((c) => c.id));
    const counts: Record<string, number> = {};
    list.forEach((c) => {
      counts[c.id] = Math.min(5, questionsByChapter[c.id] || 1);
    });
    setChapterQuestionCounts(counts);
  };

  const toggleChapter = (chapterId: string) => {
    setActiveSetupId(null);
    setChapterQuestionCounts((prev) => ({ ...prev, [chapterId]: prev[chapterId] || Math.min(5, questionsByChapter[chapterId] || 1) }));
    setSelectedChapterIds((prev) => (prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]));
  };

  const selectedQuestionTotal = selectedChapterIds.reduce((sum, id) => sum + (chapterQuestionCounts[id] || 0), 0);
  const examQuestionCount = selectedChapterIds.length > 0 ? selectedQuestionTotal : totalQuestions;

  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setActiveSetupId(null);
    setter(value);
  };

  const handleStartExam = async () => {
    setIsStarting(true);
    try {
      let sessionId: string;
      if (preset === 'REVIEW' && lastSessionId) {
        sessionId = (await examprepApi.practiceWrongAnswers(lastSessionId)).id;
      } else {
        const counts: Record<string, number> = {};
        selectedChapterIds.forEach((id) => {
          counts[id] = chapterQuestionCounts[id] || 5;
        });
        const session = await examprepApi.startSession(studyAreaId, {
          showAnswerPerQuestion,
          allowBack,
          discountFactor,
          passingScore,
          examDurationMinutes,
          selectedChapterIds: selectedChapterIds.length > 0 ? selectedChapterIds : undefined,
          chapterQuestionCounts: selectedChapterIds.length > 0 ? counts : undefined,
          preset: preset === 'SIMULATION' ? 'SIMULATION' : undefined,
        });
        sessionId = session.id;
      }
      if (hasPastSessions === false)      onStart(sessionId);
    } catch (err: any) {
      const status = err.response?.status;
      if (preset === 'REVIEW' && status === 400) {
        toast({ type: 'success', message: t('examSettings.review.noMistakes', 'No mistakes to review in your last session. Well done!') });
      } else {
        await handleSessionStartError({ err, studyAreaId, locale, t, toast, navigate });
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveSetup = async () => {
    const name = setupName.trim();
    if (!name || preset === 'REVIEW') return;
    setSavingSetup(true);
    try {
      const counts: Record<string, number> = {};
      selectedChapterIds.forEach((id) => {
        counts[id] = chapterQuestionCounts[id] || 5;
      });
      const saved = await examprepApi.createExamSetup(studyAreaId, {
        name,
        preset,
        isDefault: setupIsDefault,
        settings: { showAnswerPerQuestion, allowBack, discountFactor, passingScore, examDurationMinutes, chapterQuestionCounts: counts },
      });
      setSetups((prev) => [...prev.map((s) => (saved.isDefault ? { ...s, isDefault: false } : s)), saved]);
      setActiveSetupId(saved.id);
      setSavingOpen(false);
      setSetupName('');
      toast({ type: 'success', message: t('examSettings.setups.saved', 'Setup saved.') });
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.status === 409
          ? t('examSettings.setups.tooMany', 'You can save up to 10 setups per area. Delete one first.')
          : t('examSettings.setups.saveFailed', 'We could not save the setup. Try again.'),
      });
    } finally {
      setSavingSetup(false);
    }
  };

  const handleToggleDefault = async (setup: ExamSetup) => {
    try {
      await examprepApi.setDefaultExamSetup(setup.id, !setup.isDefault);
      setSetups((prev) => prev.map((s) => ({ ...s, isDefault: s.id === setup.id ? !setup.isDefault : setup.isDefault ? s.isDefault : false })));
    } catch {
      toast({ type: 'error', message: t('examSettings.setups.saveFailed', 'We could not save the setup. Try again.') });
    }
  };

  const handleDeleteSetup = async (setup: ExamSetup) => {
    try {
      await examprepApi.deleteExamSetup(setup.id);
      setSetups((prev) => prev.filter((s) => s.id !== setup.id));
      if (activeSetupId === setup.id) setActiveSetupId(null);
    } catch {
      toast({ type: 'error', message: t('examSettings.setups.deleteFailed', 'We could not delete the setup. Try again.') });
    }
  };

  const presets: { id: Preset; icon: React.ElementType; title: string; desc: string; disabledReason?: string }[] = [
    {
      id: 'TRAINING',
      icon: GraduationCap,
      title: t('examSettings.preset.training', 'Training'),
      desc: t('examSettings.preset.trainingDesc', 'See the answer after each question. You can go back and there is no timer.'),
    },
    {
      id: 'SIMULATION',
      icon: Timer,
      title: t('examSettings.preset.simulation', 'Exam simulation'),
      desc: t('examSettings.preset.simulationDesc', 'No answers until the end and no going back, with a timer and a penalty for mistakes.'),
    },
    {
      id: 'REVIEW',
      icon: RotateCcw,
      title: t('examSettings.preset.review', 'Review mistakes'),
      desc: t('examSettings.preset.reviewDesc', 'Repeat only what you got wrong or left blank in your last session here.'),
      disabledReason: lastSessionId ? undefined : t('examSettings.preset.reviewNone', 'Finish an exam in this area first.'),
    },
  ];

  const startLabel = isStarting
    ? t('examSettings.starting', 'Starting...')
    : preset === 'SIMULATION'
      ? t('examSettings.startSimulation', 'Start simulation')
      : preset === 'REVIEW'
        ? t('examSettings.startReview', 'Review mistakes')
        : t('examSettings.startTraining', 'Start training');

  const chipClass = 'min-h-11 px-3 rounded-xl border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed';
  const sectionTitleClass = 'text-sm font-black text-foreground';
  const rowClass = 'flex items-center justify-between gap-3 min-h-11 p-3 border border-border/40 bg-muted/10 rounded-xl';

  const penaltyText = discountFactor > 0
    ? t('examSettings.penaltyEach', 'Each mistake takes away {{value}} of a correct answer.', { value: formatTrimmed(discountFactor, locale) })
    : t('examSettings.penaltyNone', 'Mistakes take nothing away.');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border shadow-lg p-6 zoom-in-95 duration-300">
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="text-xl font-black text-foreground">{t('examSettings.setupTitle', 'Set up your exam')}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs leading-normal mt-1">
            {t('examSettings.setupDesc', 'Choose how you want to practise. You can change the details below.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 flex-1 overflow-y-auto pr-1 min-h-0">
          {/* Chapters come first: what to practise, then how */}
          {preset !== 'REVIEW' && usableChapters.length > 0 && (
            <section className="space-y-3" aria-labelledby="exam-chapters-title">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id="exam-chapters-title" className={sectionTitleClass}>{t('examSettings.chaptersTitle', 'What do you want to practise?')}</h3>
                <span className="text-[11px] font-semibold text-muted-foreground shrink-0" aria-live="polite">
                  {selectedChapterIds.length > 0
                    ? t('examSettings.chaptersSummary', '{{count}} questions', { count: selectedQuestionTotal })
                    : t('examSettings.allQuestions', 'All {{count}} questions', { count: totalQuestions })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectChapters([])}
                  aria-pressed={selectedChapterIds.length === 0}
                  className={cn(chipClass, selectedChapterIds.length === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-foreground hover:bg-muted')}
                >
                  {t('examSettings.quickAll', 'Everything')}
                </button>
                <button type="button" disabled={weakChapters.length === 0} onClick={() => selectChapters(weakChapters)} className={cn(chipClass, 'border-border/60 text-foreground hover:bg-muted')}>
                  {t('examSettings.quickWeak', 'Weak spots')} ({weakChapters.length})
                </button>
                <button type="button" disabled={untriedChapters.length === 0} onClick={() => selectChapters(untriedChapters)} className={cn(chipClass, 'border-border/60 text-foreground hover:bg-muted')}>
                  {t('examSettings.quickUntried', 'Not tried yet')} ({untriedChapters.length})
                </button>
              </div>
              <ul className="space-y-2">
                {usableChapters.map((c) => {
                  const isChecked = selectedChapterIds.includes(c.id);
                  const total = questionsByChapter[c.id] || 0;
                  const stats = accuracy[c.id];
                  return (
                    <li key={c.id} className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-2 rounded-xl border transition-colors', isChecked ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-muted/10')}>
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-[10rem] min-h-11">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChapter(c.id)}
                          className="h-5 w-5 rounded text-primary focus:ring-primary border-border cursor-pointer shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-foreground truncate" title={c.title}>{c.title}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {stats?.accuracyPercent !== null && stats?.accuracyPercent !== undefined
                              ? t('examSettings.chapterAccuracy', '{{percent}}% correct', { percent: stats.accuracyPercent })
                              : t('progress.notTried', 'Not tried yet')}
                            {' · '}{t('examSettings.chapterQuestions', '{{count}} questions', { count: total })}
                          </span>
                        </span>
                      </label>
                      {isChecked && (
                        <Stepper
                          value={chapterQuestionCounts[c.id] || 1}
                          min={1}
                          max={total}
                          label={t('examSettings.chapterCountLabel', 'Questions from {{chapter}}', { chapter: c.title })}
                          display={String(chapterQuestionCounts[c.id] || 1)}
                          onChange={(value) => {
                            setActiveSetupId(null);
                            setChapterQuestionCounts((prev) => ({ ...prev, [c.id]: value }));
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* The three ways to practise */}
          <section className="space-y-2" aria-labelledby="exam-preset-title">
            <h3 id="exam-preset-title" className={sectionTitleClass}>{t('examSettings.presetTitle', 'How do you want to practise?')}</h3>
            <div role="radiogroup" aria-labelledby="exam-preset-title" className="grid gap-2 sm:grid-cols-3">
              {presets.map((p) => {
                const selected = preset === p.id;
                const unavailable = !!p.disabledReason;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={unavailable}
                    onClick={() => {
                      if (unavailable) return;
                      applyPreset(p.id, examQuestionCount);
                    }}
                    className={cn(
                      'text-left p-3 rounded-xl border transition-colors space-y-1 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/10 hover:bg-muted/40',
                      unavailable && 'opacity-60 cursor-not-allowed hover:bg-muted/10',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-black text-foreground">
                      <p.icon className={cn('h-4 w-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                      <span className="min-w-0">{p.title}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">{p.disabledReason || p.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Saved setups */}
          {preset !== 'REVIEW' && (
            <section className="space-y-2" aria-labelledby="exam-setups-title">
              <h3 id="exam-setups-title" className={sectionTitleClass}>{t('examSettings.setups.title', 'Your saved setups')}</h3>
              {setups.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('examSettings.setups.empty', 'Save a setup you like and it can open by default in this area.')}</p>
              ) : (
                <ul className="space-y-2">
                  {setups.map((setup) => (
                    <li key={setup.id} className={cn('flex items-center gap-1 pl-1 rounded-xl border', activeSetupId === setup.id ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-muted/10')}>
                      <button
                        type="button"
                        onClick={() => applySetup(setup, chapters)}
                        aria-pressed={activeSetupId === setup.id}
                        className="flex-1 min-w-0 min-h-11 px-2 text-left text-sm font-bold text-foreground truncate rounded-lg disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {setup.name}
                      </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDefault(setup)}
                          aria-pressed={setup.isDefault}
                          aria-label={t('examSettings.setups.defaultAria', 'Use {{name}} by default', { name: setup.name })}
                          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Star className={cn('h-4 w-4', setup.isDefault && 'fill-amber-500 text-amber-500')} aria-hidden="true" />
                        </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSetup(setup)}
                        aria-label={t('examSettings.setups.deleteAria', 'Delete {{name}}', { name: setup.name })}
                        className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Plain-language details */}
          {preset !== 'REVIEW' && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setCustomizing((open) => !open)}
                aria-expanded={customizing}
                aria-controls="exam-custom-panel"
                className="w-full min-h-11 flex items-center justify-between gap-2 rounded-xl text-sm font-black text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('examSettings.customize', 'Customise')}
                <ChevronDown className={cn('h-4 w-4 transition-transform', customizing && 'rotate-180')} aria-hidden="true" />
              </button>

              {customizing && (
                <div id="exam-custom-panel" className="space-y-2">
                  <div className={rowClass}>
                    <div className="min-w-0 space-y-0.5">
                      <Label className="text-sm font-bold text-foreground cursor-pointer" htmlFor="show-answer">{t('examSettings.showAnswerPlain', 'See the answer after each question')}</Label>
                      <p className="text-[11px] text-muted-foreground leading-snug">{t('examSettings.showAnswerPlainDesc', 'With the explanation, right after you answer.')}</p>
                    </div>
                    <Switch id="show-answer" checked={showAnswerPerQuestion} onCheckedChange={changed(setShowAnswerPerQuestion)} />
                  </div>

                  <div className={rowClass}>
                    <div className="min-w-0 space-y-0.5">
                      <Label className="text-sm font-bold text-foreground cursor-pointer" htmlFor="allow-back">{t('examSettings.allowBackPlain', 'Go back to earlier questions')}</Label>
                      <p className="text-[11px] text-muted-foreground leading-snug">{t('examSettings.allowBackPlainDesc', 'To review or change an answer.')}</p>
                    </div>
                    <Switch id="allow-back" checked={allowBack} onCheckedChange={changed(setAllowBack)} />
                  </div>

                      <div className="space-y-2 p-3 border border-border/40 bg-muted/10 rounded-xl">
                        <p className="text-sm font-bold text-foreground">{t('examSettings.penaltyTitle', 'Penalty for mistakes')}</p>
                        <div role="radiogroup" aria-label={t('examSettings.penaltyTitle', 'Penalty for mistakes')} className="flex flex-wrap gap-2">
                          {PENALTY_OPTIONS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={discountFactor === value}
                              onClick={() => changed(setDiscountFactor)(value)}
                              className={cn(chipClass, 'min-w-11', discountFactor === value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-foreground hover:bg-muted')}
                            >
                              {value === 0 ? t('examSettings.penaltyOff', 'None') : formatTrimmed(value, locale)}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{penaltyText}</p>
                      </div>

                      <div className={rowClass}>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-foreground">{t('examSettings.passTitle', 'Pass mark')}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">{t('examSettings.passDesc', 'Out of 20.')}</p>
                        </div>
                        <Stepper
                          value={passingScore}
                          min={1}
                          max={20}
                          step={0.5}
                          label={t('examSettings.passTitle', 'Pass mark')}
                          display={formatDecimal(passingScore, locale)}
                          onChange={changed(setPassingScore)}
                        />
                      </div>

                      <div className={rowClass}>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-foreground">{t('examSettings.timerTitle', 'Time limit')}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {examDurationMinutes > 0
                              ? t('examSettings.timerOn', 'The exam ends by itself after {{minutes}} minutes.', { minutes: examDurationMinutes })
                              : t('examSettings.timerOff', 'No time limit.')}
                          </p>
                        </div>
                        <Stepper
                          value={examDurationMinutes}
                          min={0}
                          max={180}
                          step={5}
                          label={t('examSettings.timerTitle', 'Time limit')}
                          display={examDurationMinutes > 0 ? t('examSettings.minutesShort', '{{minutes}} min', { minutes: examDurationMinutes }) : t('examSettings.penaltyOff', 'None')}
                          onChange={changed(setExamDurationMinutes)}
                        />
                      </div>

                      {savingOpen ? (
                        <form
                          className="space-y-2 p-3 border border-border/40 bg-muted/10 rounded-xl"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveSetup();
                          }}
                        >
                          <Label htmlFor="setup-name" className="text-sm font-bold text-foreground">{t('examSettings.setups.nameLabel', 'Name of this setup')}</Label>
                          <Input
                            id="setup-name"
                            value={setupName}
                            maxLength={60}
                            onChange={(e) => setSetupName(e.target.value)}
                            placeholder={t('examSettings.setups.namePlaceholder', 'For example: Exam in January')}
                            className="h-11 rounded-xl bg-background"
                          />
                          <label className="flex items-center gap-3 min-h-11 text-xs font-semibold text-foreground cursor-pointer">
                            <input type="checkbox" checked={setupIsDefault} onChange={(e) => setSetupIsDefault(e.target.checked)} className="h-5 w-5 rounded border-border" />
                            {t('examSettings.setups.useAsDefault', 'Open with this setup in this area')}
                          </label>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setSavingOpen(false)} className="h-11 flex-1 rounded-xl font-semibold">{t('examSettings.cancel', 'Cancel')}</Button>
                            <Button type="submit" disabled={!setupName.trim() || savingSetup} className="h-11 flex-1 rounded-xl font-semibold">{t('common.save', 'Save')}</Button>
                          </div>
                        </form>
                      ) : (
                        <Button type="button" variant="outline" onClick={() => setSavingOpen(true)} className="h-11 w-full rounded-xl font-semibold border-border/60">
                          {t('examSettings.setups.saveCurrent', 'Save this setup')}
                        </Button>
                      )}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border/40 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-xl font-semibold">
            {t('examSettings.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleStartExam}
            disabled={isStarting || (preset === 'REVIEW' && !lastSessionId) || (selectedChapterIds.length > 0 && selectedQuestionTotal === 0)}
            className="h-11 bg-primary text-primary-foreground font-semibold rounded-xl gap-2 px-5"
          >
            <Play className="h-4 w-4 shrink-0 fill-current" />
            {startLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
