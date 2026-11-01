package com.exam_prep.api.study;

import com.exam_prep.api.dto.ExamSessionDto;
import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.entity.ExamSessionEntity;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.ExamSessionRepository;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.service.ExamSessionService;
import com.exam_prep.api.service.RetentionService;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Today's plan: fixed rules over the exam date, chapter accuracy, untried chapters and question counts.
 * The same inputs always give the same plan, and the client only words the reason it is given. No AI.
 */
@Service
@RequiredArgsConstructor
public class StudyPlanService {

    static final int MIN_PLAN_QUESTIONS = 5;
    static final int MAX_PLAN_QUESTIONS = 40;
    static final int EXAM_DAY_QUESTIONS = 10;
    static final int WEAK_BELOW_PERCENT = 60;
    static final int SOLID_FROM_PERCENT = 80;
    static final int MIN_ANSWERS_TO_JUDGE_CHAPTER = 3;
    static final int MIN_ANSWERS_TO_JUDGE_AREA = 5;

    private final JdbcTemplate jdbcTemplate;
    private final StudyAreaRepository studyAreaRepository;
    private final ExamSessionRepository examSessionRepository;
    private final ExamSessionService examSessionService;
    private final RetentionService retentionService;

    /**
     * state: NO_DATE, PAST_DATE, NO_QUESTIONS or READY.
     * reason, when READY: NO_CHAPTERS, START (too little data), WEAK, UNTRIED, IMPROVE or MAINTAIN.
     */
    public record Plan(String state, UUID studyAreaId, String areaTitle, LocalDate examDate, Long daysLeft,
                       String reason, UUID chapterId, String chapterTitle, Integer accuracyPercent,
                       int questionCount, int remainingQuestions, int dailyGoal, int answeredToday, boolean goalMet,
                       UUID activeSessionId) {}

    private record ExamTarget(UUID areaId, String title, LocalDate date) {}

    /** A question and the user's latest answer to it: null when never answered. */
    private record QuestionState(UUID id, UUID chapterId, Boolean correct) {
        boolean toDo() { return !Boolean.TRUE.equals(correct); }
    }

    private record ChapterState(UUID id, String title, List<QuestionState> questions) {
        long answered() { return questions.stream().filter(q -> q.correct() != null).count(); }
        long correct() { return questions.stream().filter(q -> Boolean.TRUE.equals(q.correct())).count(); }
        long toDo() { return questions.stream().filter(QuestionState::toDo).count(); }
        Integer accuracy() { return answered() > 0 ? Math.round(correct() * 100f / answered()) : null; }
    }

    private record Choice(String reason, ChapterState chapter) {}

    @Transactional(readOnly = true)
    public Plan today(UserEntity user, UUID studyAreaId) {
        LocalDate today = LocalDate.now(RetentionService.ZONE);
        RetentionDtos.RetentionState retention = retentionService.getState(user);
        int goal = retention.dailyGoal();
        int answered = retention.answeredToday();
        boolean goalMet = answered >= goal;

        List<ExamTarget> targets = examTargets(user, studyAreaId);
        List<ExamTarget> upcoming = targets.stream().filter(t -> !t.date().isBefore(today)).toList();

        if (upcoming.isEmpty()) {
            Optional<ExamTarget> past = targets.stream().max(Comparator.comparing(ExamTarget::date));
            return past.map(p -> new Plan("PAST_DATE", p.areaId(), p.title(), p.date(), ChronoUnit.DAYS.between(today, p.date()),
                            null, null, null, null, 0, 0, goal, answered, goalMet, null))
                    .orElseGet(() -> new Plan("NO_DATE", null, null, null, null, null, null, null, null, 0, 0, goal, answered, goalMet, null));
        }

        // The nearest exam comes first, unless its area has nothing to practise yet and a later one does.
        ExamTarget target = null;
        List<QuestionState> questions = List.of();
        for (ExamTarget candidate : upcoming) {
            List<QuestionState> states = questionStates(user.getId(), candidate.areaId());
            if (!states.isEmpty()) {
                target = candidate;
                questions = states;
                break;
            }
        }
        if (target == null) {
            ExamTarget first = upcoming.get(0);
            return new Plan("NO_QUESTIONS", first.areaId(), first.title(), first.date(), ChronoUnit.DAYS.between(today, first.date()),
                    null, null, null, null, 0, 0, goal, answered, goalMet, null);
        }

        long daysLeft = ChronoUnit.DAYS.between(today, target.date());
        Choice choice = choose(chapters(target.areaId(), questions), questions);
        ChapterState chapter = choice.chapter();
        long remaining = questions.stream().filter(QuestionState::toDo).count();
        int count = planSize(remaining, daysLeft, goal, answered, chapter != null ? chapter.questions().size() : questions.size());

        return new Plan("READY", target.areaId(), target.title(), target.date(), daysLeft,
                choice.reason(), chapter != null ? chapter.id() : null, chapter != null ? chapter.title() : null,
                chapter != null ? chapter.accuracy() : null, count, (int) remaining, goal, answered, goalMet,
                activeSession(user, target.areaId()));
    }

