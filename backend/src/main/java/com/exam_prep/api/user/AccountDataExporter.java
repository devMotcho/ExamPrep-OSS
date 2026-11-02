package com.exam_prep.api.user;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Everything the app stores about one person, for the right of access and data portability. Password hashes,
 * session tokens, one-time codes and the reminder unsubscribe token are left out: they are secrets, not data about
 * the person.
 */
@Service
@RequiredArgsConstructor
public class AccountDataExporter {

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public Map<String, Object> export(UUID userId, String email) {
        String mail = email.trim().toLowerCase(Locale.ROOT);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", Instant.now().toString());
        data.put("account", rows("""
                SELECT id, email, name, public_name, phone, role, is_active, is_confirmed, oauth_provider, created_at,
                       updated_at, last_login_at
                FROM users WHERE id = ?""", userId).stream().findFirst().orElse(Map.of()));
        data.put("studyAreas", rows("SELECT * FROM study_areas WHERE created_by = ? ORDER BY created_at", userId));
        data.put("chapters", rows("""
                SELECT c.* FROM chapters c JOIN study_areas s ON s.id = c.study_area_id
                WHERE s.created_by = ? ORDER BY c.study_area_id, c.order_index""", userId));
        data.put("questions", rows("SELECT * FROM questions WHERE created_by = ? ORDER BY study_area_id, created_at", userId));
        data.put("options", rows("""
                SELECT o.* FROM options o JOIN questions q ON q.id = o.question_id
                WHERE q.created_by = ? ORDER BY o.question_id""", userId));
        data.put("joinedStudyAreas", rows("SELECT * FROM user_study_areas WHERE user_id = ?", userId));
        data.put("examSessions", rows("SELECT * FROM exam_sessions WHERE user_id = ? ORDER BY started_at", userId));
        data.put("examAnswers", rows("""
                SELECT a.* FROM session_answers a JOIN exam_sessions e ON e.id = a.session_id
                WHERE e.user_id = ? ORDER BY a.session_id, a.answered_at""", userId));
        data.put("examDates", rows("SELECT * FROM user_exam_dates WHERE user_id = ?", userId));
        data.put("examSetups", rows("SELECT * FROM user_exam_setups WHERE user_id = ?", userId));
        data.put("questionMarks", rows("SELECT * FROM question_marks WHERE user_id = ?", userId));
        data.put("studySettings", rows("""
                SELECT daily_goal_questions, reminder_frequency, reminder_consent_at, last_reminder_sent_on, locale, updated_at
                FROM user_retention_settings WHERE user_id = ?""", userId));
        data.put("images", rows("""
                SELECT id, filename, folder, uploaded_at FROM gallery_images WHERE uploaded_by = ? ORDER BY uploaded_at""", userId));
        data.put("uploadUsage", rows("SELECT usage_date, upload_count FROM user_upload_usage WHERE user_id = ? ORDER BY usage_date", userId));
        data.put("aiGenerationJobs", rows("SELECT * FROM ai_generation_jobs WHERE user_id = ? ORDER BY created_at", userId));
        data.put("blogPosts", rows("""
                SELECT id, slug, locale, title, status, author_name, published_at, created_at, updated_at
                FROM blog_posts WHERE author_id = ? ORDER BY created_at""", userId));
        data.put("sessions", rows("""
                SELECT created_at, expiry_date, revoked, rotated_at FROM refresh_tokens WHERE user_id = ? ORDER BY created_at""", userId));
        data.put("contactMessages", rows("SELECT * FROM contact_messages WHERE lower(email) = ? ORDER BY created_at", mail));
        data.put("failedLogins", rows("""
                SELECT ip_address, failed_attempts, created_at, updated_at FROM login_lockouts WHERE lower(username) = ?""", mail));
        data.put("devices", rows("SELECT * FROM device_telemetry WHERE user_id = ?", userId));
        return data;
    }

    private List<Map<String, Object>> rows(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, args);
        rows.forEach(row -> row.replaceAll((column, value) -> plain(value)));
        return rows;
    }

    /** JSON-friendly values: timestamps as ISO-8601 text, and driver types such as JSON columns as their text. */
    private static Object plain(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean
                || value instanceof UUID) {
            return value;
        }
        return value.toString();
    }
}
