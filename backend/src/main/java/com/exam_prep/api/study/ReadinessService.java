package com.exam_prep.api.study;

import com.exam_prep.api.entity.ExamSessionEntity;
import com.exam_prep.api.entity.QuestionEntity;
import com.exam_prep.api.entity.SessionAnswerEntity;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.ExamSessionRepository;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.service.ExamSessionService;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The readiness estimate and the per-session report. The numbers behind the estimate go out with it, because it is an
 * estimate and the reader should be able to judge it. Reviewing mistakes and marked questions counts as having seen a
 * question, but not as accuracy: the same question with the answer just shown says little about the exam.
 */
@Service
@RequiredArgsConstructor
public class ReadinessService {

    static final int RECENT_ANSWERS_PER_CHAPTER = 30;
    static final int RECENT_SIMULATIONS = 3;
    static final int MIN_ANSWERS = 20;
    static final int MIN_COVERAGE_PERCENT = 25;
    static final int MIN_CHAPTER_ANSWERS = 5;
    static final double KNOWLEDGE_WEIGHT = 0.6;
    static final double SIMULATION_WEIGHT = 0.4;
    static final int LOW_BELOW = 50;
    static final int GOOD_FROM = 75;

    private final JdbcTemplate jdbcTemplate;
    private final StudyAreaRepository studyAreaRepository;
    private final ExamSessionRepository examSessionRepository;
    private final ExamSessionService examSessionService;

    /** recentAccuracyPercent is null when there are fewer answers than enough to mean anything. */
    public record ChapterReadiness(UUID chapterId, String title, int questionCount, int seen, int recentAnswers,
                                   Integer recentAccuracyPercent, boolean enoughData) {}

    public record SimulationResult(UUID sessionId, OffsetDateTime completedAt, BigDecimal score, double passingScore, boolean passed) {}

    /** band: INSUFFICIENT_DATA, LOW, MODERATE or GOOD. estimatePercent is null when the data is insufficient. */
    public record Readiness(UUID studyAreaId, String areaTitle, String band, Integer estimatePercent,
                            int questionCount, int seen, int coveragePercent, int answersCounted, int sessionsCounted,
                            OffsetDateTime lastActivityAt, Integer knowledgePercent, Integer simulationAveragePercent,
                            int minAnswers, int minCoveragePercent, int answersPerChapterWindow,
                            List<ChapterReadiness> chapters, List<SimulationResult> simulations) {}

    public record ChapterResult(UUID chapterId, String title, int total, int correct, int wrong, int unanswered, int percent) {}

    /** nextStep: REVIEW_MISTAKES, TRAIN_CHAPTER or SIMULATE_AGAIN; nextChapterTitle goes with TRAIN_CHAPTER. */
    public record SessionReport(UUID sessionId, UUID studyAreaId, String areaTitle, String kind, boolean simulation,
                                ZonedDateTime startedAt, ZonedDateTime completedAt, BigDecimal score, double passingScore,
                                boolean passed, long timeUsedSeconds, int timeLimitMinutes,
                                int total, int correct, int wrong, int unanswered,
                                List<ChapterResult> chapters, String nextStep, String nextChapterTitle) {}

    private static final String COUNTED_KINDS = "es.session_kind NOT IN ('PRACTICE_WRONG', 'MARKED')";

