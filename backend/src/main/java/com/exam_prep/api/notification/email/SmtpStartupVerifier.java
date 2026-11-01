package com.exam_prep.api.notification.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.config.SiteConfigKey;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.util.concurrent.CompletableFuture;

/**
 * Verifies that outbound email (SMTP) is working as soon as the application starts up.
 *
 * <p>Runs off the main startup thread via {@link Async}, so a slow or unreachable SMTP
 * server never delays application readiness. The result is persisted to site config
 * under {@link SiteConfigKey#EMAIL_ENABLED}, so the rest of the application can check
 * that flag to know whether email-dependent features are safe to use.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class SmtpStartupVerifier {

    private final SiteConfigRepository siteConfigRepository;
    private final EmailNotificationService emailNotificationService;
    private final DynamicMailSenderFactory mailSenderFactory;

    @Value("${spring.mail.host:}")
    private String fallbackSmtpHost;

    /**
     * Entry point triggered on startup. Delegates the actual work to an async
     * method and just observes the outcome — this listener itself returns
     * immediately regardless of how long SMTP verification takes.
     */
    @EventListener(ApplicationReadyEvent.class)
    void onApplicationReady() {
        verifySmtpAndNotify()
                .exceptionally(ex -> {
                    // Belt-and-braces: verifySmtpAndNotify() already catches internally,
                    // this only fires if something escapes that (e.g. thread pool rejection).
                    log.error("Unhandled exception during async SMTP verification: {}", ex.getMessage(), ex);
                    return null;
                });
    }

    /**
     * Sends a verification email and records whether SMTP is functional.
     *
     * @return a future that completes once verification (send attempt + flag update)
     *         has finished; the future itself never completes exceptionally, since
     *         all failure paths are handled internally and reflected in the flag.
     */
    @Async("notificationExecutor")
    CompletableFuture<Void> verifySmtpAndNotify() {
        if (!isSmtpConfigured()) {
            log.info("SMTP is not configured: email features stay off. Set SMTP_HOST to enable them.");
            setEmailEnabled(false);
            return CompletableFuture.completedFuture(null);
        }
        if (mailSenderFactory.resolveFromAddress().isEmpty()) {
            // The factory has logged why.
            setEmailEnabled(false);
            return CompletableFuture.completedFuture(null);
        }
        try {
            NotificationPayload verificationPayload = new NotificationPayload(
                    "Application Up and Running (Email Enabled)",
                    "The application is up and running, and the SMTP configuration has successfully connected and sent this verification alert.",
                    NotificationType.SYSTEM,
                    null
            );

            boolean sent = emailNotificationService.send(verificationPayload);
            if (sent) {
                log.info("Startup verification email successfully sent. Setting email_enabled to true.");
                setEmailEnabled(true);
            } else {
                log.warn("Failed to dispatch verification email. Setting email_enabled to false.");
                setEmailEnabled(false);
            }
        } catch (Exception e) {
            log.error("Exception during SMTP verification: {}. Setting email_enabled to false.", e.getMessage(), e);
            setEmailEnabled(false);
        }

        return CompletableFuture.completedFuture(null);
    }

    private boolean isSmtpConfigured() {
        boolean inSiteConfig = siteConfigRepository.findById(SiteConfigKey.SMTP_HOST.key())
                .map(SiteConfigEntity::getValue)
                .filter(host -> !host.isBlank())
                .isPresent();
        return inSiteConfig || !fallbackSmtpHost.isBlank();
    }

    /**
     * Persists the {@code email_enabled} site config flag, updating it if it
     * already exists or creating it with sensible defaults on first run.
     *
     * <p>Scoped to just the DB write — kept separate from the SMTP send so the
     * transaction doesn't stay open across a slow/blocking network call.
     */
    @Transactional
    void setEmailEnabled(boolean enabled) {
        siteConfigRepository.findById(SiteConfigKey.EMAIL_ENABLED.key()).ifPresentOrElse(config -> {
            config.setValue(String.valueOf(enabled));
            siteConfigRepository.save(config);
        }, () -> {
            SiteConfigEntity newConfig = SiteConfigEntity.builder()
                    .key(SiteConfigKey.EMAIL_ENABLED.key())
                    .value(String.valueOf(enabled))
                    .type("boolean")
                    .label("Email Enabled")
                    .group("notifications")
                    .defaultValue("false")
                    .build();
            siteConfigRepository.save(newConfig);
        });
    }
}