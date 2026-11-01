package com.exam_prep.api.notification;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Type-safe configuration properties for the notification system.
 * Binds properties prefixed with 'notification' in application.yml.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "notification")
public class NotificationProperties {
    private Email email = new Email();

    @Data
    public static class Email {
        private Boolean enabled = false;
        private String senderName;
        /** SMTP_FROM: the From address. Falls back to the SMTP username when that is an address. */
        private String from;

        public boolean isEnabled() {
            return Boolean.TRUE.equals(this.enabled);
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = (enabled != null && enabled);
        }
    }
}
