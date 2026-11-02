package com.exam_prep.api.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Accounts nobody has used for two years are deleted. A month before, the owner gets an email; using the account
 * again cancels it. Staff and the community account are never touched. Without working email no warning goes out,
 * so nothing is deleted. Set DELETE_INACTIVE_ACCOUNTS=false to turn this off.
 *
 * Activity is the latest of sign-up, sign-in, session refresh and exam start, because a session that keeps
 * refreshing never signs in again.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InactiveAccountJob {

    static final int WARN_AFTER_MONTHS = 23;
    static final int DELETE_AFTER_MONTHS = 24;
    /** The warning must be at least this old, so a missed run never deletes without notice. */
    static final int NOTICE_DAYS = 30;

    static final String CANDIDATES = """
            WITH activity AS (
                SELECT u.id, u.email, u.inactivity_warned_at,
                       GREATEST(u.created_at, u.last_login_at,
                                (SELECT max(r.created_at) FROM refresh_tokens r WHERE r.user_id = u.id),
                                (SELECT max(e.started_at) FROM exam_sessions e WHERE e.user_id = u.id)) AS last_active
                FROM users u
                WHERE u.role = 'ROLE_USER'
            )
            SELECT id, email FROM activity
            """;
    static final String TO_WARN = CANDIDATES + """
            WHERE last_active < now() - make_interval(months => ?)
              AND (inactivity_warned_at IS NULL OR inactivity_warned_at < last_active)
            """;
    static final String TO_DELETE = CANDIDATES + """
            WHERE last_active < now() - make_interval(months => ?)
              AND inactivity_warned_at > last_active
              AND inactivity_warned_at < now() - make_interval(days => ?)
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AccountDeletionService accountDeletionService;
    private final EmailNotificationService emailNotificationService;
    private final SiteConfigRepository siteConfigRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.retention.delete-inactive-accounts:true}")
    private boolean enabled;

    @Scheduled(cron = "0 0 5 * * *", zone = "UTC")
    public void run() {
        if (!enabled) {
            return;
        }
        int warned = 0;
        for (Map<String, Object> row : jdbcTemplate.queryForList(TO_WARN, WARN_AFTER_MONTHS)) {
            if (warn((String) row.get("email"))) {
                jdbcTemplate.update("UPDATE users SET inactivity_warned_at = now() WHERE id = ?", row.get("id"));
                warned++;
            }
        }

        List<UUID> expired = jdbcTemplate.queryForList(TO_DELETE, DELETE_AFTER_MONTHS, NOTICE_DAYS).stream()
                .map(row -> (UUID) row.get("id")).toList();
        int deleted = 0;
        for (UUID id : expired) {
            try {
                accountDeletionService.delete(id);
                deleted++;
            } catch (RuntimeException e) {
                log.error("Could not delete inactive account {}", id, e);
            }
        }
        log.info("Inactive accounts: warned {}, deleted {}", warned, deleted);
    }

    /** True only if the email went out; an account is never deleted without a warning that was sent. */
    private boolean warn(String email) {
        String site = siteName();
        String base = frontendUrl.replaceAll("/+$", "");
        String body = """
                You have not used your %1$s account for almost two years. So that data nobody needs is not kept, it \
                will be deleted in 30 days, with your private study areas and your history. To keep it, sign in \
                before then: %2$s/en/login

                Não usas a tua conta no %1$s há quase dois anos. Para não guardarmos dados de que já não precisas, \
                ela será apagada dentro de 30 dias, com as tuas áreas de estudo privadas e o teu histórico. Se a \
                quiseres manter, inicia sessão antes disso: %2$s/pt/login
                """.formatted(site, base);
        try {
            return emailNotificationService.send(new NotificationPayload(
                    "Your " + site + " account will be deleted / A tua conta vai ser apagada", body,
                    NotificationType.CUSTOM, Map.of("recipient", email)));
        } catch (RuntimeException e) {
            log.warn("Could not send an inactivity warning: {}", e.getMessage());
            return false;
        }
    }

    private String siteName() {
        return siteConfigRepository.findById("company_name")
                .map(SiteConfigEntity::getValue)
                .filter(name -> !name.isBlank())
                .orElse("ExamPrep");
    }
}
