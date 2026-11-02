import i18n from '@/i18n';
import { axiosInstance } from './axiosInstance';
import type { SessionSettings } from '@/types/examprep';

export interface Option {
  id?: string;
  text: string;
  correct?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  studyAreaId: string;
  createdAt: string;
}

export interface Question {
  id?: string;
  prompt: string;
  imageUrl?: string;
  explanation?: string;
  correctOptionId?: string;
  chapterId?: string | null;
  options: Option[];
}

export interface StudyArea {
  id: string;
  title: string;
  description: string;
  /** Null when the creator has no display name. */
  createdBy: string | null;
  /** Only sent to the creator and to staff. */
  createdById: string | null;
  createdAt: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  questionCount: number;
  starred: boolean;
  starCount: number;
  questions?: Question[];
  chapters?: Chapter[];
}

/** One page of a server list; `page` starts at 0. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SessionAnswer {
  id: string;
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: string;
  correct?: boolean;
  correctOptionId?: string;
  explanation?: string;
}

export type SessionKind = 'EXAM' | 'SIMULATION' | 'PLAN' | 'PRACTICE_WRONG' | 'MARKED';

export interface ExamSession {
  id: string;
  studyAreaId: string;
  studyAreaTitle: string;
  startedAt: string;
  completedAt: string | null;
  settings: SessionSettings;
  answers: SessionAnswer[];
  finalScore: number | null;
  questions: Question[];
  currentIndex: number;
  practiceOfSessionId?: string | null;
  sessionKind?: SessionKind;
}

export interface SessionComparison {
  practice: boolean;
  previousSessionId: string | null;
  previousScore: number | null;
  previousCompletedAt: string | null;
  scoreDelta: number | null;
  completedExamCount: number;
  weakestChapterTitle: string | null;
  weakestChapterMissed: number;
  weakestChapterTotal: number;
}

export interface TrendPoint {
  sessionId: string;
  completedAt: string;
  score: number;
}

export interface ChapterAccuracy {
  chapterId: string;
  title: string;
  questionCount: number;
  answered: number;
  correct: number;
  accuracyPercent: number | null;
}

export interface AreaProgress {
  studyAreaId: string;
  title: string;
  trend: TrendPoint[];
  chapters: ChapterAccuracy[];
  recommendation: ChapterAccuracy | null;
}

export type ReminderFrequency = 'OFF' | 'DAILY' | 'WEEKLY';

export interface ExamDate {
  studyAreaId: string;
  title: string;
  examDate: string;
  daysLeft: number;
}

export interface RetentionState {
  dailyGoal: number;
  answeredToday: number;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  reminderFrequency: ReminderFrequency;
  remindersAvailable: boolean;
  examDates: ExamDate[];
}

export interface PopularArea {
  id: string;
  title: string;
  questionCount: number;
  sessionCount: number;
}

export interface ExamSetupSettings {
  showAnswerPerQuestion: boolean;
  allowBack: boolean;
  discountFactor: number;
  passingScore: number;
  examDurationMinutes: number;
  chapterQuestionCounts: Record<string, number>;
}

export interface ExamSetup {
  id: string;
  name: string;
  preset: 'TRAINING' | 'SIMULATION';
  isDefault: boolean;
  settings: ExamSetupSettings;
}

export interface StudyPlan {
  state: 'NO_DATE' | 'PAST_DATE' | 'NO_QUESTIONS' | 'READY';
  studyAreaId: string | null;
  areaTitle: string | null;
  examDate: string | null;
  daysLeft: number | null;
  reason: 'NO_CHAPTERS' | 'START' | 'WEAK' | 'UNTRIED' | 'IMPROVE' | 'MAINTAIN' | null;
  chapterId: string | null;
  chapterTitle: string | null;
  accuracyPercent: number | null;
  questionCount: number;
  remainingQuestions: number;
  dailyGoal: number;
  answeredToday: number;
  goalMet: boolean;
  activeSessionId: string | null;
}

export interface ChapterReadiness {
  chapterId: string | null;
  title: string | null;
  questionCount: number;
  seen: number;
  recentAnswers: number;
  recentAccuracyPercent: number | null;
  enoughData: boolean;
}

export interface SimulationResult {
  sessionId: string;
  completedAt: string;
  score: number;
  passingScore: number;
  passed: boolean;
}

export interface Readiness {
  studyAreaId: string;
  areaTitle: string;
  band: 'INSUFFICIENT_DATA' | 'LOW' | 'MODERATE' | 'GOOD';
  estimatePercent: number | null;
  questionCount: number;
  seen: number;
  coveragePercent: number;
  answersCounted: number;
  sessionsCounted: number;
  lastActivityAt: string | null;
  knowledgePercent: number | null;
  simulationAveragePercent: number | null;
  minAnswers: number;
  minCoveragePercent: number;
  answersPerChapterWindow: number;
  chapters: ChapterReadiness[];
  simulations: SimulationResult[];
}

export interface ChapterResult {
  chapterId: string | null;
  title: string | null;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
}

export interface SessionReport {
  sessionId: string;
  studyAreaId: string;
  areaTitle: string;
  kind: SessionKind;
  simulation: boolean;
  startedAt: string;
  completedAt: string;
  score: number;
  passingScore: number;
  passed: boolean;
  timeUsedSeconds: number;
  timeLimitMinutes: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  chapters: ChapterResult[];
  nextStep: 'REVIEW_MISTAKES' | 'TRAIN_CHAPTER' | 'SIMULATE_AGAIN';
  nextChapterTitle: string | null;
}

export interface QuestionMark {
  id: string;
  questionId: string | null;
  studyAreaId: string | null;
  areaTitle: string;
  marked: boolean;
  note: string | null;
  status: 'AVAILABLE' | 'QUESTION_DELETED' | 'NO_ACCESS';
  prompt: string | null;
  updatedAt: string;
}

export const examprepApi = {
  // Study Areas
  createStudyArea: async (data: { title: string; description: string; visibility: 'PUBLIC' | 'PRIVATE' }) => {
    const res = await axiosInstance.post<StudyArea>('/api/study-areas', data);
    return res.data;
  },

  listStudyAreas: async (params: { page: number; size: number; q?: string }) => {
    const res = await axiosInstance.get<PageResponse<StudyArea>>('/api/study-areas', { params });
    return res.data;
  },

  listMyStudyAreas: async () => {
    const res = await axiosInstance.get<StudyArea[]>('/api/study-areas/mine');
    return res.data;
  },

  getStudyArea: async (id: string) => {
    const res = await axiosInstance.get<StudyArea>(`/api/study-areas/${id}`);
    return res.data;
  },

  updateStudyArea: async (id: string, data: { title: string; description: string; visibility: 'PUBLIC' | 'PRIVATE' }) => {
    const res = await axiosInstance.put<StudyArea>(`/api/study-areas/${id}`, data);
    return res.data;
  },

  deleteStudyArea: async (id: string) => {
    const res = await axiosInstance.delete(`/api/study-areas/${id}`);
    return res.data;
  },

  starStudyArea: async (id: string) => {
    const res = await axiosInstance.post(`/api/study-areas/${id}/star`);
    return res.data;
  },

  unstarStudyArea: async (id: string) => {
    const res = await axiosInstance.post(`/api/study-areas/${id}/unstar`);
    return res.data;
  },

  // Questions
  addQuestion: async (studyAreaId: string, question: Omit<Question, 'id'>) => {
    const res = await axiosInstance.post<Question>(`/api/study-areas/${studyAreaId}/questions`, question);
    return res.data;
  },

  editQuestion: async (questionId: string, question: Question) => {
    const res = await axiosInstance.put<Question>(`/api/questions/${questionId}`, question);
    return res.data;
  },

  deleteQuestion: async (questionId: string) => {
    await axiosInstance.delete(`/api/questions/${questionId}`);
  },

  importQuestions: async (studyAreaId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post<Question[]>(
      `/api/study-areas/${studyAreaId}/questions/import`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },

  // Chapters
  listChapters: async (studyAreaId: string) => {
    const res = await axiosInstance.get<Chapter[]>(`/api/study-areas/${studyAreaId}/chapters`);
    return res.data;
  },

  createChapter: async (studyAreaId: string, title: string) => {
    const res = await axiosInstance.post<Chapter>(`/api/study-areas/${studyAreaId}/chapters`, { title });
    return res.data;
  },

  editChapter: async (chapterId: string, title: string) => {
    const res = await axiosInstance.put<Chapter>(`/api/chapters/${chapterId}`, { title });
    return res.data;
  },

  deleteChapter: async (chapterId: string) => {
    await axiosInstance.delete(`/api/chapters/${chapterId}`);
  },

  reorderChapters: async (studyAreaId: string, chapterIds: string[]) => {
    await axiosInstance.put(`/api/study-areas/${studyAreaId}/chapters/reorder`, { itemIds: chapterIds });
  },

  reorderQuestions: async (studyAreaId: string, questions: { id: string; chapterId: string | null; orderIndex: number }[]) => {
    await axiosInstance.put(`/api/study-areas/${studyAreaId}/questions/reorder`, questions);
  },

  // Exam Sessions
  startSession: async (studyAreaId: string, settings: SessionSettings) => {
    const res = await axiosInstance.post<ExamSession>(`/api/study-areas/${studyAreaId}/sessions`, settings);
    return res.data;
  },

  getSession: async (sessionId: string) => {
    const res = await axiosInstance.get<ExamSession>(`/api/sessions/${sessionId}`);
    return res.data;
  },

  submitAnswer: async (sessionId: string, questionId: string, optionId: string) => {
    const res = await axiosInstance.post<SessionAnswer>(`/api/sessions/${sessionId}/answers`, {
      questionId,
      optionId,
    });
    return res.data;
  },

  completeSession: async (sessionId: string) => {
    const res = await axiosInstance.post<ExamSession>(`/api/sessions/${sessionId}/complete`);
    return res.data;
  },

  getSessionResult: async (sessionId: string) => {
    const res = await axiosInstance.get<ExamSession>(`/api/sessions/${sessionId}/result`);
    return res.data;
  },

  listMySessions: async () => {
    const res = await axiosInstance.get<ExamSession[]>('/api/sessions');
    return res.data;
  },

  practiceWrongAnswers: async (sessionId: string) => {
    const res = await axiosInstance.post<ExamSession>(`/api/sessions/${sessionId}/practice-wrong`);
    return res.data;
  },

  getSessionComparison: async (sessionId: string) => {
    const res = await axiosInstance.get<SessionComparison>(`/api/sessions/${sessionId}/comparison`);
    return res.data;
  },

  // Progress and return mechanics
  getProgress: async () => {
    const res = await axiosInstance.get<AreaProgress[]>('/api/me/progress');
    return res.data;
  },

  getRetention: async () => {
    const res = await axiosInstance.get<RetentionState>('/api/me/retention');
    return res.data;
  },

  updateRetentionSettings: async (data: { dailyGoal?: number; reminderFrequency?: ReminderFrequency }) => {
    const res = await axiosInstance.put<RetentionState>('/api/me/retention/settings', { ...data, locale: i18n.language });
    return res.data;
  },

  setExamDate: async (studyAreaId: string, examDate: string) => {
    const res = await axiosInstance.put<RetentionState>(`/api/study-areas/${studyAreaId}/exam-date`, { examDate });
    return res.data;
  },

  clearExamDate: async (studyAreaId: string) => {
    const res = await axiosInstance.delete<RetentionState>(`/api/study-areas/${studyAreaId}/exam-date`);
    return res.data;
  },

  getPopularArea: async () => {
    const res = await axiosInstance.get<PopularArea | ''>('/api/study-areas/popular');
    return res.status === 204 || !res.data ? null : res.data;
  },

  listExamSetups: async (studyAreaId: string) => {
    const res = await axiosInstance.get<ExamSetup[]>(`/api/study-areas/${studyAreaId}/exam-setups`);
    return res.data;
  },

  createExamSetup: async (studyAreaId: string, setup: Omit<ExamSetup, 'id'>) => {
    const res = await axiosInstance.post<ExamSetup>(`/api/study-areas/${studyAreaId}/exam-setups`, setup);
    return res.data;
  },

  setDefaultExamSetup: async (setupId: string, isDefault: boolean) => {
    await axiosInstance.put(`/api/exam-setups/${setupId}/default`, { isDefault });
  },

  deleteExamSetup: async (setupId: string) => {
    await axiosInstance.delete(`/api/exam-setups/${setupId}`);
  },

  // Study plan and reports
  getStudyPlan: async () => {
    const res = await axiosInstance.get<StudyPlan>('/api/me/study-plan');
    return res.data;
  },

  startStudyPlan: async (studyAreaId?: string | null) => {
    const res = await axiosInstance.post<ExamSession>('/api/me/study-plan/start', null, { params: studyAreaId ? { studyAreaId } : undefined });
    return res.data;
  },

  getReadiness: async (studyAreaId: string) => {
    const res = await axiosInstance.get<Readiness>(`/api/study-areas/${studyAreaId}/readiness`);
    return res.data;
  },

  getSessionReport: async (sessionId: string) => {
    const res = await axiosInstance.get<SessionReport>(`/api/sessions/${sessionId}/report`);
    return res.data;
  },

  // Marks and notes
  listQuestionMarks: async (studyAreaId?: string) => {
    const res = await axiosInstance.get<QuestionMark[]>('/api/me/question-marks', { params: studyAreaId ? { studyAreaId } : undefined });
    return res.data;
  },

  markQuestion: async (questionId: string) => {
    const res = await axiosInstance.put<QuestionMark>(`/api/questions/${questionId}/mark`);
    return res.data;
  },

  saveQuestionNote: async (questionId: string, note: string) => {
    const res = await axiosInstance.put<QuestionMark>(`/api/questions/${questionId}/note`, { note });
    return res.data;
  },

  unmarkQuestion: async (markId: string) => {
    await axiosInstance.delete(`/api/question-marks/${markId}/mark`);
  },

  deleteQuestionNote: async (markId: string) => {
    await axiosInstance.delete(`/api/question-marks/${markId}/note`);
  },

  practiceMarked: async (studyAreaId: string) => {
    const res = await axiosInstance.post<ExamSession>(`/api/study-areas/${studyAreaId}/practice-marked`);
    return res.data;
  },

  // Admin
  adminListStudyAreas: async () => {
    const res = await axiosInstance.get<StudyArea[]>('/api/admin/study-areas');
    return res.data;
  },

  adminDeleteStudyArea: async (id: string) => {
    await axiosInstance.delete(`/api/admin/study-areas/${id}`);
  },
};