    @Transactional(readOnly = true)
    public Readiness readiness(UUID studyAreaId, UserEntity user) {
        StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        examSessionService.assertAreaAccess(area, user);
        UUID userId = user.getId();

        // Chapter id -> {questions, seen}. The null key is the questions without a chapter.
        Map<UUID, int[]> counts = new LinkedHashMap<>();
        Map<UUID, String> titles = new HashMap<>();
        jdbcTemplate.query("SELECT id, title FROM chapters WHERE study_area_id = ? ORDER BY order_index NULLS LAST, created_at, id", rs -> {
            UUID id = rs.getObject("id", UUID.class);
            counts.put(id, new int[2]);
            titles.put(id, rs.getString("title"));
        }, studyAreaId);

        jdbcTemplate.query("""
                SELECT q.chapter_id, count(*) AS questions,
                       count(*) FILTER (WHERE EXISTS (
                           SELECT 1 FROM session_answers sa JOIN exam_sessions es ON es.id = sa.session_id
                           WHERE sa.question_id = q.id AND es.user_id = ? AND es.completed_at IS NOT NULL)) AS seen
                FROM questions q WHERE q.study_area_id = ? GROUP BY q.chapter_id
                """, rs -> {
            int[] row = counts.computeIfAbsent(rs.getObject("chapter_id", UUID.class), id -> new int[2]);
            row[0] = rs.getInt("questions");
            row[1] = rs.getInt("seen");
        }, userId, studyAreaId);

        Map<UUID, int[]> recent = new HashMap<>();
        jdbcTemplate.query("""
                SELECT r.chapter_id, count(*) AS answers, count(*) FILTER (WHERE r.correct) AS correct
                FROM (
                    SELECT q.chapter_id, sa.correct,
                           row_number() OVER (PARTITION BY q.chapter_id ORDER BY sa.answered_at DESC) AS rn
                    FROM session_answers sa
                    JOIN exam_sessions es ON es.id = sa.session_id
                    JOIN questions q ON q.id = sa.question_id
                    WHERE es.user_id = ? AND es.study_area_id = ? AND es.completed_at IS NOT NULL AND %s
                ) r
                WHERE r.rn <= ?
                GROUP BY r.chapter_id
                """.formatted(COUNTED_KINDS), rs -> {
            recent.put(rs.getObject("chapter_id", UUID.class), new int[]{rs.getInt("answers"), rs.getInt("correct")});
        }, userId, studyAreaId, RECENT_ANSWERS_PER_CHAPTER);

        List<SimulationResult> simulations = jdbcTemplate.query("""
                SELECT id, completed_at, final_score, settings FROM exam_sessions
                WHERE user_id = ? AND study_area_id = ? AND session_kind = 'SIMULATION'
                  AND completed_at IS NOT NULL AND final_score IS NOT NULL
                ORDER BY completed_at DESC LIMIT ?
                """, (rs, n) -> {
            BigDecimal score = rs.getBigDecimal("final_score");
            double passing = passingScore(rs.getString("settings"));
            return new SimulationResult(rs.getObject("id", UUID.class), rs.getObject("completed_at", OffsetDateTime.class),
                    score, passing, score.doubleValue() >= passing);
        }, userId, studyAreaId, RECENT_SIMULATIONS);

        Map<String, Object> activity = jdbcTemplate.queryForMap("""
                SELECT count(*) AS answers, count(DISTINCT es.id) AS sessions
                FROM session_answers sa JOIN exam_sessions es ON es.id = sa.session_id
                WHERE es.user_id = ? AND es.study_area_id = ? AND es.completed_at IS NOT NULL AND %s
                """.formatted(COUNTED_KINDS), userId, studyAreaId);
        OffsetDateTime lastActivity = jdbcTemplate.queryForObject("""
                SELECT max(sa.answered_at)
                FROM session_answers sa JOIN exam_sessions es ON es.id = sa.session_id
                WHERE es.user_id = ? AND es.study_area_id = ? AND es.completed_at IS NOT NULL AND %s
                """.formatted(COUNTED_KINDS), OffsetDateTime.class, userId, studyAreaId);

        int questionCount = 0;
        int seenTotal = 0;
        double knowledge = 0;
        List<ChapterReadiness> chapters = new ArrayList<>();
        for (Map.Entry<UUID, int[]> entry : counts.entrySet()) {
            int questions = entry.getValue()[0];
            int seen = entry.getValue()[1];
            if (questions == 0) continue;
            int[] answers = recent.getOrDefault(entry.getKey(), new int[2]);
            double accuracy = answers[0] > 0 ? (double) answers[1] / answers[0] : 0;
            boolean enough = answers[0] >= Math.min(MIN_CHAPTER_ANSWERS, questions);

            questionCount += questions;
            seenTotal += seen;
            // What was never seen counts as not known. A chapter half seen can give at most half its weight.
            knowledge += accuracy * seen;

            chapters.add(new ChapterReadiness(entry.getKey(), titles.get(entry.getKey()), questions, seen, answers[0],
                    enough ? (int) Math.round(accuracy * 100) : null, enough));
        }

        int coverage = questionCount > 0 ? Math.round(seenTotal * 100f / questionCount) : 0;
        int answersCounted = ((Number) activity.get("answers")).intValue();
        int sessionsCounted = ((Number) activity.get("sessions")).intValue();
        int neededAnswers = Math.min(MIN_ANSWERS, questionCount);
        boolean enoughData = questionCount > 0 && answersCounted >= neededAnswers && coverage >= MIN_COVERAGE_PERCENT;

        Integer knowledgePercent = questionCount > 0 && answersCounted > 0 ? (int) Math.round(knowledge * 100 / questionCount) : null;
        Integer simulationPercent = simulations.isEmpty() ? null : (int) Math.round(simulations.stream()
                .mapToDouble(s -> s.score().doubleValue() * 5).average().orElse(0));

        Integer estimate = null;
        String band = "INSUFFICIENT_DATA";
        if (enoughData && knowledgePercent != null) {
            estimate = simulationPercent == null ? knowledgePercent
                    : (int) Math.round(knowledgePercent * KNOWLEDGE_WEIGHT + simulationPercent * SIMULATION_WEIGHT);
            band = estimate < LOW_BELOW ? "LOW" : estimate < GOOD_FROM ? "MODERATE" : "GOOD";
        }

        return new Readiness(area.getId(), area.getTitle(), band, estimate, questionCount, seenTotal, coverage,
                answersCounted, sessionsCounted, lastActivity, knowledgePercent, simulationPercent,
                neededAnswers, MIN_COVERAGE_PERCENT, RECENT_ANSWERS_PER_CHAPTER, chapters, simulations);
    }

