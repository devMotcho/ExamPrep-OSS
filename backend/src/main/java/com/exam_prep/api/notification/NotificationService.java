package com.exam_prep.api.notification;

/**
 * Unified interface that must be implemented by each notification channel
 * (e.g. Email).
 */
public interface NotificationService {
    /**
     * Dispatch the given payload over this specific notification channel.
     *
     * @param payload the notification data containing subject, body, etc.
     * @return true if the notification was successfully sent, false otherwise.
     */
    boolean send(NotificationPayload payload);

    /**
     * Get the notification channel type of this service implementation.
     *
     * @return the NotificationChannel enum value
     */
    NotificationChannel getChannel();
}
