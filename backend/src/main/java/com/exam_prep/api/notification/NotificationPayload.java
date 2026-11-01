package com.exam_prep.api.notification;

import java.util.Map;

/**
 * Immutable record representing the notification payload to be dispatched.
 */
public record NotificationPayload(
    String subject,
    String body,
    NotificationType type,
    Map<String, String> metadata
) {}
