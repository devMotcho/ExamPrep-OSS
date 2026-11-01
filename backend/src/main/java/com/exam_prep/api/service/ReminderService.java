package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Sends study reminders to users who opted in. Weekly reminders go out on Mondays. */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderService {

    private final JdbcTemplate jdbcTemplate;
    private final ReminderAvailability availability;
    private final EmailNotificationService emailNotificationService;
    private final RetentionService retentionService;
    private final SiteConfigRepository siteConfigRepository;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.public-api-url:http://localhost:8080/api}")
    private String publicApiUrl;

    private record Recipient(UUID userId, String email, String name, int dailyGoal, UUID token, String locale) {}

    /** Off the shared scheduler thread, so a slow SMTP server cannot delay other scheduled jobs. */
    @Async("notificationExecutor")
    @Scheduled(cron = "0 0 18 * * *", zone = "${APP_TIMEZONE:UTC}")
    public void scheduledRun() {
        RetentionDtos.ReminderRunResult result = run();
        log.info("Reminder job finished: status={} sent={} failed={}", result.status(), result.sent(), result.failed());
    }

    public RetentionDtos.ReminderRunResult run() {
        if (!availability.isEmailVerified()) {
            return new RetentionDtos.ReminderRunResult("disabled_smtp_not_configured", 0, 0);
        }
        if (!availability.hasReachableUnsubscribeUrl()) {
            log.warn("Reminders disabled: set PUBLIC_API_URL so unsubscribe links work");
            return new RetentionDtos.ReminderRunResult("disabled_public_api_url_not_configured", 0, 0);
        }

        LocalDate today = LocalDate.now(RetentionService.ZONE);
        List<String> frequencies = today.getDayOfWeek() == DayOfWeek.MONDAY ? List.of("DAILY", "WEEKLY") : List.of("DAILY");
        String placeholders = String.join(", ", frequencies.stream().map(f -> "?").toList());

        List<Object> args = new ArrayList<>(frequencies);
        args.add(today);
        List<Recipient> recipients = jdbcTemplate.query("""
                SELECT s.user_id, u.email, u.name, s.daily_goal_questions, s.unsubscribe_token, s.locale
                FROM user_retention_settings s
                JOIN users u ON u.id = s.user_id
                WHERE s.reminder_frequency IN (%s)
                  AND u.is_active AND u.is_confirmed
                  AND (s.last_reminder_sent_on IS NULL OR s.last_reminder_sent_on < ?)
                """.formatted(placeholders), (rs, n) -> new Recipient(
                rs.getObject("user_id", UUID.class), rs.getString("email"), rs.getString("name"),
                rs.getInt("daily_goal_questions"), rs.getObject("unsubscribe_token", UUID.class), rs.getString("locale")), args.toArray());

        int sent = 0;
        int failed = 0;
        for (Recipient recipient : recipients) {
            if (retentionService.answeredOn(recipient.userId(), today) >= recipient.dailyGoal()) {
                continue; // Already studied enough today.
            }
            // Claim first: if several instances run, or a send fails, nobody gets the same reminder twice.
            int claimed = jdbcTemplate.update("""
                    UPDATE user_retention_settings SET last_reminder_sent_on = ?
                    WHERE user_id = ? AND (last_reminder_sent_on IS NULL OR last_reminder_sent_on < ?)
                    """, today, recipient.userId(), today);
            if (claimed == 0) continue;

            if (sendTo(recipient, today)) sent++; else failed++;
        }
        return new RetentionDtos.ReminderRunResult("ok", sent, failed);
    }

    private boolean sendTo(Recipient recipient, LocalDate today) {
        List<Map<String, Object>> nextExam = jdbcTemplate.queryForList("""
                SELECT a.title, d.exam_date FROM user_exam_dates d
                JOIN study_areas a ON a.id = d.study_area_id
                WHERE d.user_id = ? AND d.exam_date >= ?
                ORDER BY d.exam_date LIMIT 1
                """, recipient.userId(), today);

        ReminderCopy copy = ReminderCopy.of(recipient.locale());
        List<String> lines = new ArrayList<>();
        String subject = copy.defaultSubject();
        if (!nextExam.isEmpty()) {
            LocalDate date = ((java.sql.Date) nextExam.get(0).get("exam_date")).toLocalDate();
            long days = java.time.temporal.ChronoUnit.DAYS.between(today, date);
            subject = copy.examSubject(String.valueOf(nextExam.get(0).get("title")), days);
            lines.add(subject + ".");
        }
        lines.add(copy.goalLine(recipient.dailyGoal()));

        String unsubscribeUrl = publicApiUrl.replaceAll("/+$", "") + "/auth/reminders/unsubscribe?token=" + recipient.token()
                + "&lang=" + copy.locale();
        Map<String, Object> variables = Map.of(
                "lang", copy.locale(),
                "subject", subject,
                "greeting", copy.greeting(recipient.name()),
                "lines", lines,
                "ctaUrl", copy.dashboardUrl(frontendUrl),
                "ctaLabel", copy.ctaLabel(),
                "footerText", copy.footerText(siteName()),
                "unsubscribeUrl", unsubscribeUrl,
                "unsubscribeLabel", copy.unsubscribeLabel());

        return emailNotificationService.sendReminder(recipient.email(), subject, variables, unsubscribeUrl);
    }

    private String siteName() {
        return siteConfigRepository.findById("company_name")
                .map(SiteConfigEntity::getValue)
                .filter(name -> !name.isBlank())
                .orElse("ExamPrep");
    }

    /** Idempotent. Unknown tokens are ignored, so the response reveals nothing about which tokens exist. */
    public void unsubscribe(UUID token) {
        jdbcTemplate.update(
                "UPDATE user_retention_settings SET reminder_frequency = 'OFF', reminder_consent_at = NULL, updated_at = now() WHERE unsubscribe_token = ?",
                token);
    }
}
