package com.exam_prep.api.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import com.exam_prep.api.repository.ContactMessageRepository;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Orchestrator service to dispatch notifications.
 * Dispatches notifications asynchronously to all enabled channels and isolates errors.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class NotificationDispatcher {

    private final List<NotificationService> notificationServices;
    private final NotificationProperties properties;
    private final SiteConfigRepository siteConfigRepository;
    private final ContactMessageRepository contactMessageRepository;

    /**
     * Dispatch notification payload to all enabled channels asynchronously.
     * Captures and handles channel-specific exceptions to avoid cascading failure.
     *
     * @param payload the notification payload
     */
    @Async("notificationExecutor")
    public void dispatch(NotificationPayload payload) {
        List<String> successfulChannels = new java.util.ArrayList<>();

        for (NotificationService service : notificationServices) {
            NotificationChannel channel = service.getChannel();

            if (!isChannelEnabled(channel, payload.type())) {
                log.debug("Channel {} is disabled for type {}, skipping.", channel, payload.type());
                continue;
            }

            try {
                boolean sent = service.send(payload);
                if (!sent) {
                    log.warn("Notification via channel: {} returned false (no recipients or delivery failed) at {}", channel, Instant.now());
                    continue;
                }
                successfulChannels.add(channel.name());

            } catch (Exception e) {
                log.error("Failed to send notification via channel: {} at {}. Error: {}", 
                        channel, Instant.now(), e.getMessage());
            }
        }

        // Update database with successful delivery methods
        if (payload.metadata() != null && payload.metadata().containsKey("contact_message_id")) {
            String contactMessageIdStr = payload.metadata().get("contact_message_id");
            try {
                UUID contactMessageId = UUID.fromString(contactMessageIdStr);
                contactMessageRepository.findById(contactMessageId).ifPresent(msg -> {
                    String channelsStr = String.join(", ", successfulChannels);
                    msg.setSentChannels(channelsStr);
                    contactMessageRepository.save(msg);
                });
            } catch (Exception e) {
                log.error("Failed to update sent channels for contact message ID {}: {}", contactMessageIdStr, e.getMessage(), e);
            }
        }
    }

    private boolean isChannelEnabled(NotificationChannel channel, NotificationType type) {
        if (type != null) {
            String specificKey = String.format("%s_%s_enabled", type.name().toLowerCase(), channel.name().toLowerCase());
            var specificOpt = siteConfigRepository.findById(specificKey);
            if (specificOpt.isPresent() && specificOpt.get().getValue() != null && !specificOpt.get().getValue().trim().isEmpty()) {
                return Boolean.parseBoolean(specificOpt.get().getValue());
            }
        }

        // Fallback to global database key
        String key = switch (channel) {
            case EMAIL -> "email_enabled";
        };

        var entityOpt = siteConfigRepository.findById(key);
        if (entityOpt.isPresent() && entityOpt.get().getValue() != null && !entityOpt.get().getValue().trim().isEmpty()) {
            return Boolean.parseBoolean(entityOpt.get().getValue());
        }

        // Fallback to static properties/env configurations
        return switch (channel) {
            case EMAIL -> properties.getEmail().isEnabled();
        };
    }
}
