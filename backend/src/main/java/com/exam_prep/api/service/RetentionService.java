package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.user.UserEntity;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Score trends, chapter accuracy, exam dates, daily goal and streak. All "days" are Europe/Lisbon days. */
@Service
@RequiredArgsConstructor
public class RetentionService {

    /** Decides when a study day starts for streaks, goals and reminders. Set with APP_TIMEZONE. */
    public static final ZoneId ZONE = ZoneId.of(System.getenv().getOrDefault("APP_TIMEZONE", "UTC"));

    private static final int TREND_POINTS_PER_AREA = 12;
    private static final int DEFAULT_DAILY_GOAL = 10;
    private static final int MAX_DAILY_GOAL = 500;
    private static final int MAX_EXAM_DATE_YEARS_AHEAD = 5;
    private static final int RECOMMEND_BELOW_PERCENT = 80;
    private static final int RECOMMEND_MIN_ANSWERED = 2;
    private static final Set<String> FREQUENCIES = Set.of("OFF", "DAILY", "WEEKLY");

    private final JdbcTemplate jdbcTemplate;
    private final StudyAreaRepository studyAreaRepository;
    private final ExamSessionService examSessionService;
    private final ReminderAvailability reminderAvailability;

    // ── Progress ──────────────────────────────────────────────────────────────

    public List<RetentionDtos.AreaProgress> getProgress(UserEntity user) {
        record AreaData(String title, List<RetentionDtos.TrendPoint> trend, List<RetentionDtos.ChapterAccuracy> chapters) {}
        Map<UUID, AreaData> areas = new LinkedHashMap<>();

        jdbcTemplate.query("""
                SELECT s.id, s.study_area_id, a.title, s.final_score, s.completed_at
                FROM (
                    SELECT es.*, row_number() OVER (PARTITION BY es.study_area_id ORDER BY es.completed_at DESC) AS rn
                    FROM exam_sessions es
                    WHERE es.user_id = ? AND es.completed_at IS NOT NULL
                      AND es.final_score IS NOT NULL AND es.session_kind NOT IN ('PRACTICE_WRONG', 'MARKED')
                ) s
                JOIN study_areas a ON a.id = s.study_area_id
                WHERE s.rn <= ?
                ORDER BY s.completed_at DESC
                """, rs -> {
            UUID areaId = rs.getObject("study_area_id", UUID.class);
            areas.computeIfAbsent(areaId, id -> {
                try {
                    return new AreaData(rs.getString("title"), new ArrayList<>(), new ArrayList<>());
                } catch (java.sql.SQLException e) {
                    throw new IllegalStateException(e);
                }
            }).trend().add(0, new RetentionDtos.TrendPoint(
                    rs.getObject("id", UUID.class),
                    rs.getObject("completed_at", OffsetDateTime.class),
                    rs.getBigDecimal("final_score")));
        }, user.getId(), TREND_POINTS_PER_AREA);

        // Only the latest answer to each question counts, so fixing a mistake raises the chapter's accuracy.
        jdbcTemplate.query("""
                WITH latest AS (
                    SELECT DISTINCT ON (sa.question_id) sa.question_id, sa.correct
                    FROM session_answers sa
                    JOIN exam_sessions es ON es.id = sa.session_id
                    WHERE es.user_id = ? AND es.completed_at IS NOT NULL
                    ORDER BY sa.question_id, sa.answered_at DESC
                )
                SELECT c.study_area_id, c.id, c.title,
                       count(q.id) AS question_count,
                       count(l.question_id) AS answered,
                       count(*) FILTER (WHERE l.correct) AS correct
                FROM chapters c
                JOIN questions q ON q.chapter_id = c.id
                LEFT JOIN latest l ON l.question_id = q.id
                WHERE c.study_area_id IN (SELECT study_area_id FROM exam_sessions WHERE user_id = ?)
                GROUP BY c.study_area_id, c.id, c.title, c.order_index, c.created_at
                ORDER BY c.order_index, c.created_at
                """, rs -> {
            AreaData area = areas.get(rs.getObject("study_area_id", UUID.class));
            if (area == null) return;
            int answered = rs.getInt("answered");
            int correct = rs.getInt("correct");
            area.chapters().add(new RetentionDtos.ChapterAccuracy(
                    rs.getObject("id", UUID.class),
                    rs.getString("title"),
                    rs.getInt("question_count"),
                    answered,
                    correct,
                    answered > 0 ? Math.round(correct * 100f / answered) : null));
        }, user.getId(), user.getId());

        List<RetentionDtos.AreaProgress> result = new ArrayList<>();
        areas.forEach((id, data) -> result.add(new RetentionDtos.AreaProgress(
                id, data.title(), data.trend(), data.chapters(), recommend(data.chapters()))));
        return result;
    }

