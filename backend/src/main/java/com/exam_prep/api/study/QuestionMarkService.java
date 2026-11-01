package com.exam_prep.api.study;

import com.exam_prep.api.dto.ExamSessionDto;
import com.exam_prep.api.entity.ExamSessionEntity;
import com.exam_prep.api.entity.QuestionEntity;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.QuestionRepository;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.service.ExamSessionService;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A user's marks and private notes. Every statement is scoped to the user's id, so someone else's row is simply not found.
 * Reading and deleting stay open after a pass ends; creating and editing are checked by the controller.
 */
@Service
@RequiredArgsConstructor
public class QuestionMarkService {

    public static final int MAX_NOTE_LENGTH = 1000;
    private static final int MAX_ROWS_PER_USER = 5000;

    private final JdbcTemplate jdbcTemplate;
    private final QuestionRepository questionRepository;
    private final StudyAreaRepository studyAreaRepository;
    private final ExamSessionService examSessionService;

    /** AVAILABLE, QUESTION_DELETED (question or area gone) or NO_ACCESS (a private area the user has left). */
    public record Mark(UUID id, UUID questionId, UUID studyAreaId, String areaTitle, boolean marked, String note,
                       String status, String prompt, OffsetDateTime updatedAt) {}

    public record NoteRequest(String note) {}

    private static final String SELECT = """
            SELECT m.id, m.question_id, m.study_area_id, m.area_title, m.marked, m.note, m.updated_at, q.prompt,
                   (a.id IS NOT NULL AND (a.visibility <> 'PRIVATE' OR a.created_by = ? OR ?
                    OR EXISTS (SELECT 1 FROM user_study_areas u WHERE u.user_id = ? AND u.study_area_id = a.id))) AS can_read
            FROM question_marks m
            LEFT JOIN questions q ON q.id = m.question_id
            LEFT JOIN study_areas a ON a.id = m.study_area_id
            """;

    private static final RowMapper<Mark> MAPPER = (rs, n) -> {
        UUID questionId = rs.getObject("question_id", UUID.class);
        boolean canRead = rs.getBoolean("can_read");
        String status = questionId == null ? "QUESTION_DELETED" : canRead ? "AVAILABLE" : "NO_ACCESS";
        return new Mark(
                rs.getObject("id", UUID.class),
                questionId,
                rs.getObject("study_area_id", UUID.class),
                rs.getString("area_title"),
                rs.getBoolean("marked"),
                rs.getString("note"),
                status,
                "AVAILABLE".equals(status) ? rs.getString("prompt") : null,
                rs.getObject("updated_at", OffsetDateTime.class));
    };

    public List<Mark> list(UserEntity user, UUID studyAreaId) {
        boolean admin = "ROLE_ADMIN".equals(user.getRole());
        if (studyAreaId != null) {
            return jdbcTemplate.query(SELECT + " WHERE m.user_id = ? AND m.study_area_id = ? ORDER BY m.updated_at DESC",
                    MAPPER, user.getId(), admin, user.getId(), user.getId(), studyAreaId);
        }
        return jdbcTemplate.query(SELECT + " WHERE m.user_id = ? ORDER BY m.area_title, m.updated_at DESC LIMIT " + MAX_ROWS_PER_USER,
                MAPPER, user.getId(), admin, user.getId(), user.getId());
    }

    @Transactional
    public Mark mark(UUID questionId, UserEntity user) {
        QuestionEntity question = readableQuestion(questionId, user);
        return upsert(user, question, true, null);
    }

    @Transactional
    public Mark saveNote(UUID questionId, String rawNote, UserEntity user) {
        String note = cleanNote(rawNote);
        QuestionEntity question = readableQuestion(questionId, user);
        return upsert(user, question, false, note);
    }

