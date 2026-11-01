package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.ContentLimits;
import com.exam_prep.api.entity.ContactMessageEntity;
import com.exam_prep.api.entity.ContactMessageStatusEntity;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.ContactMessageRepository;
import com.exam_prep.api.repository.ContactMessageStatusRepository;
import com.exam_prep.api.repository.SiteConfigRepository;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/contact-messages")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_DEV')")
@Slf4j
public class AdminContactController {

    private final ContactMessageRepository contactMessageRepository;
    private final EmailNotificationService emailNotificationService;
    private final ContactMessageStatusRepository contactMessageStatusRepository;
    private final SiteConfigRepository siteConfigRepository;

    @GetMapping
    public ResponseEntity<List<ContactMessageEntity>> getAllMessages() {
        log.info("Fetching all contact messages for admin/dev interface");
        return ResponseEntity.ok(contactMessageRepository.findAllByOrderByCreatedAtDesc());
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<?> updateReadStatus(
            @PathVariable UUID id,
            @RequestParam boolean read) {
        log.info("Updating read status of message {} to {}", id, read);
        ContactMessageEntity message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contact message not found."));
        message.setRead(read);
        return ResponseEntity.ok(contactMessageRepository.save(message));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMessage(@PathVariable UUID id) {
        log.info("Deleting contact message {}", id);
        if (!contactMessageRepository.existsById(id)) {
            throw new IllegalArgumentException("Contact message not found.");
        }
        contactMessageRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Contact message deleted successfully."));
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<?> replyToMessage(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request) {
        String replyText = request.get("message");
        if (replyText == null || replyText.trim().isEmpty()) {
            throw new IllegalArgumentException("Reply message content cannot be empty.");
        }
        if (replyText.length() > ContentLimits.REPLY) {
            throw new IllegalArgumentException("Reply message is too long.");
        }

        log.info("Sending custom email reply to contact message {}", id);
        ContactMessageEntity message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contact message not found."));

        // Verify notification type is CONTACT
        if (!"CONTACT".equalsIgnoreCase(message.getType())) {
            throw new IllegalArgumentException("Only contact inquiries can be replied to via email.");
        }

        // Verify no reply has already been sent
        if (message.getReplyMessage() != null && !message.getReplyMessage().trim().isEmpty()) {
            throw new IllegalStateException("A reply has already been sent for this inquiry. You cannot send multiple replies.");
        }

        // Verify SMTP email configuration is active
        boolean emailEnabled = siteConfigRepository.findById("email_enabled")
                .map(SiteConfigEntity::getValue)
                .map("true"::equalsIgnoreCase)
                .orElse(false);
        if (!emailEnabled) {
            throw new IllegalStateException("SMTP email configuration is currently disabled.");
        }

        // Build a gorgeous HTML email wrapper around the admin reply
        String htmlContent = "<!DOCTYPE html><html><head><style>"
                + "body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6; margin: 0; padding: 20px; background-color: #f8fafc; }"
                + ".container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }"
                + ".header { border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }"
                + ".logo { font-size: 20px; font-weight: 800; color: #0f172a; }"
                + ".message-body { font-size: 15px; color: #334155; white-space: pre-wrap; margin-bottom: 32px; }"
                + ".quote-box { background-color: #f1f5f9; border-radius: 8px; padding: 16px; border-left: 4px solid #94a3b8; font-size: 13px; color: #475569; margin-top: 24px; }"
                + ".quote-title { font-weight: 700; margin-bottom: 6px; color: #334155; text-transform: uppercase; font-size: 10px; tracking: 0.05em; }"
                + ".footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }"
                + "</style></head><body>"
                + "<div class='container'>"
                + "<div class='header'><div class='logo'>ExamPrep Platform Support</div></div>"
                + "<div class='message-body'>" + replyText.replace("\n", "<br/>") + "</div>"
                + "<div class='quote-box'>"
                + "<div class='quote-title'>Your original inquiry:</div>"
                + "<strong>Subject:</strong> " + message.getSubject() + "<br/>"
                + "<strong>Message:</strong> " + message.getMessage()
                + "</div>"
                + "<div class='footer'>This is a reply to your support inquiry submitted to ExamPrep Platform.</div>"
                + "</div></body></html>";

        // Send email reply using the dynamic SMTP mail sender
        emailNotificationService.send(new NotificationPayload(
                "RE: " + message.getSubject(),
                htmlContent,
                NotificationType.CUSTOM,
                Map.of("recipient", message.getEmail())
        ));

        // Auto mark as read and store reply text on reply
        message.setReplyMessage(replyText);
        message.setRead(true);
        contactMessageRepository.save(message);

        return ResponseEntity.ok(Map.of("message", "Reply email sent and message marked as read successfully."));
    }

    @GetMapping("/statuses")
    public ResponseEntity<List<ContactMessageStatusEntity>> getAllStatuses() {
        log.info("Fetching all contact message statuses");
        return ResponseEntity.ok(contactMessageStatusRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping("/statuses")
    public ResponseEntity<ContactMessageStatusEntity> createStatus(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String color = request.get("color");
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Status name cannot be empty.");
        }
        if (color == null || color.trim().isEmpty()) {
            throw new IllegalArgumentException("Status color cannot be empty.");
        }
        if (name.trim().length() > 50 || color.trim().length() > 20) {
            throw new IllegalArgumentException("Status name or color is too long.");
        }
        
        log.info("Creating new status '{}' with color '{}'", name, color);
        ContactMessageStatusEntity status = ContactMessageStatusEntity.builder()
                .name(name.trim())
                .color(color.trim())
                .createdAt(ZonedDateTime.now())
                .build();
        return ResponseEntity.ok(contactMessageStatusRepository.save(status));
    }

    @DeleteMapping("/statuses/{id}")
    public ResponseEntity<?> deleteStatus(@PathVariable UUID id) {
        log.info("Deleting status {}", id);
        if (!contactMessageStatusRepository.existsById(id)) {
            throw new IllegalArgumentException("Status not found.");
        }
        contactMessageStatusRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Status deleted successfully."));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateMessageStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request) {
        log.info("Updating status for message {}", id);
        ContactMessageEntity message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contact message not found."));
        
        String statusIdStr = request.get("statusId");
        if (statusIdStr == null || statusIdStr.trim().isEmpty()) {
            message.setStatus(null);
        } else {
            UUID statusId = UUID.fromString(statusIdStr);
            ContactMessageStatusEntity status = contactMessageStatusRepository.findById(statusId)
                    .orElseThrow(() -> new IllegalArgumentException("Status not found."));
            message.setStatus(status);
        }
        
        return ResponseEntity.ok(contactMessageRepository.save(message));
    }
}
