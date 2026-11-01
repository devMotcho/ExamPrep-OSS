import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, ChevronRight, Clock, Play, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { SessionCalendar } from '@/components/examprep/SessionCalendar';
import { ProgressPanel } from '@/components/examprep/ProgressPanel';
import { ReturnPanel } from '@/components/examprep/ReturnPanel';
import { planSentence } from './planCopy';
import { examprepApi, type AreaProgress, type ChapterAccuracy, type ExamSession, type PopularArea, type Readiness, type RetentionState, type StudyArea, type StudyPlan } from '@/api/examprep';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { readinessAreaId } from '@/lib/readiness';
import { paginate } from '@/lib/pagination';
import { handleSessionStartError } from '@/lib/sessionStartError';
import { StudentClassicDashboard, StudentTabbedDashboard, toStudentTab, type StudentTab } from './StudentCompositions';
import { ReadinessCard } from './ReadinessCard';

const AREAS_PER_PAGE = 6;
const SESSIONS_PER_PAGE = 5;

export const StudentDashboard: React.FC = () => {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [progress, setProgress] = useState<AreaProgress[]>([]);
  const [retention, setRetention] = useState<RetentionState | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [popularArea, setPopularArea] = useState<PopularArea | null>(null);
  const [starting, setStarting] = useState(false);
  const [areas, setAreas] = useState<StudyArea[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [areasPage, setAreasPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);

  const filteredSessions = selectedDate
    ? sessions.filter((s) => s.startedAt && s.startedAt.split('T')[0] === selectedDate)
    : sessions;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [areasData, sessionsData] = await Promise.all([
          examprepApi.listMyStudyAreas(),
          examprepApi.listMySessions()
        ]);
        setAreas(areasData);
        setSessions(sessionsData);
        // Secondary panels: if one fails, the dashboard still works without it.
        if (sessionsData.length === 0) {
          setPopularArea(await examprepApi.getPopularArea().catch(() => null));
        } else {
          examprepApi.getProgress().then(setProgress).catch(() => undefined);
        }
        examprepApi.getRetention().then(setRetention).catch(() => undefined);
      } catch {
        toast({ type: 'error', message: t('studentDashboard.loadFailed', 'Failed to load dashboard data.') });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Today's plan, refreshed when an exam date or the day's progress changes.
  useEffect(() => {
    examprepApi.getStudyPlan().then(setPlan).catch(() => setPlan(null));
  }, [retention?.examDates.map((d) => `${d.studyAreaId}:${d.examDate}`).join(), retention?.answeredToday]);

  // Secondary panel for the area in focus: without it the dashboard still works.
  const focusAreaId = readinessAreaId(plan?.studyAreaId, retention?.examDates, progress[0]?.studyAreaId);
  useEffect(() => {
    if (!focusAreaId) return;
    examprepApi.getReadiness(focusAreaId).then(setReadiness).catch(() => setReadiness(null));
  }, [focusAreaId]);

  if (loading) {
    return (
      <PageSkeleton variant="dashboard" />
    );
  }

  const isFirstRun = sessions.length === 0;
  const activeSession = sessions.find((s) => !s.completedAt);
  const nextArea = progress.find((p) => p.recommendation);

  const defaultSettings = { showAnswerPerQuestion: true, allowBack: true, discountFactor: 0, passingScore: 10, examDurationMinutes: 0 };

  const startExamNow = async () => {
    if (!popularArea) {
      navigate(`/${locale}/study-areas`);
      return;
    }
    setStarting(true);
    try {
      const session = await examprepApi.startSession(popularArea.id, defaultSettings);
      navigate(`/${locale}/exam/${session.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId: popularArea.id, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  const trainChapter = async (studyAreaId: string, chapter: ChapterAccuracy) => {
    setStarting(true);
    try {
      const session = await examprepApi.startSession(studyAreaId, { ...defaultSettings, selectedChapterIds: [chapter.chapterId] });
      navigate(`/${locale}/exam/${session.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  const planReady = !activeSession && plan?.state === 'READY' ? plan : null;

  const startPlan = async () => {
    if (!planReady) return;
    if (planReady.activeSessionId) {
      navigate(`/${locale}/exam/${planReady.activeSessionId}`);
      return;
    }
    setStarting(true);
    try {
      const session = await examprepApi.startStudyPlan(planReady.studyAreaId);
      navigate(`/${locale}/exam/${session.id}`);
    } catch (err) {
      await handleSessionStartError({ err, studyAreaId: planReady.studyAreaId!, locale, t, toast, navigate });
    } finally {
      setStarting(false);
    }
  };

  const planHint = activeSession || !plan
    ? null
    : plan.state === 'NO_DATE'
      ? t('plan.noDate', 'Set your exam date below to get a daily plan.')
      : plan.state === 'PAST_DATE'
        ? t('plan.pastDate', { defaultValue: 'The date of your {{area}} exam has passed. Set the new one below.', area: plan.areaTitle })
        : plan.state === 'NO_QUESTIONS'
          ? t('plan.noQuestions', { defaultValue: '{{area}} has no questions yet, so there is no plan for it.', area: plan.areaTitle })
          : null;

  const areaOptions = [
    ...areas.map((a) => ({ id: a.id, title: a.title })),
    ...progress.filter((p) => !areas.some((a) => a.id === p.studyAreaId)).map((p) => ({ id: p.studyAreaId, title: p.title })),
  ];

  const intro = isFirstRun ? (
        <Card className="rounded-2xl border border-primary/20 bg-card/65 backdrop-blur p-6 md:p-8 shadow-sm space-y-5">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-xl md:text-2xl font-black text-foreground">{t('firstRun.title', 'Start with one exam')}</h2>
            <p className="text-sm text-muted-foreground leading-normal">
              {popularArea
                ? t('firstRun.descWithArea', { defaultValue: 'See where you stand in a few minutes. We suggest {{area}}, the most practised public area.', area: popularArea.title })
                : t('firstRun.descNoArea', 'See where you stand in a few minutes. Choose a public area to begin.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" onClick={startExamNow} disabled={starting} className="h-11 rounded-xl font-bold gap-2">
              <Play className="h-4 w-4" aria-hidden="true" /> {t('firstRun.takeExam', 'Take an exam now')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/${locale}/study-areas/new`)} className="h-11 rounded-xl font-bold gap-2 border-border/60">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('firstRun.createArea', 'Create my area')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-primary">{t('nextAction.title', 'Your next step')}</h2>
                {planReady ? (
                  <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
                    {planReady.goalMet
                      ? t('plan.goalMet', 'Goal met')
                      : t('plan.goalProgress', { defaultValue: '{{answered}}/{{goal}} today', answered: planReady.answeredToday, goal: planReady.dailyGoal })}
                  </span>
                ) : null}
              </div>
              <p className={`text-sm sm:text-base font-bold text-foreground ${planReady ? 'line-clamp-3' : 'line-clamp-2'}`}>
                {activeSession
                  ? t('nextAction.resume', { defaultValue: 'Continue your exam in {{area}}', area: activeSession.studyAreaTitle })
                  : planReady
                  ? planSentence(planReady, t)
                  : nextArea?.recommendation
                    ? t('nextAction.train', { defaultValue: 'Train {{chapter}} in {{area}}', chapter: nextArea.recommendation.title, area: nextArea.title })
                    : t('nextAction.practise', { defaultValue: 'Practise again in {{area}}', area: sessions[0].studyAreaTitle })}
              </p>
              {planHint && <p className="text-xs text-muted-foreground line-clamp-2">{planHint}</p>}
            </div>
            <Button
              type="button"
              disabled={starting}
              onClick={() => {
                if (activeSession) navigate(`/${locale}/exam/${activeSession.id}`);
                else if (planReady) startPlan();
                else if (nextArea?.recommendation) trainChapter(nextArea.studyAreaId, nextArea.recommendation);
                else navigate(`/${locale}/study-areas/${sessions[0].studyAreaId}`);
              }}
              className="h-11 px-5 font-bold gap-1.5 shrink-0 w-full sm:w-auto"
            >
              {activeSession ? t('studentDashboard.resume', 'Resume') : t('nextAction.start', 'Start')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {retention && <ReturnPanel retention={retention} areaOptions={areaOptions} onChange={setRetention} />}
          {sessions.some((s) => s.completedAt) && <InstallPrompt />}
        </>
      );

  const pagedAreas = paginate(areas, areasPage, AREAS_PER_PAGE);
  const pagedSessions = paginate(filteredSessions, sessionsPage, SESSIONS_PER_PAGE);
  const selectDate = (date: string | null) => {
    setSelectedDate(date);
    setSessionsPage(1);
  };

  const areasSection = (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> {t('studentDashboard.myStudyAreas', 'My Study Areas')}
          </h2>
          <div className="flex gap-2 self-start lg:self-auto w-full lg:w-auto">
            <Button onClick={() => navigate(`/${locale}/study-areas`)} variant="outline" size="sm" className="flex-1 lg:flex-none rounded-xl font-semibold border-border/60 hover:bg-muted text-xs">
              {t('studentDashboard.browsePublic', 'All')}
            </Button>
            <Button onClick={() => navigate(`/${locale}/study-areas/new`)} size="sm" className="flex-1 lg:flex-none rounded-xl font-semibold bg-primary text-xs text-primary-foreground flex justify-center items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> {t('studentDashboard.newArea', 'New Area')}
            </Button>
          </div>
        </div>

        {areas.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-10 text-center flex flex-col items-center justify-center space-y-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold">{t('studentDashboard.noAreasTitle', 'No Enrolled Study Areas')}</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                {t('studentDashboard.noAreasDesc', "You haven't starred or created any study areas yet. Browse public areas or create your own to begin!")}
              </p>
            </div>
            <Button onClick={() => navigate(`/${locale}/study-areas`)} size="sm" className="rounded-xl font-semibold bg-primary text-xs text-primary-foreground">
              {t('studentDashboard.exploreAreas', 'Explore Study Areas')}
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pagedAreas.pageItems.map((area) => (
              <Link
                key={area.id}
                to={`/${locale}/study-areas/${area.id}`}
                className="group p-5 border border-border/50 hover:border-primary/20 bg-card/65 backdrop-blur rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[11px] font-bold px-1.5 h-4.5 rounded-md border-border/80 text-muted-foreground">
                      {area.questionCount} {area.questionCount === 1 ? t('studentDashboard.question', 'Question') : t('studentDashboard.questions', 'Questions')}
                    </Badge>
                    {user && (area.createdById === String(user.id) || user.role === 'ROLE_ADMIN' || user.role === 'ROLE_DEV') && (
                      <Badge variant="secondary" className="bg-primary/5 text-primary text-[11px] font-black uppercase px-1.5 h-4.5 rounded-md">
                        {area.visibility === 'PRIVATE' ? t('studyAreaForm.private', 'Private') : t('studyAreaForm.public', 'Public')}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {area.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-normal line-clamp-2 min-h-[32px]">
                    {area.description || t('studentDashboard.noDescription', 'No description provided.')}
                  </p>
                </div>
                <div className="border-t border-border/30 pt-3 mt-4 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{t('studentDashboard.by', 'By:')} {area.createdBy}</span>
                  <span className="font-semibold text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('studentDashboard.study', 'Study')} <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Pagination currentPage={pagedAreas.currentPage} totalPages={pagedAreas.totalPages} onPageChange={setAreasPage} />
      </div>

  );

  const sessionsSection = (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> {t('studentDashboard.recentSessions', 'Recent Sessions')}
          </h2>
          {selectedDate && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-2.5 rounded-xl text-xs font-semibold animate-in slide-in-from-top-1 duration-200">
              <span>
                {t('studentDashboard.date', 'Date:')} <strong className="text-primary">{new Date(selectedDate).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              </span>
              <Button
                onClick={() => selectDate(null)}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] font-black uppercase text-primary hover:text-primary/90 hover:bg-primary/10 rounded-lg px-2 shrink-0 ml-2"
              >
                {t('studentDashboard.clearFilter', 'Clear')}
              </Button>
            </div>
          )}
        </div>

        {filteredSessions.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <p className="text-xs font-semibold">
              {selectedDate ? t('studentDashboard.noSessionsFilter', 'No sessions found for this day.') : t('studentDashboard.noSessionsTitle', 'No recent practice sessions.')}
            </p>
            {selectedDate ? (
              <Button
                onClick={() => selectDate(null)}
                variant="outline"
                size="sm"
                className="rounded-xl font-semibold border-border/60 hover:bg-muted text-xs"
              >
                {t('studentDashboard.clearFilter', 'Clear Filter')}
              </Button>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground max-w-[200px] leading-normal mx-auto">
                  {t('studentDashboard.noSessionsDesc', 'Start practicing in any study area to track your progress and scores.')}
                </p>
                <Button type="button" size="sm" onClick={startExamNow} disabled={starting} className="rounded-xl font-semibold text-xs">
                  {t('firstRun.takeExam', 'Take an exam now')}
                </Button>
              </>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {pagedSessions.pageItems.map((sess) => {
              const isCompleted = !!sess.completedAt;
              return (
                <div
                  key={sess.id}
                  className="p-4 border border-border/50 bg-card/65 backdrop-blur rounded-2xl shadow-sm flex flex-col gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-foreground line-clamp-1">{sess.studyAreaTitle}</h4>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {new Date(sess.startedAt).toLocaleDateString(i18n.language)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-black uppercase px-2 h-5 rounded-md ${
                            sess.finalScore !== null && sess.finalScore >= (sess.settings?.passingScore ?? 10.0)
                              ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5'
                              : 'border-destructive/30 text-destructive bg-destructive/5'
                          }`}
                        >
                          {t('studentDashboard.score', 'Score:')} {sess.finalScore?.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 20
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[11px] font-bold px-2 h-5 rounded-md border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5 animate-pulse">
                        {t('studentDashboard.inProgress', 'In Progress')}
                      </Badge>
                    )}

                    <Button
                      onClick={() => navigate(isCompleted ? `/${locale}/exam/${sess.id}/result` : `/${locale}/exam/${sess.id}`)}
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-lg text-xs font-semibold px-2 hover:bg-muted text-primary"
                    >
                      {isCompleted ? t('studentDashboard.results', 'Results') : t('studentDashboard.resume', 'Resume')} <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination currentPage={pagedSessions.currentPage} totalPages={pagedSessions.totalPages} onPageChange={setSessionsPage} />
      </div>
  );

  const sections = {
    intro,
    areas: areasSection,
    sessions: sessionsSection,
    progress: !isFirstRun && <ProgressPanel progress={progress} onTrainChapter={trainChapter} training={starting} />,
    calendar: !isFirstRun && (
      <SessionCalendar
        sessions={sessions}
        selectedDate={selectedDate}
        onSelectDate={selectDate}
      />
    ),
  };

  // The first exam comes before any talk of tabs.
  if (isFirstRun) return <StudentClassicDashboard sections={sections} />;

  // The open tab lives in the URL, so reloading and the back button keep it.
  const tab = toStudentTab(searchParams.get('tab'));
  const onTabChange = (next: StudentTab) => {
    setSearchParams((params) => {
      if (next === 'study') params.delete('tab');
      else params.set('tab', next);
      return params;
    }, { replace: true });
  };

  return (
    <StudentTabbedDashboard
      sections={sections}
      tab={tab}
      onTabChange={onTabChange}
      readiness={readiness && <ReadinessCard report={readiness} locale={locale} />}
    />
  );
};