    /** The unique constraint settles double taps and parallel requests: the loser turns into an update. */
    private Mark upsert(UserEntity user, QuestionEntity question, boolean marked, String note) {
        assertBelowCap(user, question.getId());
        StudyAreaEntity area = question.getStudyArea();
        UUID id = jdbcTemplate.queryForObject(marked ? """
                INSERT INTO question_marks (user_id, question_id, study_area_id, area_title, marked)
                VALUES (?, ?, ?, ?, TRUE)
                ON CONFLICT (user_id, question_id) DO UPDATE SET marked = TRUE, updated_at = now()
                RETURNING id
                """ : """
                INSERT INTO question_marks (user_id, question_id, study_area_id, area_title, note)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id, question_id) DO UPDATE SET note = EXCLUDED.note, updated_at = now()
                RETURNING id
                """, UUID.class, marked
                ? new Object[]{user.getId(), question.getId(), area.getId(), area.getTitle()}
                : new Object[]{user.getId(), question.getId(), area.getId(), area.getTitle(), note});
        boolean admin = "ROLE_ADMIN".equals(user.getRole());
        return jdbcTemplate.query(SELECT + " WHERE m.id = ? AND m.user_id = ?", MAPPER,
                user.getId(), admin, user.getId(), id, user.getId()).get(0);
    }

    /** Removes the mark; the row goes too unless a note is still on it. */
    @Transactional
    public void unmark(UUID markId, UserEntity user) {
        int removed = jdbcTemplate.update("DELETE FROM question_marks WHERE id = ? AND user_id = ? AND note IS NULL", markId, user.getId());
        if (removed == 0) {
            requireFound(jdbcTemplate.update("UPDATE question_marks SET marked = FALSE, updated_at = now() WHERE id = ? AND user_id = ?", markId, user.getId()));
        }
    }

    /** Removes the note; the row goes too unless the question is still marked. */
    @Transactional
    public void deleteNote(UUID markId, UserEntity user) {
        int removed = jdbcTemplate.update("DELETE FROM question_marks WHERE id = ? AND user_id = ? AND NOT marked", markId, user.getId());
        if (removed == 0) {
            requireFound(jdbcTemplate.update("UPDATE question_marks SET note = NULL, updated_at = now() WHERE id = ? AND user_id = ?", markId, user.getId()));
        }
    }

    public void delete(UUID markId, UserEntity user) {
        requireFound(jdbcTemplate.update("DELETE FROM question_marks WHERE id = ? AND user_id = ?", markId, user.getId()));
    }

    /** "Praticar marcadas": the marked questions that still exist in this area, through the normal session rules. */
    @Transactional
    public ExamSessionDto practiseMarked(UUID studyAreaId, UserEntity user) {
        StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        examSessionService.assertAreaAccess(area, user);
        List<UUID> questionIds = jdbcTemplate.queryForList("""
                SELECT m.question_id FROM question_marks m
                JOIN questions q ON q.id = m.question_id AND q.study_area_id = m.study_area_id
                WHERE m.user_id = ? AND m.study_area_id = ? AND m.marked
                """, UUID.class, user.getId(), studyAreaId);
        if (questionIds.isEmpty()) {
            throw new AppException("You have no marked questions in this study area", HttpStatus.BAD_REQUEST);
        }
        return examSessionService.startChosenQuestions(area, questionIds, ExamSessionEntity.KIND_MARKED, user);
    }

    private QuestionEntity readableQuestion(UUID questionId, UserEntity user) {
        QuestionEntity question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException("Question not found", HttpStatus.NOT_FOUND));
        examSessionService.assertAreaAccess(question.getStudyArea(), user);
        return question;
    }

    private void assertBelowCap(UserEntity user, UUID questionId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM question_marks WHERE user_id = ? AND question_id IS DISTINCT FROM ?", Integer.class, user.getId(), questionId);
        if (count != null && count >= MAX_ROWS_PER_USER) {
            throw new AppException("You reached the limit of marked questions and notes", HttpStatus.CONFLICT);
        }
    }

    /** Plain text only: line breaks stay, other control characters go. Display escapes it, so nothing else needs stripping. */
    static String cleanNote(String raw) {
        String note = raw == null ? "" : raw.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", "").trim();
        if (note.isEmpty()) {
            throw new AppException("The note is empty", HttpStatus.BAD_REQUEST);
        }
        if (note.codePointCount(0, note.length()) > MAX_NOTE_LENGTH) {
            throw new AppException("A note can have up to " + MAX_NOTE_LENGTH + " characters", HttpStatus.BAD_REQUEST);
        }
        return note;
    }

    private static void requireFound(int rows) {
        if (rows == 0) {
            throw new AppException("Not found", HttpStatus.NOT_FOUND);
        }
    }
}