    /** Recomputes the plan on the server, so what starts is what the rules say and not what a client asked for. */
    @Transactional
    public ExamSessionDto start(UserEntity user, UUID studyAreaId) {
        Plan plan = today(user, studyAreaId);
        if (!"READY".equals(plan.state())) {
            throw new AppException("There is no plan to start today", HttpStatus.CONFLICT);
        }
        List<QuestionState> pool = questionStates(user.getId(), plan.studyAreaId()).stream()
                .filter(q -> plan.chapterId() == null || plan.chapterId().equals(q.chapterId()))
                .toList();
        // Mistakes first, then what is new, then what already went well.
        List<UUID> chosen = pool.stream()
                .sorted(Comparator.comparingInt(q -> Boolean.FALSE.equals(q.correct()) ? 0 : q.correct() == null ? 1 : 2))
                .limit(plan.questionCount())
                .map(QuestionState::id)
                .toList();
        StudyAreaEntity area = studyAreaRepository.findById(plan.studyAreaId())
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        return examSessionService.startChosenQuestions(area, chosen, ExamSessionEntity.KIND_PLAN, user);
    }

    /** Spread what is left evenly over the days left, and never less than what today's goal still needs. */
    static int planSize(long remaining, long daysLeft, int dailyGoal, int answeredToday, int available) {
        if (daysLeft <= 0) {
            return Math.min(EXAM_DAY_QUESTIONS, available);
        }
        long perDay = (long) Math.ceil((double) remaining / daysLeft);
        long wanted = Math.max(perDay, dailyGoal - answeredToday);
        wanted = Math.max(MIN_PLAN_QUESTIONS, Math.min(MAX_PLAN_QUESTIONS, wanted));
        return (int) Math.min(wanted, available);
    }

    /** The rules, in order. Ties go to the chapter that comes first in the area, so the result never wobbles. */
    private static Choice choose(List<ChapterState> chapters, List<QuestionState> questions) {
        if (chapters.isEmpty()) {
            return new Choice("NO_CHAPTERS", null);
        }
        long answeredInArea = questions.stream().filter(q -> q.correct() != null).count();
        if (answeredInArea < MIN_ANSWERS_TO_JUDGE_AREA) {
            ChapterState leastTried = chapters.stream().min(Comparator.comparingLong(ChapterState::answered)).orElseThrow();
            return new Choice("START", leastTried);
        }

        List<ChapterState> judged = chapters.stream().filter(c -> c.answered() >= MIN_ANSWERS_TO_JUDGE_CHAPTER).toList();
        Comparator<ChapterState> lowestAccuracy = Comparator.comparingInt(ChapterState::accuracy);

        Optional<ChapterState> weak = judged.stream().filter(c -> c.accuracy() < WEAK_BELOW_PERCENT).min(lowestAccuracy);
        if (weak.isPresent()) return new Choice("WEAK", weak.get());

        Optional<ChapterState> untried = chapters.stream().filter(c -> c.answered() == 0)
                .max(Comparator.comparingInt(c -> c.questions().size()));
        if (untried.isPresent()) return new Choice("UNTRIED", untried.get());

        Optional<ChapterState> belowSolid = judged.stream().filter(c -> c.accuracy() < SOLID_FROM_PERCENT).min(lowestAccuracy);
        if (belowSolid.isPresent()) return new Choice("IMPROVE", belowSolid.get());

        ChapterState mostLeft = chapters.stream().max(Comparator.comparingLong(ChapterState::toDo)).orElseThrow();
        return new Choice("MAINTAIN", mostLeft);
    }

