import { sanitizeHtml } from '../lib/sanitizeHtml';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examprepApi, type ExamSession } from '@/api/examprep';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Check, X, CheckCircle, Loader2, Clock, Grid, Maximize2, LogOut, RefreshCw, SkipForward, ListChecks, WifiOff, Bookmark, StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { OfflineState } from '@/components/pwa/OfflineState';
import { isNetworkError, isOnline, useOnline } from '@/lib/online';
import type { Chapter } from '@/api/examprep';
import { useQuestionMarks } from '@/hooks/useQuestionMarks';
import { NoteDialog } from '@/components/marks/QuestionMarkControls';

const calculateTimeRemaining = (startedAtStr: string, durationMin: number | undefined) => {
  const startedAt = new Date(startedAtStr).getTime();
  const expiryTime = startedAt + (durationMin ?? 0) * 60 * 1000;
  const now = Date.now();
  return Math.max(0, Math.floor((expiryTime - now) / 1000));
};

const formatTimeRemaining = (seconds: number | null) => {
  if (seconds === null || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ExamFlowPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const finishRef = useRef<() => void>(() => {});
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedImageModalUrl, setSelectedImageModalUrl] = useState<string | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<{ questionId: string; optionId: string } | null>(null);

  const online = useOnline();
  const [loadBlockedOffline, setLoadBlockedOffline] = useState(false);
  // Time ran out or the student finished without a connection: submit as soon as it returns.
  const [finishPending, setFinishPending] = useState(false);
  const wasOffline = useRef(!online);

  const marks = useQuestionMarks(session?.studyAreaId);
  const [noteOpen, setNoteOpen] = useState(false);

  const fetchSession = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const data = await examprepApi.getSession(sessionId);
      if (data.completedAt) {
        // If already completed, redirect directly to result
        navigate(`/${locale}/exam/${sessionId}/result`);
        return;
      }
      setSession(data);
      setCurrentIndex(data.currentIndex ?? 0);

      try {
        const chaps = await examprepApi.listChapters(data.studyAreaId);
        setChapters(chaps);
      } catch (e) {
        console.error('Failed to fetch chapters', e);
      }
    } catch (err: any) {
      // The exam isn't lost, it just can't load yet: stay here and retry on reconnect.
      if (!isOnline() || isNetworkError(err)) {
        setLoadBlockedOffline(true);
        return;
      }
      toast({
        type: 'error',
        message: err.response?.data?.message || t('examFlow.failedLoad', 'Failed to load exam session.')
      });
      navigate(`/${locale}/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  // Back online: catch up with the server, then let the student continue.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;

    if (!session) {
      setLoadBlockedOffline(false);
      fetchSession();
      return;
    }
    if (finishPending) {
      setFinishPending(false);
      finishRef.current();
      return;
    }
    toast({ type: 'success', message: t('examFlow.backOnline', 'Connection restored. You can keep answering.') });
    examprepApi.getSession(session.id).then((data) => {
      if (data.completedAt) {
        navigate(`/${locale}/exam/${session.id}/result`);
      } else {
        setSession((prev) => (prev ? { ...prev, answers: data.answers } : prev));
      }
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // The cookie notice and prompts need to sit above the action bar on phones.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => document.documentElement.style.setProperty('--bottom-bar-h', media.matches ? 'calc(4.5rem + var(--sab))' : '0px');
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      document.documentElement.style.removeProperty('--bottom-bar-h');
    };
  }, []);

  useEffect(() => {
    if (!session || !session.settings?.examDurationMinutes || session.completedAt) return;

    const initialRemaining = calculateTimeRemaining(session.startedAt, session.settings.examDurationMinutes);
    setTimeRemaining(initialRemaining);

    if (initialRemaining <= 0) {
      toast({ type: 'warning', message: t('examFlow.timeExpired', 'Exam time has expired! Auto-submitting...') });
      finishRef.current();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(session.startedAt, session.settings.examDurationMinutes);
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        toast({ type: 'warning', message: t('examFlow.timeExpired', 'Exam time has expired! Auto-submitting...') });
        finishRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.id, session?.startedAt, session?.settings?.examDurationMinutes]);

  // Warn before closing or reloading the tab while a timed exam is running.
  const isTimedExamRunning = !!session?.settings?.examDurationMinutes && !session.completedAt && !completedLocally;
  useEffect(() => {
    if (!isTimedExamRunning) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isTimedExamRunning]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (loading) {
    return <PageSkeleton variant="exam" />;
  }

  if (!session && loadBlockedOffline) {
    return (
      <OfflineState description={t('examFlow.offlineLoad', "Your exam can't open without a connection, and it is safe on the server. It will open by itself when you are back online.")} />
    );
  }

  if (!session) return null;

  const currentQuestion = session.questions[currentIndex];
  if (!currentQuestion) return null;

  // Find if user already answered this question in the session
  const existingAnswer = session.answers.find((a) => a.questionId === currentQuestion.id);
  const isAnswered = !!existingAnswer;
  const disabledOptions = !online || isSubmitting || (session.settings.showAnswerPerQuestion ? isAnswered : (isAnswered && !session.settings.allowBack));

  const handleOptionClick = (optionId: string) => {
    if (isSubmitting || !online) return;

    if (session.settings.showAnswerPerQuestion) {
      if (isAnswered) return; // Locked once answered
      setPendingOptionId(optionId);
    } else {
      if (isAnswered && !session.settings.allowBack) return;
      submitAnswerToApi(optionId);
    }
  };

  const submitAnswerToApi = async (optionId: string) => {
    if (isSubmitting || !online) return;
    setIsSubmitting(true);
    setSelectedOptionId(optionId);
    setSaveError(null);

    try {
      const res = await examprepApi.submitAnswer(session.id, currentQuestion.id!, optionId);
      
      // Update local session state with the new answer
      const updatedAnswers = [...session.answers];
      const answerIndex = updatedAnswers.findIndex((a) => a.questionId === currentQuestion.id);

      if (answerIndex > -1) {
        updatedAnswers[answerIndex] = res;
      } else {
        updatedAnswers.push(res);
      }

      // If showAnswerPerQuestion is true, correctOptionId and explanation are returned
      let updatedQuestions = [...session.questions];
      if (session.settings.showAnswerPerQuestion && res.correctOptionId) {
        updatedQuestions = session.questions.map((q) => {
          if (q.id === currentQuestion.id) {
            return {
              ...q,
              correctOptionId: res.correctOptionId,
              explanation: res.explanation,
            };
          }
          return q;
        });
      }

      setSession({
        ...session,
        answers: updatedAnswers,
        questions: updatedQuestions,
      });

      if (session.settings.showAnswerPerQuestion) {
        setPendingOptionId(null);
      }

    } catch {
      // Nothing was saved: don't leave the option looking chosen.
      setSelectedOptionId(null);
      setPendingOptionId(null);
      setSaveError({ questionId: currentQuestion.id!, optionId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQuestionAnswered = (questionId?: string) => session.answers.some((a) => a.questionId === questionId);

  const goToQuestion = (index: number) => {
    setCurrentIndex(index);
    setSelectedOptionId(null);
    setPendingOptionId(null);
    setSaveError(null);
    window.scrollTo(0, 0);
  };

  const isLastQuestion = currentIndex === session.questions.length - 1;

  const handleNext = () => {
    if (isSubmitting) return;
    if (isLastQuestion) {
      setConfirmDialogOpen(true);
    } else {
      goToQuestion(currentIndex + 1);
    }
  };

  // Without allowBack, only skipped (unanswered) questions can be revisited.
  let previousIndex = -1;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (session.settings.allowBack || !isQuestionAnswered(session.questions[i].id)) {
      previousIndex = i;
      break;
    }
  }

  const handlePrev = () => {
    if (!isSubmitting && previousIndex >= 0) goToQuestion(previousIndex);
  };

  const handleFinish = async () => {
    if (!isOnline()) {
      setFinishPending(true);
      return;
    }
    setCompletedLocally(true);
    try {
      await examprepApi.completeSession(session.id);
      navigate(`/${locale}/exam/${session.id}/result`);
    } catch (err: any) {
      setCompletedLocally(false);
      if (isNetworkError(err)) {
        setFinishPending(true);
        return;
      }
      toast({
        type: 'error',
        message: err.response?.data?.message || t('examFlow.failedComplete', 'Failed to complete exam.')
      });
    }
  };
  finishRef.current = handleFinish;

  const totalQuestions = session.questions.length;
  const answeredCount = session.questions.filter((q) => isQuestionAnswered(q.id)).length;
  const unansweredCount = totalQuestions - answeredCount;
  const firstUnansweredIndex = session.questions.findIndex((q) => !isQuestionAnswered(q.id));
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
  const canConfirmPending = session.settings.showAnswerPerQuestion && !isAnswered && !!pendingOptionId;

  const handleExit = () => {
    if (isTimedExamRunning) {
      setExitDialogOpen(true);
    } else {
      navigate(`/${locale}/study-areas/${session.studyAreaId}`);
    }
  };

  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (confirmDialogOpen || navigatorOpen || exitDialogOpen || noteOpen || selectedImageModalUrl || completedLocally) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    if (e.key === 'Enter') {
      // Let a focused control handle its own Enter, except an option that is already chosen.
      if (target?.closest('button, a') && !target.closest('[data-exam-option][aria-pressed="true"]')) return;
      e.preventDefault();
      if (canConfirmPending) {
        submitAnswerToApi(pendingOptionId!);
      } else if (isAnswered) {
        handleNext();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else {
      const key = e.key.toUpperCase();
      const optionIndex = /^[1-6]$/.test(key)
        ? Number(key) - 1
        : /^[A-F]$/.test(key) ? key.charCodeAt(0) - 65 : -1;
      const option = optionIndex >= 0 ? currentQuestion.options[optionIndex] : undefined;
      if (option && !disabledOptions) handleOptionClick(option.id!);
    }
  };

  const currentMark = marks.byQuestion.get(currentQuestion.id!);

  const nextLabel = isLastQuestion
    ? t('examFlow.finishShort', 'Finish')
    : isAnswered ? t('examFlow.nextShort', 'Next') : t('examFlow.skip', 'Skip');
  const showSaveError = saveError?.questionId === currentQuestion.id;
  const timeAnnouncement = timeRemaining === null || timeRemaining > 300
    ? ''
    : timeRemaining > 60
      ? t('examFlow.fiveMinutesLeft', '5 minutes left')
      : t('examFlow.oneMinuteLeft', '1 minute left');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:pt-6 pb-[calc(5.5rem+var(--sab))] md:pb-8 flex flex-col min-h-[100dvh]">

      {/* Focused exam header: the only way out of the exam page */}
      <header className="mb-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground -ml-2 shrink-0"
          >
            <LogOut className="w-4 h-4" />
            {t('examFlow.exit', 'Exit')}
          </Button>
          <span className="truncate text-xs font-semibold text-muted-foreground flex-1 text-center">{session.studyAreaTitle}</span>
          {session.settings?.examDurationMinutes ? (
            <div
              role="timer"
              aria-label={t('examFlow.timeRemaining', 'Time remaining')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-mono text-sm font-bold tabular-nums shrink-0 ${
                timeRemaining !== null && timeRemaining < 60
                  ? 'text-destructive border-destructive/40 bg-destructive/10'
                  : 'text-primary border-primary/20 bg-primary/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {formatTimeRemaining(timeRemaining)}
            </div>
          ) : null}
          <span className="sr-only" aria-live="polite">{timeAnnouncement}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={!!currentMark?.marked}
            aria-label={currentMark?.marked ? t('marks.unmark', 'Remove mark') : t('marks.mark', 'Mark')}
            onClick={() => marks.toggle(currentQuestion.id!)}
            className="h-11 w-11 p-0 rounded-xl shrink-0"
          >
            <Bookmark className={`h-4 w-4 ${currentMark?.marked ? 'fill-primary text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNavigatorOpen(true)}
            className="gap-1.5 rounded-xl shrink-0 h-11 md:h-9 px-2.5"
            aria-label={t('examFlow.questionNavigator', 'Question Navigator')}
          >
            <Grid className="w-4 h-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-bold tabular-nums">{currentIndex + 1}/{totalQuestions}</span>
          </Button>
        </div>
        <div
          role="progressbar"
          aria-label={t('examFlow.progressLabel', 'Answered questions')}
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={answeredCount}
          aria-valuetext={t('examFlow.progressText', '{{answered}} of {{total}} answered', { answered: answeredCount, total: totalQuestions })}
          className="w-full bg-muted rounded-full h-2 overflow-hidden"
        >
          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {!online && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/50 bg-warning/15 p-3 sm:p-4">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold text-foreground">{t('examFlow.offlineTitle', "You're offline: answers can't be saved")}</p>
            <p className="text-sm leading-relaxed text-foreground/80">
              {finishPending
                ? t('examFlow.offlineFinishPending', 'Your exam will be submitted as soon as the connection returns. Keep this page open.')
                : t('examFlow.offlineDesc', 'Answering is blocked until the connection returns. Your saved answers are safe. Keep this page open.')}
            </p>
          </div>
        </div>
      )}

      <Card className="rounded-2xl border border-border/60 bg-card shadow-sm flex flex-col overflow-hidden">
        {currentQuestion.imageUrl && (
          <button
            type="button"
            onClick={() => setSelectedImageModalUrl(currentQuestion.imageUrl!)}
            aria-label={t('examFlow.clickToEnlarge', 'Click to enlarge image')}
            className="w-full relative bg-muted/20 border-b border-border/40 overflow-hidden cursor-zoom-in group max-h-[340px] flex items-center justify-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <img
              src={currentQuestion.imageUrl}
              alt={t('examFlow.imageAlt', 'Question image')}
              className="w-full h-full max-h-[340px] object-contain object-center"
            />
            <span className="absolute bottom-3 right-3 bg-background/90 p-2 rounded-xl border border-border/60 shadow-sm text-foreground">
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        )}

        <CardContent className="p-5 sm:p-8 flex flex-col space-y-6">
          <div
            className="text-base md:text-lg font-bold text-foreground leading-relaxed prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQuestion.prompt) }}
          />

          <div className="grid gap-3" role="group" aria-label={t('examFlow.answerOptions', 'Answer options')}>
            {currentQuestion.options.map((opt, optIndex) => {
              const chosenOptionId = session.settings.showAnswerPerQuestion && !isAnswered
                ? pendingOptionId ?? selectedOptionId
                : selectedOptionId ?? existingAnswer?.selectedOptionId;
              const isCurrentSelected = chosenOptionId === opt.id;

              let optionStyle = 'border-border/60 bg-background hover:bg-muted/20';
              let icon = null;
              let statusText = '';

              if (session.settings.showAnswerPerQuestion && isAnswered) {
                const isCorrectAnswer = currentQuestion.correctOptionId === opt.id;
                const isUserSelection = existingAnswer?.selectedOptionId === opt.id;

                if (isCorrectAnswer) {
                  optionStyle = 'border-success/50 bg-success/10 text-foreground';
                  icon = <Check className="h-4.5 w-4.5 text-success shrink-0" aria-hidden="true" />;
                  statusText = t('examFlow.optionCorrect', 'Correct answer');
                } else if (isUserSelection) {
                  optionStyle = 'border-destructive/50 bg-destructive/10 text-foreground';
                  icon = <X className="h-4.5 w-4.5 text-destructive shrink-0" aria-hidden="true" />;
                  statusText = t('examFlow.optionWrong', 'Your answer, incorrect');
                } else {
                  optionStyle = 'border-border/40 opacity-60';
                }
              } else if (isCurrentSelected) {
                optionStyle = 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabledOptions}
                  aria-pressed={isCurrentSelected}
                  data-exam-option
                  onClick={() => handleOptionClick(opt.id!)}
                  className={`p-3.5 sm:p-4 border text-left rounded-xl transition-colors font-medium flex items-center gap-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${optionStyle} ${disabledOptions ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center text-xs font-bold ${isCurrentSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
                  >
                    {String.fromCharCode(65 + optIndex)}
                  </span>
                  <span className="flex-1 min-w-0">{opt.text}</span>
                  {statusText && <span className="sr-only">{statusText}</span>}
                  {icon}
                </button>
              );
            })}
          </div>

          {showSaveError && (
            <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10">
              <p className="text-sm font-medium text-foreground">
                {t('examFlow.saveFailed', "Your answer wasn't saved. Check your connection and try again.")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting || !online}
                onClick={() => submitAnswerToApi(saveError!.optionId)}
                className="rounded-xl gap-1.5 shrink-0"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {t('common.retry', 'Try again')}
              </Button>
            </div>
          )}

          {session.settings.showAnswerPerQuestion && isAnswered && currentQuestion.explanation && (
            <div className="p-4 border rounded-2xl bg-primary/[0.02] border-primary/20 space-y-2">
              <h2 className="text-xs font-bold uppercase text-primary tracking-wider flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" aria-hidden="true" /> {t('examFlow.explanation', 'Explanation')}
              </h2>
              <div
                className="text-sm text-muted-foreground leading-relaxed prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQuestion.explanation) }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="hidden md:block mt-3 text-center text-[11px] text-muted-foreground">
        {t('examFlow.shortcutsHint', 'Shortcuts: 1-6 or A-F to choose, Enter to confirm or continue, arrows to change question')}
      </p>

      {/* Actions: pinned to the bottom on mobile, in flow from md up. Fixed columns, so each action
          stays in the same place from one question to the next. */}
      <div className="fixed md:static inset-x-0 bottom-0 z-40 md:mt-4 border-t md:border-0 border-border bg-background md:bg-transparent px-4 md:px-0 pt-3 md:pt-0 pb-[max(0.75rem,var(--sab))] md:pb-0">
        <div className="mx-auto max-w-3xl grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrev}
            disabled={previousIndex < 0 || isSubmitting}
            aria-label={t('examFlow.prev', 'Previous question')}
            className="h-11 w-11 p-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {isLastQuestion ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setNavigatorOpen(true)}
              className="h-11 w-full font-semibold gap-2 px-2"
            >
              <ListChecks className="w-4 h-4" aria-hidden="true" />
              {t('examFlow.reviewShort', 'Review')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={completedLocally || !online}
              className="h-11 w-full font-semibold px-2"
            >
              {completedLocally && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('examFlow.finishShort', 'Finish')}
            </Button>
          )}
          {canConfirmPending ? (
            <Button
              type="button"
              onClick={() => submitAnswerToApi(pendingOptionId!)}
              disabled={isSubmitting || !online}
              className="h-11 w-full font-bold gap-2 px-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {t('examFlow.confirmShort', 'Confirm')}
            </Button>
          ) : (
            <Button
              type="button"
              variant={isAnswered || isLastQuestion ? 'default' : 'outline'}
              onClick={handleNext}
              disabled={isSubmitting || completedLocally || (isLastQuestion && !online)}
              className="h-11 w-full font-bold gap-2 px-2"
            >
              {completedLocally ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {nextLabel}
              {isLastQuestion ? <CheckCircle className="w-4 h-4" /> : isAnswered ? <ArrowRight className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Submission Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('examFlow.submitEvaluation', 'Finish & Submit Exam')}</DialogTitle>
            <DialogDescription>
              {unansweredCount > 0
                ? t('examFlow.confirmSubmitUnanswered', 'Unanswered questions: {{count}} of {{total}}. They appear separately in the results and earn no points.', { count: unansweredCount, total: totalQuestions })
                : t('examFlow.confirmSubmitAll', 'You answered all the questions. Submit to see your result.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {unansweredCount > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDialogOpen(false);
                  goToQuestion(firstUnansweredIndex);
                }}
                className="rounded-xl"
              >
                {t('examFlow.reviewUnanswered', 'Go to unanswered')}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} className="rounded-xl">
                {t('examFlow.keepGoing', 'Back to exam')}
              </Button>
            )}
            <Button
              onClick={() => {
                setConfirmDialogOpen(false);
                handleFinish();
              }}
              disabled={completedLocally || !online}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl"
            >
              {t('examFlow.submitEvaluation', 'Finish & Submit Exam')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation for timed exams */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('examFlow.exitTitle', 'Leave the exam?')}</DialogTitle>
            <DialogDescription>
              {t('examFlow.exitDesc', 'The timer keeps running while you are away. Your answers are saved and you can come back while there is time left.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/${locale}/study-areas/${session.studyAreaId}`)}
              className="rounded-xl"
            >
              {t('examFlow.exitConfirm', 'Leave exam')}
            </Button>
            <Button onClick={() => setExitDialogOpen(false)} className="rounded-xl font-bold">
              {t('examFlow.keepGoing', 'Back to exam')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Navigator Dialog */}
      {session && (
        <Dialog open={navigatorOpen} onOpenChange={setNavigatorOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
            <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/30">
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary" /> {t('examFlow.questionNavigator', 'Question Navigator')}
              </DialogTitle>
              <DialogDescription>
                {t('examFlow.navigatorDescPlain', 'Go to any question. Those without colour are still unanswered.')}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 p-6 space-y-8">
              {(() => {
                const getAnswerForQuestion = (qId: string) => session.answers.find(a => a.questionId === qId);

                const groupedQuestions = session.questions.reduce((acc, q, idx) => {
                  const cId = chapters.length > 0 ? (q.chapterId || 'uncategorized') : 'all';
                  if (!acc[cId]) acc[cId] = [];
                  acc[cId].push({ question: q, index: idx });
                  return acc;
                }, {} as Record<string, { question: any, index: number }[]>);

                return Object.entries(groupedQuestions).map(([chapterId, qs]) => {
                  const chapter = chapters.find(c => c.id === chapterId);
                  const title = chapter ? chapter.title : (chapterId === 'uncategorized' ? t('examFlow.uncategorized', 'Uncategorized') : t('examFlow.other', 'Other'));
                  
                  return (
                    <div key={chapterId} className="space-y-3">
                      {chapterId !== 'all' && (
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1.5">{title}</h4>
                      )}
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 md:gap-3">
                        {qs.map(({ question, index }) => {
                          const answer = getAnswerForQuestion(question.id!);
                          const isAnswered = !!answer;
                          let statusColor = 'border-border/60 bg-background hover:bg-muted/60 text-muted-foreground';

                          if (isAnswered) {
                            if (session.settings.showAnswerPerQuestion) {
                               const isCorrect = answer.correct === true || (answer.correctOptionId && answer.correctOptionId === answer.selectedOptionId);
                               if (isCorrect) {
                                 statusColor = 'border-success/50 bg-success/10 text-success ring-1 ring-success/20';
                               } else {
                                 statusColor = 'border-destructive/50 bg-destructive/10 text-destructive ring-1 ring-destructive/20';
                               }
                            } else {
                               statusColor = 'border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/20';
                            }
                          }

                          if (currentIndex === index) {
                             statusColor += ' ring-2 ring-primary ring-offset-1 ring-offset-background scale-105 shadow-sm';
                          }

                          // Without allowBack, answered questions stay closed but skipped ones can be reopened.
                          const canNavigate = session.settings.allowBack || !isAnswered || index === currentIndex;
                          const isMarked = !!marks.byQuestion.get(question.id!)?.marked;

                          return (
                            <button
                              key={question.id}
                              disabled={!canNavigate}
                              onClick={() => {
                                goToQuestion(index);
                                setNavigatorOpen(false);
                              }}
                              aria-current={currentIndex === index ? 'true' : undefined}
                              aria-label={isAnswered
                                ? t('examFlow.navAnswered', 'Question {{number}}, answered', { number: index + 1 })
                                : t('examFlow.navUnanswered', 'Question {{number}}, unanswered', { number: index + 1 })}
                              className={`relative aspect-square rounded-xl border flex items-center justify-center font-bold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusColor} ${canNavigate ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                            >
                              {index + 1}
                              {isMarked && (
                                <>
                                  <Bookmark className="absolute right-0.5 top-0.5 h-3 w-3 fill-primary text-primary" aria-hidden="true" />
                                  <span className="sr-only">{t('marks.marked', 'Marked')}</span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="p-4 bg-muted/20 border-t border-border/40 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNavigatorOpen(false);
                  setNoteOpen(true);
                }}
                className="min-h-11 rounded-xl gap-1.5"
              >
                <StickyNote className="h-4 w-4" aria-hidden="true" />
                {t('marks.noteForQuestion', 'Note on question {{number}}', { number: currentIndex + 1 })}
              </Button>
              <Button variant="outline" onClick={() => setNavigatorOpen(false)} className="min-h-11 rounded-xl">
                {t('common.close', 'Close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} questionId={currentQuestion.id!} marks={marks} />

      {/* Full Screen Image Lightbox Modal */}
      {selectedImageModalUrl && (
        <Dialog open={!!selectedImageModalUrl} onOpenChange={(open) => !open && setSelectedImageModalUrl(null)}>
          <DialogContent 
            data-fullscreen
            showCloseButton={false}
            className="inset-0 w-screen h-screen max-w-none sm:max-w-none m-0 p-0 rounded-none border-0 bg-black/95 backdrop-blur-2xl ring-0 flex items-center justify-center overflow-hidden"
          >
            {/* Clickable fullscreen container */}
            <div 
              onClick={() => setSelectedImageModalUrl(null)}
              className="w-full h-full flex items-center justify-center p-4 sm:p-10 relative cursor-zoom-out select-none"
            >
              {/* Floating Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageModalUrl(null);
                }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full backdrop-blur-md transition-all shadow-2xl flex items-center justify-center cursor-pointer border border-white/20"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-6 h-6" />
              </button>

              {/* Full Screen Image */}
              <img
                src={selectedImageModalUrl}
                alt={t('examFlow.imageAlt', 'Question image')}
                onClick={(e) => e.stopPropagation()}
                className="max-w-full max-h-full w-auto h-auto object-contain drop-shadow-2xl animate-in zoom-in-95 duration-300 cursor-default"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
