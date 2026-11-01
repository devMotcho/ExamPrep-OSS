import { stripHtml } from '@/lib/stripHtml';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examprepApi, type StudyArea, type Question } from '@/api/examprep';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { QuestionEditor } from '@/components/examprep/QuestionEditor';
import { ImportPanel } from '@/components/examprep/ImportPanel';
import { AiGenerationDialog } from '@/components/examprep/AiGenerationDialog';
import { aiGenerationApi, type AiGenerationStatus } from '@/api/aiGeneration';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ArrowLeft, Plus, Edit2, Trash2, FileJson, Layers, HelpCircle, Sparkles, BookOpen, ChevronDown, ChevronUp, GripVertical, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { FeatureGuideLink } from '@/components/blog/FeatureGuideLink';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export const StudyAreaEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [studyArea, setStudyArea] = useState<StudyArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  // Dialog visibility states
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isChaptersDialogOpen, setIsChaptersDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiGenerationStatus | null>(null);

  const refreshAiStatus = React.useCallback(() => {
    if (!id) return;
    aiGenerationApi.getStatus(id).then(setAiStatus).catch(() => setAiStatus(null));
  }, [id]);

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus]);

  // Search query and expansion state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<{ [key: string]: boolean }>({});
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  const toggleChapterCollapse = (chapterId: string) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  // A background refresh keeps the page mounted, so an open dialog keeps its state.
  const fetchDetail = async (background = false) => {
    if (!id) return;
    try {
      if (!background) setLoading(true);
      const data = await examprepApi.getStudyArea(id);
      
      // Verify authorization
      const isCreator = user && data.createdById === String(user.id);
      const isAdmin = user && user.role === 'ROLE_ADMIN';
      const isDev = user && user.role === 'ROLE_DEV';
      if (!isCreator && !isAdmin && !isDev) {
        toast({ type: 'error', message: t('manageQuestions.notAuthorized', 'You cannot edit this study area.') });
        navigate(`/${locale}/study-areas/${id}`);
        return;
      }

      setStudyArea(data);
      // Expand all chapters by default for easier visibility
      const initialExpansion: { [key: string]: boolean } = { uncategorized: true };
      data.chapters?.forEach(c => {
        initialExpansion[c.id] = true;
      });
      setExpandedChapters(initialExpansion);
    } catch {
      toast({ type: 'error', message: t('studyAreaDetail.loadFailed', 'Could not load this study area.') });
      navigate(`/${locale}/study-areas`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, type, draggableId } = result;
    if (!destination || !studyArea) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'CHAPTER') {
      const newChapters = Array.from(studyArea.chapters || []);
      const [movedChapter] = newChapters.splice(source.index, 1);
      newChapters.splice(destination.index, 0, movedChapter);
      setStudyArea({ ...studyArea, chapters: newChapters });

      try {
        await examprepApi.reorderChapters(studyArea.id, newChapters.map(c => c.id));
      } catch (err) {
        toast({ type: 'error', message: t('manageQuestions.reorderChaptersFailed', 'Could not reorder the chapters.') });
        fetchDetail();
      }
    }

    if (type === 'QUESTION') {
      const newQuestions = Array.from(studyArea.questions || []);
      const sourceQuestion = newQuestions.find(q => q.id === draggableId);
      if (!sourceQuestion) return;

      const newChapterId = destination.droppableId === 'uncategorized' ? null : destination.droppableId;
      sourceQuestion.chapterId = newChapterId;

      const destQuestions = newQuestions.filter(q => q.chapterId === newChapterId && q.id !== sourceQuestion.id);
      destQuestions.splice(destination.index, 0, sourceQuestion);

      const reorderPayload = destQuestions.map((q, i) => ({
        id: q.id!,
        chapterId: q.chapterId || null,
        orderIndex: i
      }));

      setStudyArea({ ...studyArea, questions: newQuestions });

      try {
        await examprepApi.reorderQuestions(studyArea.id, reorderPayload);
      } catch (err) {
        toast({ type: 'error', message: t('manageQuestions.reorderQuestionFailed', 'Could not move the question.') });
        fetchDetail();
      }
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    setIsDeleting(qId);
    try {
      await examprepApi.deleteQuestion(qId);
      toast({ type: 'success', message: t('manageQuestions.deleteSuccess', 'Question deleted successfully!') });
      if (editingQuestion?.id === qId) {
        setEditingQuestion(null);
      }
      fetchDetail();
    } catch {
      toast({ type: 'error', message: t('manageQuestions.deleteFailed', 'Failed to delete question.') });
    } finally {
      setIsDeleting(null);
      setQuestionToDelete(null);
    }
  };

  const handleCreateChapter = async () => {
    if (!id || !newChapterTitle.trim()) return;
    setIsCreatingChapter(true);
    try {
      await examprepApi.createChapter(id, newChapterTitle.trim());
      toast({ type: 'success', message: t('manageQuestions.chapterCreated', 'Chapter created.') });
      setNewChapterTitle('');
      fetchDetail();
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('manageQuestions.chapterCreateFailed', 'Could not create the chapter.')
      });
    } finally {
      setIsCreatingChapter(false);
    }
  };

  const handleEditChapter = async (chapterId: string) => {
    if (!editingChapterTitle.trim()) return;
    try {
      await examprepApi.editChapter(chapterId, editingChapterTitle.trim());
      toast({ type: 'success', message: t('manageQuestions.chapterUpdated', 'Chapter updated.') });
      setEditingChapterId(null);
      fetchDetail();
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('manageQuestions.chapterUpdateFailed', 'Could not update the chapter.')
      });
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      await examprepApi.deleteChapter(chapterId);
      toast({ type: 'success', message: t('manageQuestions.chapterDeleted', 'Chapter deleted.') });
      fetchDetail();
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('manageQuestions.chapterDeleteFailed', 'Could not delete the chapter.')
      });
    } finally {
      setChapterToDelete(null);
    }
  };

  const renderQuestionRow = (q: Question, idx: number, draggableIndex: number) => {
    const promptText = stripHtml(q.prompt);
    const optionCount = q.options?.length || 0;

    return (
      <Draggable key={q.id || `q-${idx}`} draggableId={q.id!} index={draggableIndex}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`p-4 border rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card ${
              snapshot.isDragging 
                ? 'shadow-xl border-primary ring-2 ring-primary/20 z-50' 
                : 'border-border/60 hover:border-primary/30 hover:bg-muted/10'
            }`}
            style={{ ...provided.draggableProps.style }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div {...provided.dragHandleProps} aria-label={t('manageQuestions.dragHandle', 'Drag to reorder')} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing max-md:p-3.5 max-md:-m-2 p-1 mt-0.5 shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Q{idx + 1}</span>
                  {q.chapterId && (() => {
                    const chapter = studyArea?.chapters?.find(c => c.id === q.chapterId);
                    return chapter ? (
                      <span 
                        title={chapter.title}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 shrink-0 max-w-[180px]"
                      >
                        <Layers className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{chapter.title}</span>
                      </span>
                    ) : null;
                  })()}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border shrink-0">
                    {t('manageQuestions.optionCount', 'Options: {{count}}', { count: optionCount })}
                  </span>
                  {q.imageUrl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                      {t('manageQuestions.hasImage', 'Has image')}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground leading-normal line-clamp-2">
                  {promptText || t('studyAreaDetail.emptyPrompt', '(Empty question)')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingQuestion(q);
                  setIsQuestionDialogOpen(true);
                }}
                className="h-8 rounded-lg text-xs gap-1"
              >
                <Edit2 className="h-3.5 w-3.5" /> {t('common.edit', 'Edit')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (q.id) setQuestionToDelete(q.id);
                }}
                disabled={isDeleting === q.id}
                aria-label={t('manageQuestions.deleteConfirmTitle', 'Delete Question')}
                className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-5xl space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-muted/60 rounded-xl" />
        <div className="h-96 bg-muted/40 rounded-2xl" />
      </div>
    );
  }

  if (!studyArea) return null;

  // Filter questions based on search query
  const filteredQuestions = (studyArea.questions || []).filter((q) => {
    const promptText = stripHtml(q.prompt).toLowerCase();
    const explanationText = q.explanation ? stripHtml(q.explanation).toLowerCase() : '';
    const query = searchQuery.toLowerCase();
    return promptText.includes(query) || explanationText.includes(query);
  });

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-5xl space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/45 backdrop-blur p-3.5 rounded-2xl border border-border/50 shadow-sm min-h-[58px]">
        {!isSearchExpanded ? (
          <>
            <div className="flex items-center gap-3 min-w-0 max-sm:w-full">
              <div className="group relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/${locale}/study-areas/${studyArea.id}`)}
                  aria-label={t('studyAreaForm.backToDetails', 'Back to details')}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl transition-all duration-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {t('studyAreaForm.backToDetails', 'Back to details')}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-black text-primary uppercase tracking-wider leading-none">
                  {t('studyAreaDetail.manageQuestions', 'Manage Questions')}
                </span>
                <h1 className="text-sm font-bold text-foreground truncate sm:max-w-sm md:max-w-md mt-0.5">
                  {studyArea.title}
                </h1>
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              {/* Search Toggle Button */}
              <div className="group relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsSearchExpanded(true)}
                  aria-label={t('manageQuestions.search', 'Search')}
                  className="h-9 w-9 border-border/60 hover:bg-muted rounded-xl transition-all duration-300 text-foreground"
                >
                  <Search className="h-4 w-4 text-primary" />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {t('manageQuestions.search', 'Search')}
                </span>
              </div>

              {/* Add Question Button */}
              <div className="group relative">
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  aria-label={t('manageQuestions.addNewQuestion', 'Add Question')}
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsQuestionDialogOpen(true);
                  }}
                  className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl transition-all duration-300"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {t('manageQuestions.addNewQuestion', 'Add Question')}
                </span>
              </div>

              {/* Chapters Button */}
              <div className="group relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsChaptersDialogOpen(true)}
                  aria-label={t('manageQuestions.chapters', 'Chapters')}
                  className="h-9 w-9 border-border/60 hover:bg-muted rounded-xl transition-all duration-300 text-foreground"
                >
                  <Layers className="h-4 w-4 text-primary" />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {t('manageQuestions.chapters', 'Chapters')}
                </span>
              </div>

              {/* AI generation from PDF: hidden while the feature is off or not configured */}
              {aiStatus?.available && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAiDialogOpen(true)}
                  className="h-9 gap-2 border-border/60 hover:bg-muted rounded-xl text-xs font-semibold text-foreground"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t('aiGen.entry', 'Generate questions from PDF')}
                </Button>
              )}

              {/* Import Button */}
              <div className="group relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsImportDialogOpen(true)}
                  aria-label={t('manageQuestions.import', 'Import')}
                  className="h-9 w-9 border-border/60 hover:bg-muted rounded-xl transition-all duration-300 text-foreground"
                >
                  <FileJson className="h-4 w-4 text-primary" />
                </Button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 rounded bg-popover border border-border px-2 py-1 text-[11px] font-bold text-popover-foreground shadow-md transition-all group-hover:scale-100 pointer-events-none whitespace-nowrap z-50">
                  {t('manageQuestions.import', 'Import')}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full zoom-in-95 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('manageQuestions.searchPlaceholder', 'Search questions...')}
                aria-label={t('manageQuestions.searchPlaceholder', 'Search questions...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="pl-8 pr-8 rounded-xl bg-background border-border/60 w-full h-9 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('manageQuestions.clearSearch', 'Clear search')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-bold"
                >
                  ×
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsSearchExpanded(false);
                setSearchQuery('');
              }}
              className="text-xs font-semibold h-9 px-3 rounded-xl hover:bg-muted shrink-0"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        )}
      </div>

      {/* Main Spacious Content */}
      <div className="space-y-6">
        <DragDropContext onDragEnd={handleDragEnd}>
            {(() => {
              const chapters = studyArea.chapters || [];

              if (filteredQuestions.length === 0 && chapters.length === 0) {
                if (searchQuery) {
                  return (
                    <div className="text-center py-16 text-muted-foreground text-sm border border-dashed rounded-xl border-border/60 bg-muted/5">
                      {t('manageQuestions.noSearchResults', 'No questions match your search.')}
                    </div>
                  );
                }
                return (
                  <div className="py-10 px-6 text-center border border-dashed rounded-2xl border-border/60 bg-muted/5 flex flex-col items-center gap-4">
                    <div className="space-y-1 max-w-lg">
                      <h2 className="text-lg font-bold text-foreground">{t('manageQuestions.firstQuestionTitle', 'Add your first questions')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('manageQuestions.firstQuestionDesc', 'The quickest way: open Import, copy the AI prompt, paste it into an assistant such as ChatGPT or Claude along with your notes, then import the result. You can also write questions one by one.')}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button onClick={() => setIsImportDialogOpen(true)} className="rounded-xl font-semibold gap-2">
                        <FileJson className="h-4 w-4" /> {t('manageQuestions.importWithAi', 'Import questions')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingQuestion(null);
                          setIsQuestionDialogOpen(true);
                        }}
                        className="rounded-xl font-semibold gap-2"
                      >
                        <Plus className="h-4 w-4" /> {t('manageQuestions.writeOne', 'Write a question')}
                      </Button>
                    </div>
                    <div className="w-full max-w-2xl pt-2">
                      <FeatureGuideLink feature="questions" className="mt-3" />
                    </div>
                    <Button
                      variant="link"
                      onClick={() => navigate(`/${locale}/study-areas?tab=explore`)}
                      className="text-sm"
                    >
                      {t('manageQuestions.orLibrary', 'Or practise now with the public library')}
                    </Button>
                  </div>
                );
              }

              // Group questions by chapter
              if (chapters.length > 0) {
                const chapterMap: { [key: string]: Question[] } = {};
                const uncategorized: Question[] = [];

                filteredQuestions.forEach((q) => {
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
                  <div className="flex flex-col gap-6">
                    <Droppable droppableId="chapters" type="CHAPTER">
                      {(chaptersProvided) => (
                        <div 
                          className="flex flex-col gap-6" 
                          ref={chaptersProvided.innerRef} 
                          {...chaptersProvided.droppableProps}
                        >
                          {chapters.map((chapter, chapterIndex) => {
                            const chapterQuestions = chapterMap[chapter.id] || [];
                            const isExpanded = expandedChapters[chapter.id];

                            return (
                              <Draggable key={chapter.id} draggableId={chapter.id} index={chapterIndex}>
                                {(chapterProvided, chapterSnapshot) => (
                                  <div 
                                    ref={chapterProvided.innerRef} 
                                    {...chapterProvided.draggableProps}
                                    className={`border border-border/40 rounded-xl overflow-hidden shadow-sm transition-all ${
                                      chapterSnapshot.isDragging 
                                        ? 'shadow-xl ring-2 ring-primary/20 z-50 bg-card' 
                                        : 'bg-muted/5 hover:border-border/80'
                                    }`}
                                    style={{ ...chapterProvided.draggableProps.style }}
                                  >
                                    <div
                                      className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/30 select-none"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                        <div {...chapterProvided.dragHandleProps} aria-label={t('manageQuestions.dragHandle', 'Drag to reorder')} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing max-md:p-3.5 max-md:-m-2 p-1 -ml-1">
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <Layers className="w-4 h-4 text-primary shrink-0" />
                                        <button type="button" className="text-sm font-bold text-foreground truncate cursor-pointer text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={!!isExpanded} onClick={() => toggleChapterCollapse(chapter.id)}>
                                          {chapter.title}
                                        </button>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-card border border-border/60 text-muted-foreground">
                                          {chapterQuestions.length} {chapterQuestions.length === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleChapterCollapse(chapter.id)}
                                          aria-label={isExpanded ? t('manageQuestions.collapse', 'Collapse') : t('manageQuestions.expand', 'Expand')}
                                          aria-expanded={!!isExpanded}
                                          className="h-8 w-8 p-0 rounded-lg"
                                        >
                                          {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>

                                    {isExpanded && (
                                      <Droppable droppableId={chapter.id} type="QUESTION">
                                        {(questionsProvided, questionsSnapshot) => (
                                          <div 
                                            ref={questionsProvided.innerRef} 
                                            {...questionsProvided.droppableProps}
                                            className={`p-3 flex flex-col gap-3 min-h-[60px] transition-colors ${
                                              questionsSnapshot.isDraggingOver ? 'bg-primary/5' : ''
                                            }`}
                                          >
                                            {chapterQuestions.length === 0 && !questionsSnapshot.isDraggingOver ? (
                                              <div className="text-center py-6 text-muted-foreground text-xs italic pointer-events-none">
                                                {t('manageQuestions.noQuestionsInChapter', 'No questions in this chapter. Drop here.')}
                                              </div>
                                            ) : (
                                              chapterQuestions.map((q, qIndex) => {
                                                const absoluteIdx = (studyArea.questions || []).findIndex((item) => item.id === q.id);
                                                return renderQuestionRow(q, absoluteIdx, qIndex);
                                              })
                                            )}
                                            {questionsProvided.placeholder}
                                          </div>
                                        )}
                                      </Droppable>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {chaptersProvided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    {uncategorized.length > 0 && (
                      <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5 shadow-sm">
                        <div
                          className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/30 select-none"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                            <button type="button" className="text-sm font-bold text-muted-foreground truncate cursor-pointer text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={!!expandedChapters['uncategorized']} onClick={() => toggleChapterCollapse('uncategorized')}>
                              {t('manageQuestions.general', 'General / Uncategorized')}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-card border border-border/60 text-muted-foreground">
                              {uncategorized.length} {uncategorized.length === 1 ? t('studyAreaDetail.question_one', 'Question') : t('studyAreaDetail.question_other', 'Questions')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleChapterCollapse('uncategorized')}
                              aria-label={expandedChapters['uncategorized'] ? t('manageQuestions.collapse', 'Collapse') : t('manageQuestions.expand', 'Expand')}
                              aria-expanded={!!expandedChapters['uncategorized']}
                              className="h-8 w-8 p-0 rounded-lg"
                            >
                              {expandedChapters['uncategorized'] ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {expandedChapters['uncategorized'] && (
                          <Droppable droppableId="uncategorized" type="QUESTION">
                            {(questionsProvided, questionsSnapshot) => (
                              <div 
                                ref={questionsProvided.innerRef} 
                                {...questionsProvided.droppableProps}
                                className={`p-3 flex flex-col gap-3 min-h-[60px] transition-colors ${
                                  questionsSnapshot.isDraggingOver ? 'bg-primary/5' : ''
                                }`}
                              >
                                {uncategorized.map((q, qIndex) => {
                                  const absoluteIdx = (studyArea.questions || []).findIndex((item) => item.id === q.id);
                                  return renderQuestionRow(q, absoluteIdx, qIndex);
                                })}
                                {questionsProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Flat list when the area has no chapters
              return (
                <Droppable droppableId="uncategorized" type="QUESTION">
                  {(questionsProvided) => (
                    <div 
                      className="flex flex-col gap-3"
                      ref={questionsProvided.innerRef} 
                      {...questionsProvided.droppableProps}
                    >
                      {filteredQuestions.map((q, qIndex) => renderQuestionRow(q, qIndex, qIndex))}
                      {questionsProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })()}
          </DragDropContext>
      </div>

      {/* QUESTION EDITOR DIALOG */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsQuestionDialogOpen(false);
          setEditingQuestion(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {editingQuestion ? t('manageQuestions.editQuestion', 'Edit question') : t('manageQuestions.addNewQuestion', 'Add Question')}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion 
                ? t('manageQuestions.editQuestionDesc', 'Change the details of this question.')
                : t('manageQuestions.addQuestionDesc', 'Write the question, its options and mark the correct one.')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {id && (
              <QuestionEditor
                studyAreaId={id}
                editingQuestion={editingQuestion}
                chapters={studyArea.chapters}
                folder={studyArea.title}
                onSaveSuccess={() => {
                  setIsQuestionDialogOpen(false);
                  setEditingQuestion(null);
                  fetchDetail();
                }}
                onCancel={() => {
                  setIsQuestionDialogOpen(false);
                  setEditingQuestion(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CHAPTERS DIALOG */}
      <Dialog open={isChaptersDialogOpen} onOpenChange={(open) => !open && setIsChaptersDialogOpen(false)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {t('manageQuestions.chapters', 'Chapters')}
            </DialogTitle>
            <DialogDescription>
              {t('manageQuestions.chaptersDesc', 'Create chapters and organise your questions by topic.')}
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">{t('manageQuestions.chapterNameLabel', 'Create New Chapter')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder={t('manageQuestions.chapterName', 'Chapter name (e.g. Variables)')}
                    className="rounded-xl bg-background text-sm flex-1 h-10"
                  />
                  <Button
                    onClick={handleCreateChapter}
                    disabled={isCreatingChapter || !newChapterTitle.trim()}
                    className="bg-primary text-primary-foreground font-semibold rounded-xl text-xs px-4 h-10"
                  >
                    {t('manageQuestions.addChapter', 'Add')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-border/40">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('manageQuestions.existingChapters', 'Existing Chapters')}</Label>
                
                {studyArea.chapters && studyArea.chapters.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {studyArea.chapters.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border/30 rounded-xl gap-2">
                        {editingChapterId === c.id ? (
                          <div className="flex gap-2 w-full">
                            <Input
                              value={editingChapterTitle}
                              onChange={(e) => setEditingChapterTitle(e.target.value)}
                              className="rounded-lg bg-background text-xs h-8 flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleEditChapter(c.id)}
                              disabled={!editingChapterTitle.trim()}
                              className="h-8 rounded-lg text-xs"
                            >
                              {t('common.save', 'Save')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingChapterId(null)}
                              className="h-8 rounded-lg text-xs"
                            >
                              {t('common.cancel', 'Cancel')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-foreground truncate">{c.title}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingChapterId(c.id);
                                  setEditingChapterTitle(c.title);
                                }}
                                aria-label={t('manageQuestions.editChapterAria', 'Edit chapter {{title}}', { title: c.title })}
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setChapterToDelete(c.id)}
                                aria-label={t('manageQuestions.deleteChapterAria', 'Delete chapter {{title}}', { title: c.title })}
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4">{t('manageQuestions.noChapters', 'No chapters created yet.')}</p>
                )}
              </div>
            </div>
        </DialogContent>
      </Dialog>

      {id && (
        <AiGenerationDialog
          open={isAiDialogOpen}
          onOpenChange={setIsAiDialogOpen}
          studyAreaId={id}
          status={aiStatus}
          onStatusChange={refreshAiStatus}
          onSaved={() => {
            refreshAiStatus();
            fetchDetail(true);
          }}
        />
      )}

      {/* IMPORT DIALOG */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => !open && setIsImportDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              {t('manageQuestions.import', 'Import')}
            </DialogTitle>
            <DialogDescription>
              {t('manageQuestions.importDesc', 'Add many questions at once. Use the AI prompt below to create them from your notes.')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {id && (
              <ImportPanel
                studyAreaId={id}
                onImportSuccess={() => {
                  setIsImportDialogOpen(false);
                  fetchDetail();
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!questionToDelete}
        onOpenChange={(open) => !open && setQuestionToDelete(null)}
        onConfirm={() => { if (questionToDelete) handleDeleteQuestion(questionToDelete); }}
        title={t('manageQuestions.deleteConfirmTitle', 'Delete Question')}
        description={t('manageQuestions.deleteConfirm', 'Are you sure you want to delete this question? This action cannot be undone.')}
      />
      
      <ConfirmDeleteDialog
        isOpen={!!chapterToDelete}
        onOpenChange={(open) => !open && setChapterToDelete(null)}
        onConfirm={() => { if (chapterToDelete) handleDeleteChapter(chapterToDelete); }}
        title={t('manageQuestions.deleteChapterConfirmTitle', 'Delete Chapter')}
        description={t('manageQuestions.deleteChapterConfirm', 'Are you sure you want to delete this chapter? Questions in it will be uncategorized.')}
      />
    </div>
  );
};

