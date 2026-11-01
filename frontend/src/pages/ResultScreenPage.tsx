import { formatDecimal, formatTrimmed } from '@/lib/format';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examprepApi, type ExamSession, type Chapter, type Question, type SessionComparison } from '@/api/examprep';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, XCircle, HelpCircle, Sparkles, BookOpen, ChevronDown, Share2, Settings, Folder, Target, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { handleSessionStartError } from '@/lib/sessionStartError';
import { useQuestionMarks } from '@/hooks/useQuestionMarks';
import { useConfig } from '@/lib/config/useConfig';
import { QuestionMarkBar } from '@/components/marks/QuestionMarkControls';
import { SessionReportCard } from '@/components/reports/SessionReportCard';

// A result page can be reopened at any time; only a freshly finished exam counts as a completion event.
export const ResultScreenPage: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<SessionComparison | null>(null);
  const [starting, setStarting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const marks = useQuestionMarks(session?.studyAreaId);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleShareResult = async () => {
    if (!session) return;
    const url = `${window.location.origin}/${locale}/study-areas/${session.studyAreaId}`;
    const text = t('results.shareText', {
      defaultValue: 'I scored {{score}}/20 on "{{area}}" at {{site}}. Can you beat me?',
      site: config.company_name,
      score: formatDecimal(session.finalScore, locale),
      area: session.studyAreaTitle,
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: config.company_name, text, url });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // Sharing is unavailable in this context: fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast({ type: 'success', message: t('results.shareCopied', 'Result copied to the clipboard!') });
    } catch {
      toast({ type: 'error', message: t('results.shareFailed', 'Could not copy the result.') });
    }
  };

  const handlePracticeWrong = async () => {
    if (!session) return;
    setStarting(true);
    try {
      const practice = await examprepApi.practiceWrongAnswers(session.id);
      navigate(`/${locale}/exam/${practice.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId: session.studyAreaId, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  const handleRepeatExam = async () => {
    if (!session) return;
    setStarting(true);
    try {
      const settings = { ...session.settings, selectedQuestionIds: undefined };
      const repeat = await examprepApi.startSession(session.studyAreaId, settings);
      navigate(`/${locale}/exam/${repeat.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId: session.studyAreaId, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  const fetchResult = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const data = await examprepApi.getSessionResult(sessionId);
      setSession(data);
      examprepApi.getSessionComparison(data.id).then((result) => {
        setComparison(result);
      }).catch(() => undefined);
      try {
        const chapData = await examprepApi.listChapters(data.studyAreaId);
        setChapters(chapData);

        // Also fetch StudyArea to map missing chapterIds on questions if the backend omitted them in the session result
        const fullStudyArea = await examprepApi.getStudyArea(data.studyAreaId);
        if (fullStudyArea?.questions) {
          data.questions = data.questions.map((q) => {
            const originalQ = fullStudyArea.questions?.find((sq) => sq.id === q.id);
            return { ...q, chapterId: originalQ?.chapterId || q.chapterId };
          });
        }
      } catch (err) {
        console.error("Failed to load chapters or study area questions", err);
      }
    } catch (err: any) {
      toast({
        type: 'error',
        message: t('results.loadFailed', 'Failed to retrieve exam results.')
      });
      navigate(`/${locale}/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [sessionId]);

  if (loading) {
    return <PageSkeleton variant="result" />;
  }

  if (!session) return null;

  const score = session.finalScore ?? 0.0;
  const passingScore = session.settings?.passingScore ?? 10.0;
  const isPass = score >= passingScore;

  // Calculate statistics
  const totalQuestions = session.questions.length;
  const correctCount = session.answers.filter((a) => a.correct).length;
  const wrongCount = session.answers.filter((a) => a.selectedOptionId && !a.correct).length;
  const unansweredCount = totalQuestions - correctCount - wrongCount;
  const toPracticeCount = wrongCount + unansweredCount;
  const isPractice = comparison?.practice ?? !!session.practiceOfSessionId;
  const delta = comparison?.scoreDelta ?? null;

  // Group questions by chapter
  const chapterMap: Record<string, Question[]> = {};
  if (chapters.length > 0) {
    session.questions.forEach((q) => {
      const cId = q.chapterId || 'uncategorized';
      if (!chapterMap[cId]) chapterMap[cId] = [];
      chapterMap[cId].push(q);
    });
  }

  const renderQuestion = (q: Question, idx: number) => {
    const ans = session.answers.find((a) => a.questionId === q.id);
    const isCorrect = ans && ans.correct;
    const hasAnswered = ans && ans.selectedOptionId;
    const isOpen = expandedIndex === idx;

    let badge = (
      <Badge variant="outline" className="border-border text-muted-foreground text-[11px]">
        {t('results.unanswered', 'Unanswered')}
      </Badge>
    );

    if (hasAnswered) {
      badge = isCorrect ? (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-[11px]">
          {t('results.correctOne', 'Correct')}
        </Badge>
      ) : (
        <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive text-[11px]">
          {t('results.incorrectOne', 'Incorrect')}
        </Badge>
      );
    }

    return (
      <div
        key={q.id}
        className="border border-border/50 bg-card/65 backdrop-blur rounded-2xl overflow-hidden shadow-sm"
      >
        <button
          type="button"
          onClick={() => setExpandedIndex(isOpen ? null : idx)}
          className="w-full hover:no-underline py-4 px-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 text-left min-w-0 flex-1">
            <span className="text-xs font-black text-muted-foreground shrink-0">{t('results.questionShort', 'Q')}{idx + 1}</span>
            <span
              className="text-xs font-bold text-foreground/80 line-clamp-1 prose dark:prose-invert min-w-0"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.prompt) }}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="pb-5 pt-1 px-4 space-y-4 border-t border-border/30 mt-1 animate-in slide-in-from-top-1 duration-150">
            {/* Prompt in full */}
            <div className="space-y-2 pt-3">
              <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.questionPrompt', 'Question')}</span>
              <div
                className="text-sm text-foreground/90 leading-relaxed prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.prompt) }}
              />
              {q.imageUrl && (
                <div className="rounded-xl overflow-hidden border max-h-[150px] w-fit mt-2">
                  <img src={q.imageUrl} alt={t('results.questionImageAlt', 'Image of the question')} className="object-contain max-h-[150px]" />
                </div>
              )}
            </div>

            {/* Options review */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.options', 'Options')}</span>
              <div className="grid gap-2">
                {q.options.map((opt) => {
                  const isCorrectOpt = q.correctOptionId === opt.id;
                  const isUserSelection = ans?.selectedOptionId === opt.id;

                  let optStyle = 'border-border/60 bg-background/50';
                  let checkIcon = null;

                  if (isCorrectOpt) {
                    optStyle = 'border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300';
                    checkIcon = <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
                  } else if (isUserSelection) {
                    optStyle = 'border-destructive/40 bg-destructive/5 text-destructive';
                    checkIcon = <XCircle className="h-4 w-4 text-destructive shrink-0" />;
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-4 text-xs font-medium ${optStyle}`}
                    >
                      <span>{opt.text}</span>
                      {checkIcon}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Your mark and note */}
            <QuestionMarkBar questionId={q.id!} marks={marks} />

            {/* Explanation */}
            {q.explanation && (
              <div className="p-4 border rounded-xl bg-primary/[0.01] border-primary/10 space-y-1.5">
                <span className="text-[11px] font-black uppercase text-primary tracking-wider block">{t('results.explanation', 'Explanation')}</span>
                <div
                  className="text-xs text-muted-foreground leading-relaxed prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation) }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-3xl space-y-8">
      
      {/* Back to dashboard */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/${locale}/dashboard`)}
          className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" /> {t('results.backToDashboard', 'Back to Dashboard')}
        </Button>
      </div>

      {/* Prominent Score Card */}
      <Card className="rounded-2xl border border-border/50 bg-card/65 backdrop-blur shadow-lg overflow-hidden relative text-center">
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${isPass ? 'bg-emerald-500' : 'bg-destructive'}`} />
        <CardContent className="p-5 sm:p-8 space-y-6 flex flex-col items-center justify-center">
          
          <div className="space-y-1">
            <Badge variant="outline" className={`font-black uppercase tracking-widest text-[11px] px-2.5 h-5 rounded-md ${
              isPass
                ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-destructive/30 text-destructive bg-destructive/5'
            }`}>
              {isPass ? t('results.passed', 'Passed') : t('results.needsReview', 'Needs Review')}
            </Badge>
            <h2 className="text-lg font-black text-foreground">{session.studyAreaTitle}</h2>
          </div>

          {/* Large circular score display */}
          <div className="relative flex flex-col items-center justify-center">
            <div className={`h-40 w-40 rounded-full border-4 flex flex-col items-center justify-center shadow-md bg-gradient-to-br from-card to-muted/10 ${
              isPass ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-destructive text-destructive'
            }`}>
              <span className="text-4xl font-black">{score.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className="text-muted-foreground text-xs font-bold mt-1">/ 20</span>
            </div>
            {isPass && (
              <div className="absolute -top-1 -right-1 p-1.5 bg-emerald-500 text-white rounded-full">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-md pt-6 border-t border-border/40 text-center">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">{t('results.correct', 'Correct')}</span>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-base font-bold text-foreground">{correctCount}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">{t('results.incorrect', 'Incorrect')}</span>
              <div className="flex items-center justify-center gap-1.5">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-base font-bold text-foreground">{wrongCount}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">{t('results.unanswered', 'Unanswered')}</span>
              <div className="flex items-center justify-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-base font-bold text-foreground">{unansweredCount}</span>
              </div>
            </div>
          </div>

          {/* What this result means */}
          <div className="w-full max-w-md space-y-1.5 text-sm text-foreground leading-normal" aria-live="polite">
            {isPractice && (
              <p className="text-muted-foreground">
                {session.sessionKind === 'MARKED'
                  ? t('results.markedNote', 'Practice of your marked questions. This session does not count towards your score trend.')
                  : t('results.practiceNote', 'Practice of your mistakes. This session does not count towards your score trend.')}
              </p>
            )}
            {!isPractice && comparison && delta !== null && comparison.previousScore !== null && (
              <p className="flex items-center justify-center gap-1.5 font-semibold">
                {delta > 0 ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                  : delta < 0 ? <TrendingDown className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                  : <Minus className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />}
                {delta > 0
                  ? t('results.compareUp', { defaultValue: '{{delta}} more than your previous attempt ({{previous}})', delta: formatDecimal(delta, locale), previous: formatDecimal(comparison.previousScore, locale) })
                  : delta < 0
                  ? t('results.compareDown', { defaultValue: '{{delta}} less than your previous attempt ({{previous}})', delta: formatDecimal(Math.abs(delta), locale), previous: formatDecimal(comparison.previousScore, locale) })
                  : t('results.compareSame', { defaultValue: 'Same score as your previous attempt ({{previous}})', previous: formatDecimal(comparison.previousScore, locale) })}
              </p>
            )}
            {!isPractice && comparison && comparison.previousScore === null && (
              <p className="text-muted-foreground">{t('results.compareFirst', 'First attempt in this area. Repeat it to see how you evolve.')}</p>
            )}
            {!isPractice && (
              <p className="text-muted-foreground">
                {isPass
                  ? t('results.aboveMinimum', { defaultValue: 'Minimum to pass: {{minimum}}.', minimum: formatDecimal(passingScore, locale) })
                  : t('results.belowMinimum', { defaultValue: 'You are {{missing}} away from the minimum of {{minimum}}.', missing: formatDecimal(passingScore - score, locale), minimum: formatDecimal(passingScore, locale) })}
              </p>
            )}
            {comparison?.weakestChapterTitle && (
              <p className="text-muted-foreground">
                {t('results.reviewFirst', { defaultValue: 'Review first: {{chapter}} ({{missed}} of {{total}} to fix).', chapter: comparison.weakestChapterTitle, missed: comparison.weakestChapterMissed, total: comparison.weakestChapterTotal })}
              </p>
            )}
          </div>

          {/* Next step */}
          <div className="flex flex-col gap-2.5 w-full max-w-sm">
            {toPracticeCount > 0 && (
              <Button type="button" onClick={handlePracticeWrong} disabled={starting} className="bg-primary text-primary-foreground font-bold rounded-xl gap-2 w-full min-h-11 h-auto py-2 whitespace-normal shadow-sm">
                <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
                {toPracticeCount === 1
                  ? t('results.practiceWrongOne', 'Practice my 1 wrong answer')
                  : t('results.practiceWrong', { defaultValue: 'Practice my {{count}} wrong answers', count: toPracticeCount })}
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="outline" onClick={handleRepeatExam} disabled={starting} className={`font-semibold rounded-xl gap-2 h-10 border-border/60 ${isPractice ? 'col-span-2' : ''}`}>
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('results.repeatExam', 'Repeat exam')}
              </Button>
              {!isPractice && (
                <Button type="button" variant="outline" onClick={handleShareResult} className="font-semibold rounded-xl gap-2 h-10 border-border/60">
                  <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('results.share', 'Share')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SessionReportCard session={session} />

      {/* The student has just seen what the app is for: a good moment to offer the install. */}
      <InstallPrompt />

      {/* Exam Configurations */}
      <Card className="rounded-2xl border border-border/50 bg-card/65 backdrop-blur shadow-md p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
          <Settings className="h-4 w-4 text-primary shrink-0" /> {t('results.settingsTitle', 'Exam Settings')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          
          {/* Passing Score */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.passingScore', 'Passing Score')}</span>
            <span className="font-bold text-foreground">{passingScore.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 20</span>
          </div>

          {/* Timer */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.timeLimit', 'Time Limit')}</span>
            <span className="font-bold text-foreground">
              {session.settings?.examDurationMinutes 
                ? `${session.settings.examDurationMinutes} min` 
                : t('results.noLimit', 'No Limit')}
            </span>
          </div>

          {/* Show Answer Instantly */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.instantFeedback', 'Instant Feedback')}</span>
            <span className="font-bold text-foreground">
              {session.settings?.showAnswerPerQuestion ? t('results.enabled', 'Enabled') : t('results.disabled', 'Disabled')}
            </span>
          </div>

          {/* Allow Back Navigation */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.backNavigation', 'Back Navigation')}</span>
            <span className="font-bold text-foreground">
              {session.settings?.allowBack ? t('results.enabled', 'Enabled') : t('results.disabled', 'Disabled')}
            </span>
          </div>

          {/* Discount Factor */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">
              {t('examSettings.wrongPenalty', 'Wrong Penalty')}
            </span>
            <span className="font-bold text-foreground">
              {session.settings?.discountFactor 
                ? `-${formatTrimmed(session.settings.discountFactor, locale)} ${t('examSettings.ptPerWrong', 'pt / wrong')}` 
                : t('examSettings.noPenalty', 'No Penalty')}
            </span>
          </div>

          {/* Filtered Chapters */}
          <div className="p-3 bg-muted/20 border border-border/20 rounded-xl space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-black uppercase text-muted-foreground block">{t('results.chaptersFiltered', 'Chapters')}</span>
            <span className="font-bold text-foreground truncate block">
              {session.settings?.selectedChapterIds?.length 
                ? t('results.chapterCount', { defaultValue: '{{count}} chapter(s)', count: session.settings.selectedChapterIds.length }) 
                : t('results.allChapters', 'All Chapters')}
            </span>
          </div>

        </div>
      </Card>

      {/* Accordion Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" /> {t('results.reviewTitle', 'Question Review')}
        </h3>

        <div className="space-y-3">
          {chapters.length > 0 ? (
            Object.entries(chapterMap).map(([chapterId, questionsInChapter]) => {
              const chapterTitle = chapterId === 'uncategorized' ? t('results.uncategorized', 'General / Uncategorized') : chapters.find(c => c.id === chapterId)?.title || t('results.unknownChapter', 'Unknown Chapter');
              const isExpanded = expandedChapters[chapterId];

              return (
                <div key={chapterId} className="space-y-2 mb-6">
                  <button
                    onClick={() => toggleChapter(chapterId)}
                    className="w-full text-left flex items-center justify-between text-sm font-bold text-foreground border-b border-border/40 pb-2 hover:bg-muted/5 transition-colors px-1"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      {chapterTitle}
                      <span className="text-[11px] bg-muted/30 px-2 py-0.5 rounded-full text-muted-foreground">{questionsInChapter.length}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-3 pl-2 border-l-2 border-primary/10 pt-2 animate-in slide-in-from-top-1 duration-200">
                      {questionsInChapter.map((q) => renderQuestion(q, session.questions.findIndex(sq => sq.id === q.id)))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            session.questions.map((q, idx) => renderQuestion(q, idx))
          )}
        </div>
      </div>
    </div>
  );
};