    /** Only areas the user can still open. A date on an area they lost access to is not a plan. */
    private List<ExamTarget> examTargets(UserEntity user, UUID studyAreaId) {
        if (studyAreaId != null) {
            StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                    .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
            examSessionService.assertAreaAccess(area, user);
        }
        return jdbcTemplate.query("""
                SELECT d.study_area_id, a.title, d.exam_date
                FROM user_exam_dates d
                JOIN study_areas a ON a.id = d.study_area_id
                WHERE d.user_id = ?
                  AND (?::uuid IS NULL OR d.study_area_id = ?::uuid)
                  AND (a.visibility <> 'PRIVATE' OR a.created_by = ? OR ?
                       OR EXISTS (SELECT 1 FROM user_study_areas u WHERE u.user_id = d.user_id AND u.study_area_id = a.id))
                ORDER BY d.exam_date, a.title
                """, (rs, n) -> new ExamTarget(rs.getObject("study_area_id", UUID.class), rs.getString("title"),
                        rs.getObject("exam_date", LocalDate.class)),
                user.getId(), studyAreaId, studyAreaId, user.getId(), "ROLE_ADMIN".equals(user.getRole()));
    }

    /** Same meaning as the progress panel: only the latest answer to each question counts, so its numbers agree with the plan's. */
    private List<QuestionState> questionStates(UUID userId, UUID areaId) {
        return jdbcTemplate.query("""
                WITH latest AS (
                    SELECT DISTINCT ON (sa.question_id) sa.question_id, sa.correct
                    FROM session_answers sa
                    JOIN exam_sessions es ON es.id = sa.session_id
                    WHERE es.user_id = ? AND es.study_area_id = ? AND es.completed_at IS NOT NULL
                    ORDER BY sa.question_id, sa.answered_at DESC
                )
                SELECT q.id, q.chapter_id, l.correct
                FROM questions q
                LEFT JOIN latest l ON l.question_id = q.id
                WHERE q.study_area_id = ?
                ORDER BY q.order_index NULLS LAST, q.created_at, q.id
                """, (rs, n) -> new QuestionState(rs.getObject("id", UUID.class), rs.getObject("chapter_id", UUID.class),
                        (Boolean) rs.getObject("correct")), userId, areaId, areaId);
    }

    /** Chapters that have questions, in the area's own order. */
    private List<ChapterState> chapters(UUID areaId, List<QuestionState> questions) {
        Map<UUID, List<QuestionState>> byChapter = new LinkedHashMap<>();
        for (QuestionState q : questions) {
            if (q.chapterId() != null) byChapter.computeIfAbsent(q.chapterId(), id -> new ArrayList<>()).add(q);
        }
        List<ChapterState> result = new ArrayList<>();
        jdbcTemplate.query("SELECT id, title FROM chapters WHERE study_area_id = ? ORDER BY order_index NULLS LAST, created_at, id", rs -> {
            UUID id = rs.getObject("id", UUID.class);
            List<QuestionState> inChapter = byChapter.get(id);
            if (inChapter != null) result.add(new ChapterState(id, rs.getString("title"), inChapter));
        }, areaId);
        return result;
    }

    private UUID activeSession(UserEntity user, UUID areaId) {
        return jdbcTemplate.queryForList(
                "SELECT id FROM exam_sessions WHERE user_id = ? AND study_area_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1",
                UUID.class, user.getId(), areaId).stream().findFirst().orElse(null);
    }
}
