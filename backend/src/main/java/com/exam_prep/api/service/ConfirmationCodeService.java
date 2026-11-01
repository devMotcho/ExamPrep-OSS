package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.entity.ConfirmationCodeEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.ConfirmationCodeRepository;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConfirmationCodeService {

    private static final SecureRandom RANDOM = new SecureRandom();
    /** Wrong guesses a code survives. The next one, right or wrong, finds no code. */
    static final int MAX_ATTEMPTS = 5;
    private static final String INVALID = "Invalid or expired confirmation code.";

    private final ConfirmationCodeRepository confirmationCodeRepository;
    private final SiteConfigRepository siteConfigRepository;
    private final EmailNotificationService emailNotificationService;
    private final JdbcTemplate jdbcTemplate;

    /** Codes one address can receive per hour, whoever asks. 0 turns the limit off. */
    @Value("${app.confirmation.max-sends-per-hour:5}")
    private int maxSendsPerHour = 5;

    @Transactional
    public void sendConfirmationCode(String rawEmail, CodePurpose purpose) {
        String email = normalize(rawEmail);
        // Silent: the caller's answer must not depend on what has happened to this address.
        if (maxSendsPerHour > 0 && !claimSendSlot(email)) {
            log.warn("Hourly limit of verification codes reached for an address (purpose={})", purpose);
            return;
        }

        // Generate a 6-digit random verification code
        String code = String.format("%06d", RANDOM.nextInt(1000000));

        // Only the newest code is valid, so asking for many does not improve the odds of guessing one.
        confirmationCodeRepository.deleteByEmailAndPurpose(email, purpose);

        ConfirmationCodeEntity entity = ConfirmationCodeEntity.builder()
                .email(email)
                .code(code)
                .purpose(purpose)
                .expiresAt(ZonedDateTime.now().plusMinutes(10))
                .build();

        confirmationCodeRepository.save(entity);

        // Build HTML template email content
        String htmlContent = String.format(
                "<div style='font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);'>" +
                "<h2 style='color: #111827; font-size: 20px; font-weight: 800; margin-bottom: 8px; text-align: center;'>Email Verification Code</h2>" +
                "<p style='color: #4b5563; font-size: 14px; margin-bottom: 24px; text-align: center;'>Please use the following code to complete your request. This code is valid for 10 minutes.</p>" +
                "<div style='text-align: center; margin-bottom: 24px;'>" +
                "<span style='display: inline-block; font-family: monospace; font-size: 28px; font-weight: 800; color: #3b82f6; letter-spacing: 4px; background-color: #eff6ff; padding: 12px 24px; border-radius: 8px; border: 1px solid #bfdbfe;'>%s</span>" +
                "</div>" +
                "<p style='color: #9ca3af; font-size: 11px; text-align: center; border-t: 1px solid #f3f4f6; pt: 16px; margin: 0;'>If you did not request this verification, please safely ignore this email.</p>" +
                "</div>",
                code
        );

        try {
            emailNotificationService.send(new NotificationPayload(
                    "Your Verification Code",
                    htmlContent,
                    NotificationType.CUSTOM,
                    Map.of("recipient", email)
            ));
        } catch (Exception e) {
            // The code itself must never reach the logs: it can reset a password.
            log.warn("Could not send a verification code: {}", e.getMessage());
        }
    }

    public boolean isConfirmationCodeEnabled() {
        return siteConfigRepository.findById("confirmation_code_enabled")
                .map(entity -> "true".equalsIgnoreCase(entity.getValue()))
                .orElse(false);
    }

    /**
     * A code works once and for one purpose, and is gone after {@link #MAX_ATTEMPTS} wrong guesses. Does not roll
     * back on the exception it throws, or the wrong guess would not be counted. Call it outside a transaction.
     */
    @Transactional(noRollbackFor = AppException.class)
    public void validateConfirmationCode(String rawEmail, String code, CodePurpose purpose) {
        if (code == null || code.trim().isEmpty()) {
            throw new AppException("Confirmation code is required.", HttpStatus.BAD_REQUEST);
        }
        String email = normalize(rawEmail);

        if (confirmationCodeRepository.claimAttempt(email, purpose, MAX_ATTEMPTS, ZonedDateTime.now()) == 0) {
            throw new AppException(INVALID, HttpStatus.BAD_REQUEST);
        }
        ConfirmationCodeEntity entity = confirmationCodeRepository
                .findFirstByEmailAndPurposeOrderByCreatedAtDesc(email, purpose)
                .orElseThrow(() -> new AppException(INVALID, HttpStatus.BAD_REQUEST));

        boolean matches = MessageDigest.isEqual(
                entity.getCode().getBytes(StandardCharsets.UTF_8), code.trim().getBytes(StandardCharsets.UTF_8));
        if (matches) {
            // The delete decides between simultaneous correct guesses: only one removes the row.
            if (confirmationCodeRepository.deleteByEmailAndPurpose(email, purpose) == 0) {
                throw new AppException(INVALID, HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if (entity.getAttempts() >= MAX_ATTEMPTS) {
            confirmationCodeRepository.deleteByEmailAndPurpose(email, purpose);
        }
        throw new AppException(INVALID, HttpStatus.BAD_REQUEST);
    }

    /** One atomic statement, so simultaneous requests cannot pass the limit together. */
    private boolean claimSendSlot(String email) {
        return jdbcTemplate.update("""
                INSERT INTO confirmation_code_sends (email, window_start, send_count) VALUES (?, date_trunc('hour', now()), 1)
                ON CONFLICT (email, window_start) DO UPDATE SET send_count = confirmation_code_sends.send_count + 1
                WHERE confirmation_code_sends.send_count < ?
                """, email, maxSendsPerHour) > 0;
    }

    @Scheduled(cron = "0 15 * * * *", zone = "UTC")
    @Transactional
    public void deleteOldRows() {
        confirmationCodeRepository.deleteExpired(ZonedDateTime.now());
        jdbcTemplate.update("DELETE FROM confirmation_code_sends WHERE window_start < now() - interval '2 hours'");
    }

    /** Differently written forms of one address share its code and its limit. */
    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
