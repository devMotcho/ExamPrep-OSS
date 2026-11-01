interface ExamDay {
  studyAreaId: string;
  daysLeft: number;
}

/** The area to report on: today's plan, then the nearest exam, then the latest progress. */
export const readinessAreaId = (planArea?: string | null, exams?: ExamDay[], progressArea?: string): string | null => {
  if (planArea) return planArea;
  const nearest = exams?.filter((e) => e.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  return nearest?.studyAreaId ?? progressArea ?? null;
};