    @Transactional(readOnly = true)
    public SessionReport sessionReport(UUID sessionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));
        // Owner only: unlike reading a session, there is no admin bypass on a personal report.
        if (!session.getUser().getId().equals(user.getId())) {
            throw new AppException("Access denied to this session", HttpStatus.FORBIDDEN);
        }
        if (session.getCompletedAt() == null) {
            throw new AppException("Session is not completed yet", HttpStatus.BAD_REQUEST);
        }
        examSessionService.assertAreaAccess(session.getStudyArea(), user);

        Map<UUID, SessionAnswerEntity> answers = session.getAnswers().stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a, (a, b) -> a));
        record Tally(UUID id, String title, int[] counts) {}
        Map<UUID, Tally> tallies = new LinkedHashMap<>();
        int correct = 0;
        int wrong = 0;
        int unanswered = 0;
        for (QuestionEntity q : examSessionService.resolveSessionQuestions(session)) {
            UUID chapterId = q.getChapter() != null ? q.getChapter().getId() : null;
            Tally tally = tallies.computeIfAbsent(chapterId, id ->
                    new Tally(id, q.getChapter() != null ? q.getChapter().getTitle() : null, new int[3]));
            SessionAnswerEntity answer = answers.get(q.getId());
            int slot = answer == null ? 2 : answer.isCorrect() ? 0 : 1;
            tally.counts()[slot]++;
            if (slot == 0) correct++;
            else if (slot == 1) wrong++;
            else unanswered++;
        }

        List<ChapterResult> chapters = tallies.values().stream().map(t -> {
            int total = t.counts()[0] + t.counts()[1] + t.counts()[2];
            return new ChapterResult(t.id(), t.title(), total, t.counts()[0], t.counts()[1], t.counts()[2],
                    total > 0 ? Math.round(t.counts()[0] * 100f / total) : 0);
        }).sorted(Comparator.comparingInt(ChapterResult::percent)).toList();

        double passingScore = session.getSettings().getPassingScore();
        BigDecimal score = session.getFinalScore() != null ? session.getFinalScore() : BigDecimal.ZERO;
        boolean passed = score.doubleValue() >= passingScore;
        int limitMinutes = session.getSettings().getExamDurationMinutes();
        long used = Math.max(0, Duration.between(session.getStartedAt(), session.getCompletedAt()).getSeconds());
        if (limitMinutes > 0) {
            // A timed session is closed on the next request after it expires, so the clock can overrun the limit.
            used = Math.min(used, limitMinutes * 60L);
        }

        int missed = wrong + unanswered;
        ChapterResult weakest = chapters.stream().filter(c -> c.chapterId() != null && c.correct() < c.total()).findFirst().orElse(null);
        String nextStep = missed == 0 ? "SIMULATE_AGAIN" : !passed && weakest != null ? "TRAIN_CHAPTER" : "REVIEW_MISTAKES";

        return new SessionReport(session.getId(), session.getStudyArea().getId(), session.getStudyArea().getTitle(),
                session.getSessionKind(), ExamSessionEntity.KIND_SIMULATION.equals(session.getSessionKind()),
                session.getStartedAt(), session.getCompletedAt(), score, passingScore, passed, used, limitMinutes,
                correct + wrong + unanswered, correct, wrong, unanswered, chapters, nextStep,
                "TRAIN_CHAPTER".equals(nextStep) ? weakest.title() : null);
    }

    private double passingScore(String settingsJson) {
        try {
            return new com.exam_prep.api.entity.SessionSettingsConverter().convertToEntityAttribute(settingsJson).getPassingScore();
        } catch (IllegalArgumentException e) {
            return 10.0;
        }
    }
}
