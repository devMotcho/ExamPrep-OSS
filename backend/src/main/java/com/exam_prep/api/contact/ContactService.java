package com.exam_prep.api.contact;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.entity.ContactMessageEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.NotificationDispatcher;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.repository.ContactMessageRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.security.ClientIpResolver;
import com.exam_prep.api.service.ConfirmationCodeService;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service to process contact submissions.
 * Handles IP-based rate limiting, input sanitization, and notification dispatching.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ContactService {

    private final NotificationDispatcher notificationDispatcher;
    private final SiteConfigRepository siteConfigRepository;
    private final ContactMessageRepository contactMessageRepository;
    private final ConfirmationCodeService confirmationCodeService;

    // Thread-safe in-memory sliding-window IP rate limiter
    private final Map<String, List<Instant>> rateLimitMap = new ConcurrentHashMap<>();

    /**
     * Process a contact form submission.
     * Performs rate limiting and sanitization, then dispatches the notification.
     *
     * @param request   the contact request details
     * @param ipAddress the client's IP address, used only for the in-memory rate limit and never stored
     */
    public void processContactSubmission(ContactRequest request, String ipAddress) {
        // 0. Check if contact form is enabled in configuration
        boolean isEnabled = siteConfigRepository.findById("contact_enabled")
            .map(entity -> "true".equalsIgnoreCase(entity.getValue()))
            .orElse(true);

        if (!isEnabled) {
            log.warn("Contact form submission blocked because contact_enabled is false");
            throw new AppException("The contact feature is currently disabled.", HttpStatus.FORBIDDEN);
        }

        // Check if confirmation code is enabled
        if (confirmationCodeService.isConfirmationCodeEnabled()) {
            confirmationCodeService.validateConfirmationCode(request.getEmail(), request.getCode(), CodePurpose.CONTACT);
        }

        // 1. IP-based rate limiting (max 3 requests per IP per hour)
        checkRateLimit(ipAddress);

        // 2. Input Sanitization to prevent XSS/log injection and restrict message length
        String cleanName = sanitize(request.getName(), 100).replaceAll("[\\r\\n]+", " ");
        String cleanEmail = sanitize(request.getEmail(), 100).replaceAll("[\\r\\n]+", "");
        String cleanSubject = sanitize(request.getSubject(), 150).replaceAll("[\\r\\n]+", " ");
        String cleanMessage = sanitize(request.getMessage(), 4000);

        
        // 3. Save to database first to generate UUID
        ContactMessageEntity messageEntity = ContactMessageEntity.builder()
            .name(cleanName)
            .email(cleanEmail)
            .subject(cleanSubject)
            .message(cleanMessage)
            .sentChannels("")
            .type("CONTACT")
            .build();
        messageEntity = contactMessageRepository.save(messageEntity);
        log.info("Saved contact message {}", messageEntity.getId());

        // 4. Construct payload (with message ID in metadata) and dispatch asynchronously
        String body = String.format("Name: %s\nEmail: %s\n\nMessage:\n%s", cleanName, cleanEmail, cleanMessage);
        
        NotificationPayload payload = new NotificationPayload(
            "New Contact Form: " + cleanSubject,
            body,
            NotificationType.CONTACT,
            Map.of(
                "name", cleanName,
                "email", cleanEmail,
                "contact_message_id", messageEntity.getId().toString()
            )
        );

        // Dispatches asynchronously to enabled channels (async error isolated)
        notificationDispatcher.dispatch(payload);
    }

    private void checkRateLimit(String ipAddress) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minus(1, ChronoUnit.HOURS);

        List<Instant> attempts = rateLimitMap.compute(ClientIpResolver.limitKey(ipAddress), (ip, timestamps) -> {
            if (timestamps == null) {
                return new ArrayList<>(List.of(now));
            }
            List<Instant> filtered = timestamps.stream()
                .filter(t -> t.isAfter(oneHourAgo))
                .collect(Collectors.toCollection(ArrayList::new));
            filtered.add(now);
            return filtered;
        });

        // Maximum 3 attempts in 1 hour. The 4th attempt will trigger the exception.
        if (attempts.size() > 3) {
            log.warn("Contact form rate limit exceeded");
            throw new AppException("Too many requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private String sanitize(String input, int maxLength) {
        if (input == null) {
            return "";
        }
        // Remove HTML tags to prevent message injection / XSS
        String sanitized = input.replaceAll("<[^>]*>", "");
        // Truncate length
        if (sanitized.length() > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        return sanitized.trim();
    }
}