    /** Weakest attempted chapter, otherwise the first chapter not tried yet, otherwise nothing. */
    private RetentionDtos.ChapterAccuracy recommend(List<RetentionDtos.ChapterAccuracy> chapters) {
        Optional<RetentionDtos.ChapterAccuracy> weakest = chapters.stream()
                .filter(c -> c.answered() >= RECOMMEND_MIN_ANSWERED && c.accuracyPercent() < RECOMMEND_BELOW_PERCENT)
                .min(Comparator.comparingInt(RetentionDtos.ChapterAccuracy::accuracyPercent)
                        .thenComparing(Comparator.comparingInt(RetentionDtos.ChapterAccuracy::answered).reversed()));
        return weakest.orElseGet(() -> chapters.stream().filter(c -> c.answered() == 0).findFirst().orElse(null));
    }

    // ── Goal, streak, exam dates ──────────────────────────────────────────────

    public RetentionDtos.RetentionState getState(UserEntity user) {
        UUID userId = user.getId();
        LocalDate today = LocalDate.now(ZONE);

        int dailyGoal = DEFAULT_DAILY_GOAL;
        String frequency = "OFF";
        List<Map<String, Object>> settings = jdbcTemplate.queryForList(
                "SELECT daily_goal_questions, reminder_frequency FROM user_retention_settings WHERE user_id = ?", userId);
        if (!settings.isEmpty()) {
            dailyGoal = (Integer) settings.get(0).get("daily_goal_questions");
            frequency = (String) settings.get(0).get("reminder_frequency");
        }

        List<LocalDate> completedDays = jdbcTemplate.queryForList("""
                SELECT DISTINCT (es.completed_at AT TIME ZONE ?)::date AS day
                FROM exam_sessions es
                WHERE es.user_id = ? AND es.completed_at IS NOT NULL
                  AND EXISTS (SELECT 1 FROM session_answers sa WHERE sa.session_id = es.id)
                ORDER BY day DESC
                """, LocalDate.class, ZONE.getId(), userId);

        List<RetentionDtos.ExamDate> examDates = jdbcTemplate.query("""
                SELECT d.study_area_id, a.title, d.exam_date
                FROM user_exam_dates d
                JOIN study_areas a ON a.id = d.study_area_id
                WHERE d.user_id = ? AND d.exam_date >= ?
                ORDER BY d.exam_date
                """, (rs, n) -> {
            LocalDate date = rs.getObject("exam_date", LocalDate.class);
            return new RetentionDtos.ExamDate(rs.getObject("study_area_id", UUID.class), rs.getString("title"),
                    date, ChronoUnit.DAYS.between(today, date));
        }, userId, today);

        return new RetentionDtos.RetentionState(
                dailyGoal,
                answeredOn(userId, today),
                currentStreak(completedDays, today),
                longestStreak(completedDays),
                !completedDays.isEmpty() && completedDays.get(0).equals(today),
                frequency,
                reminderAvailability.isAvailable(),
                examDates);
    }

