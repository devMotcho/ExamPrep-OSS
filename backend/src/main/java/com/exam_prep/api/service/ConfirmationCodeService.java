package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.entity.ConfirmationCodeEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.ConfirmationCodeRepository;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.security.SecureRandom;
import java.time.ZonedDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConfirmationCodeService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ConfirmationCodeRepository confirmationCodeRepository;
    private final SiteConfigRepository siteConfigRepository;
    private final EmailNotificationService emailNotificationService;

    @Transactional
    public void sendConfirmationCode(String email) {
        // Generate a 6-digit random verification code
        String code = String.format("%06d", RANDOM.nextInt(1000000));

        // Only the newest code is valid, so asking for many does not improve the odds of guessing one.
        confirmationCodeRepository.deleteByEmail(email);

        ConfirmationCodeEntity entity = ConfirmationCodeEntity.builder()
                .email(email)
                .code(code)
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

    /** A code works once: a successful check uses it up. */
    @Transactional
    public void validateConfirmationCode(String email, String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new AppException("Confirmation code is required.", HttpStatus.BAD_REQUEST);
        }

        ConfirmationCodeEntity entity = confirmationCodeRepository
                .findTopByEmailAndCodeOrderByCreatedAtDesc(email, code)
                .orElseThrow(() -> new AppException("Invalid confirmation code.", HttpStatus.BAD_REQUEST));

        if (entity.getExpiresAt().isBefore(ZonedDateTime.now())) {
            throw new AppException("Confirmation code has expired. Please request a new one.", HttpStatus.BAD_REQUEST);
        }

        confirmationCodeRepository.deleteByEmail(email);
    }
}
