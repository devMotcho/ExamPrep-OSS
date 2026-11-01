package com.exam_prep.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/** Response and request shapes for the progress and return-mechanics endpoints. */
public final class RetentionDtos {

    private RetentionDtos() {}

    public record SessionComparison(
            boolean practice,
            UUID previousSessionId,
            BigDecimal previousScore,
            ZonedDateTime previousCompletedAt,
            BigDecimal scoreDelta,
            long completedExamCount,
            String weakestChapterTitle,
            int weakestChapterMissed,
            int weakestChapterTotal) {}

    public record TrendPoint(UUID sessionId, OffsetDateTime completedAt, BigDecimal score) {}

    public record ChapterAccuracy(UUID chapterId, String title, int questionCount, int answered, int correct, Integer accuracyPercent) {}

    public record AreaProgress(
            UUID studyAreaId,
            String title,
            List<TrendPoint> trend,
            List<ChapterAccuracy> chapters,
            ChapterAccuracy recommendation) {}

    public record ExamDate(UUID studyAreaId, String title, LocalDate examDate, long daysLeft) {}

    public record RetentionState(
            int dailyGoal,
            int answeredToday,
            int currentStreak,
            int longestStreak,
            boolean completedToday,
            String reminderFrequency,
            boolean remindersAvailable,
            List<ExamDate> examDates) {}

    /** locale is optional: without one, the language is taken from the request's Accept-Language header. */
    public record RetentionSettingsRequest(Integer dailyGoal, String reminderFrequency, String locale) {}

    public record ExamDateRequest(LocalDate examDate) {}

    public record PopularArea(UUID id, String title, int questionCount, int sessionCount) {}

    public record ReminderRunResult(String status, int sent, int failed) {}
}