    public int answeredOn(UUID userId, LocalDate day) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM session_answers sa
                JOIN exam_sessions es ON es.id = sa.session_id
                WHERE es.user_id = ? AND (sa.answered_at AT TIME ZONE ?)::date = ?
                """, Integer.class, userId, ZONE.getId(), day);
        return count != null ? count : 0;
    }

    /** Days must be distinct and newest first. A streak stays alive until a full day passes with no exam. */
    static int currentStreak(List<LocalDate> daysDesc, LocalDate today) {
        if (daysDesc.isEmpty() || daysDesc.get(0).isBefore(today.minusDays(1))) {
            return 0;
        }
        int streak = 1;
        for (int i = 1; i < daysDesc.size() && daysDesc.get(i).equals(daysDesc.get(i - 1).minusDays(1)); i++) {
            streak++;
        }
        return streak;
    }

    static int longestStreak(List<LocalDate> daysDesc) {
        int longest = 0;
        int run = 0;
        for (int i = 0; i < daysDesc.size(); i++) {
            run = i > 0 && daysDesc.get(i).equals(daysDesc.get(i - 1).minusDays(1)) ? run + 1 : 1;
            longest = Math.max(longest, run);
        }
        return longest;
    }

    public RetentionDtos.RetentionState updateSettings(UserEntity user, RetentionDtos.RetentionSettingsRequest request, String acceptLanguage) {
        if (request.dailyGoal() != null && (request.dailyGoal() < 1 || request.dailyGoal() > MAX_DAILY_GOAL)) {
            throw new AppException("Daily goal must be between 1 and " + MAX_DAILY_GOAL, HttpStatus.BAD_REQUEST);
        }
        if (request.reminderFrequency() != null && !FREQUENCIES.contains(request.reminderFrequency())) {
            throw new AppException("Invalid reminder frequency", HttpStatus.BAD_REQUEST);
        }
        if (request.locale() != null && !ReminderCopy.isSupported(request.locale())) {
            throw new AppException("Invalid locale", HttpStatus.BAD_REQUEST);
        }
        String locale = request.locale() != null ? request.locale() : ReminderCopy.fromAcceptLanguage(acceptLanguage);
        RetentionDtos.RetentionState current = getState(user);
        int dailyGoal = request.dailyGoal() != null ? request.dailyGoal() : current.dailyGoal();
        String frequency = request.reminderFrequency() != null ? request.reminderFrequency() : current.reminderFrequency();
        boolean remindersOn = !"OFF".equals(frequency);

        jdbcTemplate.update("""
                INSERT INTO user_retention_settings (user_id, daily_goal_questions, reminder_frequency, reminder_consent_at, locale)
                VALUES (?, ?, ?, CASE WHEN ? THEN now() END, ?)
                ON CONFLICT (user_id) DO UPDATE SET
                    daily_goal_questions = EXCLUDED.daily_goal_questions,
                    reminder_frequency = EXCLUDED.reminder_frequency,
                    reminder_consent_at = CASE WHEN ? THEN COALESCE(user_retention_settings.reminder_consent_at, now()) END,
                    locale = COALESCE(EXCLUDED.locale, user_retention_settings.locale),
                    updated_at = now()
                """, user.getId(), dailyGoal, frequency, remindersOn, locale, remindersOn);
        return getState(user);
    }

    public RetentionDtos.RetentionState setExamDate(UserEntity user, UUID studyAreaId, LocalDate examDate) {
        StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        examSessionService.assertAreaAccess(area, user);

        LocalDate today = LocalDate.now(ZONE);
        if (examDate == null || examDate.isBefore(today) || examDate.isAfter(today.plusYears(MAX_EXAM_DATE_YEARS_AHEAD))) {
            throw new AppException("Exam date must be between today and " + MAX_EXAM_DATE_YEARS_AHEAD + " years from now", HttpStatus.BAD_REQUEST);
        }
        jdbcTemplate.update("""
                INSERT INTO user_exam_dates (user_id, study_area_id, exam_date) VALUES (?, ?, ?)
                ON CONFLICT (user_id, study_area_id) DO UPDATE SET exam_date = EXCLUDED.exam_date, updated_at = now()
                """, user.getId(), studyAreaId, examDate);
        return getState(user);
    }

    public RetentionDtos.RetentionState clearExamDate(UserEntity user, UUID studyAreaId) {
        jdbcTemplate.update("DELETE FROM user_exam_dates WHERE user_id = ? AND study_area_id = ?", user.getId(), studyAreaId);
        return getState(user);
    }

    // ── First run ─────────────────────────────────────────────────────────────

    /** Public area with questions that has been practised most. */
    public Optional<RetentionDtos.PopularArea> mostPopularArea() {
        return jdbcTemplate.query("""
                SELECT a.id, a.title,
                       (SELECT count(*) FROM questions q WHERE q.study_area_id = a.id) AS question_count,
                       (SELECT count(*) FROM exam_sessions s WHERE s.study_area_id = a.id) AS session_count
                FROM study_areas a
                WHERE a.visibility = 'PUBLIC'
                  AND EXISTS (SELECT 1 FROM questions q WHERE q.study_area_id = a.id)
                ORDER BY session_count DESC, question_count DESC, a.created_at
                LIMIT 1
                """, (rs, n) -> new RetentionDtos.PopularArea(
                rs.getObject("id", UUID.class), rs.getString("title"),
                rs.getInt("question_count"), rs.getInt("session_count")))
                .stream().findFirst();
    }
}
