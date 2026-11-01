package com.exam_prep.api.notification.email;

import java.util.List;

import org.springframework.stereotype.Component;

import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import com.exam_prep.api.user.UserRoleKey;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Resolves the list of recipient email addresses for a given notification payload.
 * CUSTOM notifications target an explicit recipient from metadata; 
 * CONTACT notifications are sent to admins;
 * SYSTEM and ERROR notifications to devs;
 * all other notification types fan out to admin/dev users.
 */
@Component
@Slf4j
@RequiredArgsConstructor
class EmailRecipientResolver {
    
    private static final List<String> ADMIN_DEV_ROLES = List.of(UserRoleKey.ADMIN.key(), UserRoleKey.DEV.key());
    private static final String RECIPIENT_METADATA_STRING = "recipient";
    private final UserRepository userRepository;

    List<String> resolve(NotificationPayload payload) {
        switch (payload.type()) {
            case CUSTOM:
                return resolveCustomRecipient(payload);
            case CONTACT:
                return resolveAdminRecipients(payload);
            case SYSTEM:
                return resolveDevsRecipients(payload);
            case ERROR:
                return resolveDevsRecipients(payload);
            default:
                return resolveAdminDevsRecipients(payload);
        }
    }

    
    private List<String> resolveCustomRecipient(NotificationPayload payload) {
        if (payload.metadata() == null) {
            log.warn("No metadata found for custom email notification");
            return List.of();
        }
        String recipient = payload.metadata().get(RECIPIENT_METADATA_STRING);
        
        if (recipient == null || recipient.isBlank()) {
            log.warn("Custom email notification must include target recipient in metadata 'recipient'");
            return List.of();
        }
        
        return List.of(recipient.trim());
    }
    
    private List<String> resolveAdminDevsRecipients(NotificationPayload payload) {
        List<String> recipients = userRepository.findByRoleIn(ADMIN_DEV_ROLES)
            .stream()
            .map(UserEntity::getEmail)
            .filter(email -> email != null && !email.isBlank())
            .map(String::trim)
            .toList();
        
        if (recipients.isEmpty()) {
            log.warn("No admin or devs found to receive email notification");
        }
        return recipients;
    }

    private List<String> resolveAdminRecipients(NotificationPayload payload) {
        List<String> recipients = userRepository.findByRole(UserRoleKey.ADMIN.key())
            .stream()
            .map(UserEntity::getEmail)
            .filter(email -> email != null && !email.isBlank())
            .map(String::trim)
            .toList();
        
        if (recipients.isEmpty()) {
            log.warn("No admin found to receive email notification");
        }
        return recipients;
    }

    private List<String> resolveDevsRecipients(NotificationPayload payload) {
        List<String> recipients = userRepository.findByRole(UserRoleKey.DEV.key())
            .stream()
            .map(UserEntity::getEmail)
            .filter(email -> email != null && !email.isBlank())
            .map(String::trim)
            .toList();
        
        if (recipients.isEmpty()) {
            log.warn("No dev found to receive email notification");
        }
        return recipients;
    }
}
