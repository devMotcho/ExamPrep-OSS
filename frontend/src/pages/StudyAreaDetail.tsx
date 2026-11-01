import { stripHtml } from '@/lib/stripHtml';
import { formatDecimal } from '@/lib/format';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { examprepApi, type StudyArea, type Question } from '@/api/examprep';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExamSettingsModal } from '@/components/examprep/ExamSettingsModal';
import { VisibilityRadioGroup } from '@/components/examprep/VisibilityRadioGroup';
import { ArrowLeft, Bookmark, Gauge, BookOpen, Settings, Play, User, Calendar, Lock, Globe, Sparkles, ChevronDown, ChevronUp, Layers, HelpCircle, Share2, Star, Edit2, History, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useQuestionMarks } from '@/hooks/useQuestionMarks';
import { QuestionMarkBar } from '@/components/marks/QuestionMarkControls';


export const StudyAreaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [studyArea, setStudyArea] = useState<StudyArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarring, setIsStarring] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [collapsedChapters, setCollapsedChapters] = useState<{ [key: string]: boolean }>({});
  const [sessions, setSessions] = useState<any[]>([]);

  const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleChapterCollapse = (chapterId: string) => {
    setCollapsedChapters((prev) => {
      const isCurrentlyCollapsed = prev[chapterId] !== false;
      return {
        ...prev,
        [chapterId]: !isCurrentlyCollapsed,
      };
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ type: 'success', message: t('studyAreaDetail.linkCopied', 'Link copied.') });
    } catch {
      toast({ type: 'error', message: t('studyAreaDetail.linkCopyFailed', 'Could not copy the link.') });
    }
  };

  const fetchSessions = async () => {
    if (!isAuthenticated || !id) return;
    try {
      const data = await examprepApi.listMySessions();
      const filtered = data.filter((s) => s.studyAreaId === id);
      setSessions(filtered);
    } catch (err) {
      console.error('Failed to load practice history:', err);
    }
  };

  const isAdmin = user?.role === 'ROLE_ADMIN';
  const isDev = user?.role === 'ROLE_DEV';
  const marks = useQuestionMarks(isAuthenticated ? id : undefined);

  const renderQuestionItem = (q: Question, index: number) => {
    const isExpanded = expandedQuestionId === q.id;
    const promptText = stripHtml(q.prompt);

    return (
      <div
        key={q.id || index}
        className={`border rounded-xl transition-all duration-200 overflow-hidden ${
          isExpanded
            ? 'border-primary/50 bg-primary/[0.02] shadow-sm'
            : 'border-border/60 hover:border-primary/20 bg-card hover:bg-muted/5'
        }`}
      >
        {/* Clickable Header */}
        <button
          type="button"
          onClick={() => setExpandedQuestionId(isExpanded ? null : (q.id || null))}
          aria-expanded={isExpanded}
          className="w-full text-left p-4 flex items-start justify-between gap-4 cursor-pointer select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-xs font-bold text-muted-foreground uppercase mt-0.5">Q{index + 1}</span>
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold text-foreground/85 leading-normal line-clamp-2">
                {promptText || t('studyAreaDetail.emptyPrompt', '(Empty question)')}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-muted-foreground mt-0.5">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-4">
            {/* Detailed Prompt */}
            <div
              className="text-sm text-foreground/90 leading-relaxed rich-text-content prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.prompt) }}
            />

            {/* Image if available */}
            {q.imageUrl && (
              <div className="max-w-md border border-border/40 rounded-xl overflow-hidden shadow-sm bg-muted/10">
                <img src={q.imageUrl} alt={t('examFlow.imageAlt', 'Question image')} className="w-full h-auto object-contain" />
              </div>
            )}

            {/* Options list */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('manageQuestions.optionsLabel', 'Options')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => {
                  const isCorrect = isAuthenticated && q.correctOptionId === opt.id;
                  return (
                    <div
                      key={opt.id || oIdx}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-2 text-xs font-medium ${
                        isCorrect
                          ? 'bg-success/5 border-success/30 text-success dark:!text-white'
                          : 'bg-muted/10 border-border/40 text-foreground/80'
                      }`}
                    >
                      <span>{opt.text}</span>
                      {isCorrect && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-bold bg-success/10 text-success dark:!text-white border-success/20 uppercase shrink-0">
                          {t('studyAreaDetail.correct', 'Correct')}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isAuthenticated && q.id && (
              <QuestionMarkBar questionId={q.id} marks={marks} />
            )}

            {/* Explanation (only if available and authenticated) */}
            {isAuthenticated && q.explanation && (
              <div className="p-3 bg-muted/30 border border-border/40 rounded-xl space-y-1">
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" /> {t('examFlow.explanation', 'Explanation')}
                </p>
                <div
                  className="text-xs text-muted-foreground leading-relaxed rich-text-content prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation) }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  const fetchDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await examprepApi.getStudyArea(id);
      setStudyArea(data);
      setEditTitle(data.title);
      setEditDescription(data.description || '');
      setEditVisibility(data.visibility);
      await fetchSessions();
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('studyAreaDetail.loadFailed', 'Could not load this study area.')
      });
      if (err.response?.status !== 401 && err.response?.status !== 403) {
         navigate(`/${locale}/dashboard`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleStarToggle = async () => {
    if (!id || !studyArea) return;
    setIsStarring(true);
    try {
      if (studyArea.starred) {
        await examprepApi.unstarStudyArea(id);
        toast({ type: 'success', message: t('studyAreas.unstarredToast', 'Removed from starred.') });
      } else {
        await examprepApi.starStudyArea(id);
        toast({ type: 'success', message: t('studyAreas.starredToast', 'Added to starred.') });
      }
      fetchDetail();
      window.dispatchEvent(new Event('study-areas-updated'));
    } catch {
      toast({ type: 'error', message: t('studyAreas.starFailed', 'Could not update starred.') });
    } finally {
      setIsStarring(false);
    }
  };

  const handleEditInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast({ type: 'error', message: t('studyAreaForm.titleRequired', 'Title is required.') });
      return;
    }
    setIsSavingInfo(true);
    try {
      await examprepApi.updateStudyArea(id!, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        visibility: editVisibility,
      });
      toast({ type: 'success', message: t('studyAreaForm.updatedToast', 'Study area updated.') });
      setIsEditInfoOpen(false);
      fetchDetail();
      window.dispatchEvent(new Event('study-areas-updated'));
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('studyAreaForm.updateFailed', 'Could not update the study area.')
      });
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await examprepApi.deleteStudyArea(id);
      toast({ type: 'success', message: t('studyAreaDetail.deletedToast', 'Study area deleted.') });
      window.dispatchEvent(new Event('study-areas-updated'));
      navigate(`/${locale}/study-areas`);
    } catch (err: any) {
      toast({ type: 'error', message: err.response?.data?.message || t('studyAreaDetail.deleteFailed', 'Could not delete the study area.') });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-4xl space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-muted/60 rounded-xl" />
        <div className="h-40 bg-muted/50 rounded-2xl border border-border/40" />
        <div className="h-64 bg-muted/40 rounded-2xl" />
      </div>
    );
  }

  if (!studyArea) return null;

  const isCreator = user && studyArea.createdById === String(user.id);
  const showEditButton = isCreator || isAdmin || isDev;
  const canTakeExam = studyArea.visibility === 'PUBLIC' || studyArea.starred || isCreator || isAdmin || isDev;

  const renderQuestionsContent = () => {
    return (
      <>
        {studyArea.questionCount === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <p className="text-base font-bold text-foreground">{t('studyAreaDetail.noQuestions', 'This study area has no questions yet.')}</p>
            <p className="text-sm max-w-md">
              {showEditButton
                ? t('studyAreaDetail.startDisabledOwner', 'You can start an exam as soon as it has at least one question. Write them yourself, or import a list made with an AI assistant from your notes.')
                : t('studyAreaDetail.startDisabledVisitor', 'You can start an exam once its author adds questions. In the meantime, the public library has other study areas ready to practise.')}
            </p>
            {showEditButton ? (
              <Button
                onClick={() => navigate(`/${locale}/study-areas/${studyArea.id}/edit`)}
                className="rounded-xl font-semibold bg-primary"
              >
                {t('studyAreaDetail.addOrImportCta', 'Add or import questions')}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate(`/${locale}/study-areas?tab=explore`)}
                className="rounded-xl font-semibold"
              >
                {t('studyAreas.browseLibrary', 'Browse the public library')}
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="bg-card/65 backdrop-blur border border-border/50 rounded-2xl overflow-hidden p-5 shadow-sm space-y-4">
              <div className="text-xs text-muted-foreground leading-normal px-2">
                {t('studyAreaDetail.previewPrompts', 'Preview the prompts included in this study area. Launch the exam to solve them and view explanations.')}
              </div>

              <div className="space-y-3">
                {(() => {
                  const questions = studyArea.questions || [];
                  const chapters = studyArea.chapters || [];

                  if (questions.length === 0) {
                    return <p className="text-xs text-muted-foreground italic text-center py-6">{t('studyAreaDetail.noQuestionsFound', 'No questions found in this study area.')}</p>;
                  }

                  // Group by chapter when the area has them
                  if (chapters.length > 0) {
                    // Group questions
                    const chapterMap: { [key: string]: Question[] } = {};
                    const uncategorized: Question[] = [];

                    questions.forEach((q) => {
                      if (q.chapterId) {
                        const exists = chapters.some((c) => c.id === q.chapterId);
                        if (exists) {
                          if (!chapterMap[q.chapterId]) {
                            chapterMap[q.chapterId] = [];
                          }
                          chapterMap[q.chapterId].push(q);
                          return;
                        }
                      }
                      uncategorized.push(q);
                    });

                    return (
                      <div className="space-y-6">
                        {chapters.map((chapter) => {
                          const chapterQuestions = chapterMap[chapter.id] || [];
                          const isCollapsed = collapsedChapters[chapter.id] !== false;
                          return (
                            <div key={chapter.id} className="space-y-3 p-4 bg-muted/10 border border-border/30 rounded-2xl">
                              <button
                                type="button"
                                onClick={() => toggleChapterCollapse(chapter.id)}
                                aria-expanded={!isCollapsed}
                                className="w-full text-left flex items-center justify-between gap-2 border-b border-border/20 pb-2 cursor-pointer select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-primary" />
                                  <h4 className="text-sm font-black text-foreground">{chapter.title}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5">
                                    {chapterQuestions.length} {chapterQuestions.length === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                                  </Badge>
                                  {isCollapsed ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              </button>
                              
                              {!isCollapsed && (
                                <>
                                  {chapterQuestions.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic px-2 py-2">{t('studyAreaDetail.noQuestionsInChapter', 'No questions in this chapter yet.')}</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {chapterQuestions.map((q, idx) => renderQuestionItem(q, idx))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}

                        {uncategorized.length > 0 && (
                          <div className="space-y-3 p-4 bg-muted/10 border border-border/30 rounded-2xl">
                            <button
                              type="button"
                              onClick={() => toggleChapterCollapse('uncategorized')}
                              aria-expanded={collapsedChapters['uncategorized'] === false}
                              className="w-full text-left flex items-center justify-between gap-2 border-b border-border/20 pb-2 cursor-pointer select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                                <h4 className="text-sm font-black text-muted-foreground">{t('studyAreaDetail.generalQuestions', 'General / Uncategorized Questions')}</h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[11px] font-bold px-2 py-0.5 text-muted-foreground border-border">
                                  {uncategorized.length} {uncategorized.length === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                                </Badge>
                                {collapsedChapters['uncategorized'] !== false ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </button>
                            {collapsedChapters['uncategorized'] === false && (
                              <div className="space-y-2">
                                {uncategorized.map((q, idx) => renderQuestionItem(q, idx))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // No chapters configured: show a flat list
                  return (
                    <div className="space-y-2">
                      {questions.map((q, idx) => renderQuestionItem(q, idx))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-4xl space-y-8">
      {/* Navigation Header */}
      <div className="flex items-center justify-between gap-4 bg-card/45 backdrop-blur p-3.5 rounded-2xl border border-border/50 shadow-sm">
        <div className="group relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${locale}/study-areas`)}
            aria-label={t('studyAreaDetail.allAreas', 'All study areas')}
            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
            {t('studyAreaDetail.allAreas', 'All study areas')}
          </span>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <>
              {/* Star Button */}
              <div className="group relative">
                <Button
                  onClick={handleStarToggle}
                  disabled={isStarring}
                  aria-pressed={!!studyArea.starred}
                  aria-label={studyArea.starred ? t('studyAreaDetail.unstar', 'Unstar') : t('studyAreaDetail.star', 'Star')}
                  variant={studyArea.starred ? 'outline' : 'default'}
                  size="icon"
                  className={`h-9 w-9 rounded-xl transition-all duration-300 ${
                    studyArea.starred
                      ? 'border-yellow-500/35 hover:bg-yellow-500/5 text-foreground'
                      : 'bg-primary text-primary-foreground hover:bg-primary/95'
                  }`}
                >
                  <Star className={`h-4 w-4 ${studyArea.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {studyArea.starred ? t('studyAreaDetail.unstar', 'Unstar') : t('studyAreaDetail.star', 'Star')}
                </span>
              </div>

              {/* Take Practice Exam or Resume */}
              {canTakeExam && (() => {
                const activeSession = sessions.find((s) => !s.completedAt);
                return (
                  <div className="group relative">
                    <Button
                      onClick={() => {
                        if (activeSession) {
                          navigate(`/${locale}/exam/${activeSession.id}`);
                        } else {
                          setIsSettingsOpen(true);
                        }
                      }}
                      disabled={studyArea.questionCount === 0}
                      aria-label={studyArea.questionCount === 0
                        ? t('studyAreaDetail.startDisabledShort', 'Add questions to start an exam')
                        : activeSession ? t('studyAreaDetail.resumeExam', 'Resume Exam') : t('studyAreaDetail.startExam', 'Start Exam')}
                      size="icon"
                      className={`${activeSession ? 'bg-warning text-warning-foreground hover:bg-warning/95' : 'bg-primary text-primary-foreground hover:bg-primary/95'} h-9 w-9 rounded-xl transition-all duration-300`}
                    >
                      {activeSession ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                    </Button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                      {studyArea.questionCount === 0
                        ? t('studyAreaDetail.startDisabledShort', 'Add questions to start an exam')
                        : activeSession ? t('studyAreaDetail.resumeExam', 'Resume Exam') : t('studyAreaDetail.startExam', 'Start Exam')}
                    </span>
                  </div>
                );
              })()}

              {/* Edit Details (Only for Creator/Admin/Dev) */}
              {showEditButton && (
                <div className="group relative">
                  <Button
                    onClick={() => setIsEditInfoOpen(true)}
                    aria-label={t('studyAreaDetail.editInfo', 'Edit Study Area')}
                    variant="outline"
                    size="icon"
                    className="border-border/60 hover:bg-muted h-9 w-9 rounded-xl transition-all duration-300"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                    {t('studyAreaDetail.editInfo', 'Edit Study Area')}
                  </span>
                </div>
              )}

              {/* Manage Questions & Chapters (Only for Creator/Admin/Dev) */}
              {showEditButton && (
                <div className="group relative">
                  <Button
                    onClick={() => navigate(`/${locale}/study-areas/${studyArea.id}/edit`)}
                    aria-label={t('studyAreaDetail.manageQuestions', 'Manage Questions')}
                    variant="outline"
                    size="icon"
                    className="border-border/60 hover:bg-muted h-9 w-9 rounded-xl transition-all duration-300"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                    {t('studyAreaDetail.manageQuestions', 'Manage Questions')}
                  </span>
                </div>
              )}

              {/* Delete Study Area (Only for Creator) */}
              {isCreator && (
                <div className="group relative">
                  <Button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    aria-label={t('studyAreaDetail.delete', 'Delete')}
                    variant="outline"
                    size="icon"
                    className="border-destructive/30 hover:bg-destructive/10 text-destructive h-9 w-9 rounded-xl transition-all duration-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                    {t('studyAreaDetail.delete', 'Delete')}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Share button (always visible) */}
          <div className="group relative">
            <Button
              variant="outline"
              onClick={handleShare}
              aria-label={t('studyAreaDetail.share', 'Share')}
              size="icon"
              className="border-border/60 hover:bg-muted h-9 w-9 rounded-xl transition-all duration-300"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
              {t('studyAreaDetail.share', 'Share')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Area Banner */}
      <Card className="rounded-2xl border border-border/50 bg-card/65 backdrop-blur shadow-md overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/80 via-primary/30 to-primary/80" />
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {(isCreator || isAdmin || isDev) && (
                  <Badge
                    variant="secondary"
                    className={`h-5 px-2 text-[11px] font-black uppercase rounded-md flex items-center gap-1 ${
                      studyArea.visibility === 'PRIVATE'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-primary/5 text-primary'
                    }`}
                  >
                    {studyArea.visibility === 'PRIVATE' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {studyArea.visibility === 'PRIVATE' ? t('studyAreaDetail.private', 'PRIVATE') : t('studyAreaDetail.public', 'PUBLIC')}
                  </Badge>
                )}
                <Badge variant="outline" className="h-5 px-2 text-[11px] font-bold border-border rounded-md text-muted-foreground">
                  {studyArea.questionCount} {studyArea.questionCount === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                </Badge>
                <Badge variant="outline" className="h-5 px-2 text-[11px] font-bold border-border rounded-md text-muted-foreground flex items-center gap-1">
                  <Star className={`h-3 w-3 ${studyArea.starred ? 'fill-yellow-500 text-yellow-500' : 'text-primary'}`} />
                  {studyArea.starCount || 0} {(studyArea.starCount || 0) === 1 ? t('studyAreaDetail.star_one', 'Star') : t('studyAreaDetail.star_other', 'Stars')}
                </Badge>
              </div>

              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
                {studyArea.title}
              </h2>

              <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                {studyArea.description || t('studyAreaDetail.noDescription', 'No description provided for this study area.')}
              </p>
            </div>

            {!isAuthenticated && (
              <div className="space-y-4 w-full md:w-64 shrink-0">
                <Button
                  onClick={() => navigate(`/${locale}/login`)}
                  className="bg-primary text-primary-foreground font-bold rounded-xl gap-2 w-full h-10 shadow-sm"
                >
                  {t('studyAreaDetail.loginToPractice', 'Log in to practise')}
                </Button>
                <Card className="border border-primary/20 bg-primary/5 rounded-2xl p-4 text-left space-y-3 shadow-inner">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                      {t('studyAreaDetail.visitorTitle', 'Practise and see your progress')}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      {t('studyAreaDetail.visitorDesc', 'Create an account to take exams and keep your results.')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/${locale}/register`)}
                      className="rounded-lg text-[11px] font-bold bg-primary text-primary-foreground flex-1 h-7"
                    >
                      {t('auth.login.registerLink', 'Register')}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6 border-t border-border/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{t('studyAreaDetail.createdBy', 'Created by:')} <span className="font-semibold text-foreground/80">{studyArea.createdBy ?? t('studyAreas.anonymousAuthor', 'Anonymous')}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{t('studyAreaDetail.createdOn', 'Created on:')} <span className="font-semibold text-foreground/80">{new Date(studyArea.createdAt).toLocaleDateString(locale)}</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Section: Tabs if auth'd, Questions only if not auth'd */}
      {isAuthenticated ? (
        <Tabs defaultValue="questions" className="space-y-6">
          <TabsList className="grid grid-cols-2 rounded-xl h-10 p-1 bg-muted shrink-0 w-full max-w-[380px] mx-auto self-center">
            <TabsTrigger
              value="questions"
              className="rounded-lg text-xs font-bold gap-1.5 data-active:!bg-primary data-active:!text-primary-foreground dark:data-active:!bg-primary dark:data-active:!text-primary-foreground data-active:hover:!bg-primary data-active:hover:!text-primary-foreground dark:data-active:hover:!bg-primary dark:data-active:hover:!text-primary-foreground transition-all duration-300"
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              {t('studyAreaDetail.tabQuestions', 'Questions')}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg text-xs font-bold gap-1.5 data-active:!bg-primary data-active:!text-primary-foreground dark:data-active:!bg-primary dark:data-active:!text-primary-foreground data-active:hover:!bg-primary data-active:hover:!text-primary-foreground dark:data-active:hover:!bg-primary dark:data-active:hover:!text-primary-foreground transition-all duration-300"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              {t('studyAreaDetail.tabHistory', 'Practice History')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4 outline-none">
            <div className="flex flex-wrap gap-2">
              <Button render={<Link to={`/${locale}/study-areas/${id}/readiness`} />} variant="outline" className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold flex-1 sm:flex-none">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                {t('readiness.open', 'Readiness report')}
              </Button>
              <Button render={<Link to={`/${locale}/marked?area=${id}`} />} variant="outline" className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold flex-1 sm:flex-none">
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                {t('marks.title', 'Marks and notes')}
              </Button>
            </div>
            {renderQuestionsContent()}
          </TabsContent>

          <TabsContent value="history" className="outline-none">
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <Card className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <p className="text-xs font-semibold">{t('studyAreaDetail.noHistoryTitle', "You haven't taken any practice exams for this study area yet.")}</p>
                  <p className="text-[11px] text-muted-foreground">{t('studyAreaDetail.noHistoryDesc', "Launch a practice exam to start tracking your evaluations!")}</p>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sessions.map((session) => {
                    const isCompleted = !!session.completedAt;
                    const dateStr = new Date(session.startedAt).toLocaleDateString(locale);
                    const score = session.finalScore !== null && session.finalScore !== undefined
                      ? formatDecimal(session.finalScore, locale)
                      : null;

                    return (
                      <Link
                        key={session.id}
                        to={isCompleted ? `/${locale}/exam/${session.id}/result` : `/${locale}/exam/${session.id}`}
                        className="rounded-xl border border-border/50 bg-card/45 hover:bg-muted/5 transition-all p-4 flex flex-col justify-between gap-3 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground">
                              {isCompleted ? t('studyAreaDetail.completedExam', 'Completed Exam') : t('studyAreaDetail.inProgress', 'In Progress')}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t('studyAreaDetail.started', 'Started:')} {dateStr}
                            </p>
                          </div>
                          {isCompleted ? (
                            <Badge
                              variant="secondary"
                              className={`text-xs font-black px-2 py-0.5 rounded-md ${
                                parseFloat(session.finalScore) >= (session.settings?.passingScore ?? 10.0)
                                  ? 'bg-success/10 text-success border border-success/20'
                                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                              }`}
                            >
                              {score} / 20
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] font-bold text-amber-500 border-amber-500/20 bg-amber-500/5 rounded-md animate-pulse">
                              {t('studyAreaDetail.resume', 'Resume')}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-black tracking-tight">{t('studyAreaDetail.questionsPreview', 'Questions Preview')}</h3>
          </div>
          {renderQuestionsContent()}
        </div>
      )}

      {/* Edit Study Area Info Dialog */}
      {studyArea && (
        <Dialog open={isEditInfoOpen} onOpenChange={setIsEditInfoOpen}>
          <DialogContent className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-md max-w-md p-6 shadow-xl zoom-in-95 duration-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">{t('studyAreaDetail.editInfo', 'Edit Study Area')}</DialogTitle>
              <DialogDescription className="text-xs mt-1 text-muted-foreground">
                {t('studyAreaForm.editDesc', 'Update the title, description, and visibility settings for this study area.')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditInfoSubmit} className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title" className="text-xs font-bold text-foreground">
                  {t('studyAreaForm.areaTitle', 'Study Area Title')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="rounded-xl bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-description" className="text-xs font-bold text-foreground">{t('studyAreaForm.desc', 'Description')}</Label>
                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px]"
                />
              </div>

              {(isCreator || isAdmin || isDev) && (
                <VisibilityRadioGroup name="edit-area-visibility" value={editVisibility} onChange={setEditVisibility} />
              )}

              <DialogFooter className="pt-4 border-t border-border/40 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditInfoOpen(false)}
                  className="rounded-xl font-semibold text-xs"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingInfo}
                  className="bg-primary text-primary-foreground font-semibold rounded-xl text-xs px-4"
                >
                  {isSavingInfo ? t('common.loading', 'Loading...') : t('studyAreaForm.saveChanges', 'Save Changes')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-destructive">{t('studyAreaDetail.deleteTitle', 'Delete study area')}</DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {t('studyAreaDetail.deleteDesc', 'This cannot be undone. Its questions and practice history will be lost.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="rounded-xl font-bold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl font-bold"
            >
              {isDeleting ? t('studyAreaDetail.deleting', 'Deleting...') : t('studyAreaDetail.deleteTitle', 'Delete study area')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam Settings Modal */}
      {studyArea.id && (
        <ExamSettingsModal
          studyAreaId={studyArea.id}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onStart={(sessionId) => {
            setIsSettingsOpen(false);
            navigate(`/${locale}/exam/${sessionId}`);
          }}
          questions={studyArea.questions}
        />
      )}
    </div>
  );
};
