export interface SessionSettings {
  showAnswerPerQuestion: boolean;
  allowBack: boolean;
  discountFactor: number;
  passingScore?: number;
  examDurationMinutes?: number;
  selectedChapterIds?: string[];
  selectedQuestionIds?: string[];
  chapterQuestionCounts?: Record<string, number>;
  preset?: 'SIMULATION' | null;
}


