package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.exam_prep.api.config.SiteConfigKey;
import com.exam_prep.api.repository.SiteConfigRepository;

/** Reminders run only when SMTP passed its startup check and unsubscribe links can reach this API. */
@Component
@RequiredArgsConstructor
public class ReminderAvailability {

    private final SiteConfigRepository siteConfigRepository;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.public-api-url:http://localhost:8080/api}")
    private String publicApiUrl;

    public boolean isAvailable() {
        return isEmailVerified() && hasReachableUnsubscribeUrl();
    }

    public boolean isEmailVerified() {
        return siteConfigRepository.findById(SiteConfigKey.EMAIL_ENABLED.key())
                .map(c -> "true".equalsIgnoreCase(c.getValue()))
                .orElse(false);
    }

    /** A deployed site must not send emails whose unsubscribe link points at localhost. */
    public boolean hasReachableUnsubscribeUrl() {
        return isLocal(frontendUrl) || !isLocal(publicApiUrl);
    }

    private boolean isLocal(String url) {
        return url.contains("localhost") || url.contains("127.0.0.1");
    }
}
