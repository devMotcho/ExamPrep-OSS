package com.exam_prep.api.notification.email;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import com.exam_prep.api.notification.NotificationPayload;

import java.util.Map;

/**
 * Renders HTML email bodies for system-generated notifications via Thymeleaf.
 * CUSTOM notifications bypass this entirely and use payload.body() as-is.
 */
@Component
@RequiredArgsConstructor
class EmailTemplateService {

    private static final String SYSTEM_NOTIFICATION_TEMPLATE = "notification-email";
    private static final String REMINDER_TEMPLATE = "reminder-email";

    private final SpringTemplateEngine templateEngine;

    String renderSystemNotification(NotificationPayload payload) {
        Context context = new Context();
        context.setVariable("subject", payload.subject());
        context.setVariable("type", payload.type().name());
        context.setVariable("body", payload.body());
        context.setVariable("metadata", payload.metadata());

        return templateEngine.process(SYSTEM_NOTIFICATION_TEMPLATE, context);
    }

    String renderReminder(Map<String, Object> variables) {
        Context context = new Context();
        context.setVariables(variables);
        return templateEngine.process(REMINDER_TEMPLATE, context);
    }
}
