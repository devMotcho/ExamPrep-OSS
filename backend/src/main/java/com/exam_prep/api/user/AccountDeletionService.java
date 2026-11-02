package com.exam_prep.api.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.S3Service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Deletes an account and everything that identifies its owner, while keeping what other people still use:
 * <ul>
 *   <li>Study areas other people starred or sat exams in, and questions in other people's areas, move to the
 *       community account, so their exams and history survive.</li>
 *   <li>Uploaded images are deleted from storage unless a surviving question shows them.</li>
 *   <li>Rows keyed by email or with no foreign key (contact messages, login lockouts, codes and their send counters,
 *       visit telemetry) are purged, and AI job records lose their file name.</li>
 * </ul>
 * Everything else that belongs to the account goes with it through the foreign keys.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionService {

    /** Owns what other people still use after its author deleted their account. Created by V7. */
    public static final UUID COMMUNITY_ACCOUNT_ID = UUID.fromString("00000000-0000-0000-0000-00000000c0de");
    public static final String SYSTEM_ROLE = "ROLE_SYSTEM";

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    @Transactional
    public void delete(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found.", HttpStatus.NOT_FOUND));
        if (COMMUNITY_ACCOUNT_ID.equals(userId) || SYSTEM_ROLE.equals(user.getRole())) {
            throw new AppException("The community account cannot be deleted.", HttpStatus.BAD_REQUEST);
        }
        String email = user.getEmail().trim().toLowerCase(Locale.ROOT);

        int sharedAreas = jdbcTemplate.update("""
                UPDATE study_areas s SET created_by = ?
                WHERE s.created_by = ?
                  AND (EXISTS (SELECT 1 FROM user_study_areas j WHERE j.study_area_id = s.id AND j.user_id <> s.created_by)
                       OR EXISTS (SELECT 1 FROM exam_sessions e WHERE e.study_area_id = s.id AND e.user_id <> s.created_by))
                """, COMMUNITY_ACCOUNT_ID, userId);
        int sharedQuestions = jdbcTemplate.update("""
                UPDATE questions q SET created_by = ?
                WHERE q.created_by = ?
                  AND EXISTS (SELECT 1 FROM study_areas s WHERE s.id = q.study_area_id AND s.created_by <> ?)
                """, COMMUNITY_ACCOUNT_ID, userId, userId);

        // Images a surviving question shows move with it; the rest are removed from storage after the commit.
        int keptImages = jdbcTemplate.update("""
                UPDATE gallery_images g SET uploaded_by = ?
                WHERE g.uploaded_by = ?
                  AND EXISTS (SELECT 1 FROM questions q WHERE q.created_by <> ?
                              AND (strpos(q.image_url, g.s3_key) > 0 OR strpos(q.prompt, g.s3_key) > 0
                                   OR strpos(q.explanation, g.s3_key) > 0))
                """, COMMUNITY_ACCOUNT_ID, userId, userId);
        List<String> imageKeys = jdbcTemplate.queryForList(
                "SELECT s3_key FROM gallery_images WHERE uploaded_by = ?", String.class, userId);

        jdbcTemplate.update("UPDATE ai_generation_jobs SET original_filename = NULL WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM device_telemetry WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM contact_messages WHERE lower(email) = ?", email);
        jdbcTemplate.update("DELETE FROM login_lockouts WHERE lower(username) = ?", email);
        jdbcTemplate.update("DELETE FROM confirmation_codes WHERE lower(email) = ?", email);
        jdbcTemplate.update("DELETE FROM confirmation_code_sends WHERE lower(email) = ?", email);

        userRepository.delete(user);
        userRepository.flush();

        afterCommit(() -> imageKeys.forEach(s3Service::deleteFile));
        log.info("Deleted account {}: {} areas and {} questions moved to the community account, {} images kept, {} deleted.",
                userId, sharedAreas, sharedQuestions, keptImages, imageKeys.size());
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
