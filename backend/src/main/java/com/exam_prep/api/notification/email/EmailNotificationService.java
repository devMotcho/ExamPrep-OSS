package com.exam_prep.api.notification.email;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.exam_prep.api.notification.NotificationChannel;
import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationService;
import com.exam_prep.api.notification.NotificationType;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Implementation of NotificationService for the SMTP Email channel.
 *
 * <p>Orchestrates three collaborators rather than doing everything itself:
 * {@link EmailRecipientResolver} decides who receives the email,
 * {@link EmailTemplateService} builds the HTML body for system notifications,
 * and {@link DynamicMailSenderFactory} resolves the SMTP sender + From address.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EmailNotificationService implements NotificationService {

    private final DynamicMailSenderFactory mailSenderFactory;
    private final EmailRecipientResolver recipientResolver;
    private final EmailTemplateService templateService;

    @Override
    public boolean send(NotificationPayload payload) {
        List<String> recipients = recipientResolver.resolve(payload);
        if (recipients.isEmpty()) {
            log.warn("No recipients resolved for notification type {}", payload.type());
            return false;
        }

        Optional<String> from = mailSenderFactory.resolveFromAddress();
        if (from.isEmpty()) {
            if (payload.type() == NotificationType.CUSTOM) {
                throw new EmailDeliveryException("Email sending is disabled: no valid From address is configured.");
            }
            return false;
        }

        String htmlContent = templateService.renderSystemNotification(payload);
        JavaMailSender mailSender = mailSenderFactory.getMailSender();
        String fromAddress = from.get();

        EmailDispatchResult result = dispatch(mailSender, fromAddress, recipients, payload.subject(), htmlContent);

        // CUSTOM notifications are explicitly requested by a caller expecting delivery,
        // so a total failure should surface as an exception rather than a silent false.
        if (payload.type() == NotificationType.CUSTOM && !result.hasAnySuccess()) {
            String reason = result.failures().values().stream()
                    .findFirst()
                    .orElse("unknown error");
            throw new EmailDeliveryException("Failed to send custom email to " + recipients.get(0) + ": " + reason);
        }

        return result.hasAnySuccess();
    }

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.EMAIL;
    }

    /**
     * Sends a study reminder directly to one opted-in user, with one-click unsubscribe headers (RFC 8058).
     * Returns false instead of throwing, so one bad address cannot stop a reminder batch.
     */
    public boolean sendReminder(String toEmail, String subject, Map<String, Object> variables, String unsubscribeUrl) {
        try {
            Optional<String> from = mailSenderFactory.resolveFromAddress();
            if (from.isEmpty()) {
                return false;
            }
            JavaMailSender mailSender = mailSenderFactory.getMailSender();
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(templateService.renderReminder(variables), true);
            helper.setFrom(from.get());
            message.setHeader("List-Unsubscribe", "<" + unsubscribeUrl + ">");
            message.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
            mailSender.send(message);
            return true;
        } catch (Exception e) {
            log.error("Failed to send reminder email: {}", e.getMessage());
            return false;
        }
    }

    private EmailDispatchResult dispatch(JavaMailSender mailSender, String fromAddress,
                                        List<String> recipients, String subject, String htmlContent) {
        Map<String, String> failures = new LinkedHashMap<>();
        int successCount = 0;

        for (String toEmail : recipients) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setTo(toEmail);
                helper.setSubject(subject);
                helper.setText(htmlContent, true);
                helper.setFrom(fromAddress);

                mailSender.send(message);
                successCount++;
                log.info("Dispatched an email notification");
            } catch (Exception e) {
                log.error("Failed to send an email notification: {}", e.getClass().getSimpleName());
                failures.put(toEmail, e.getMessage());
            }
        }

        return new EmailDispatchResult(recipients.size(), successCount, failures);
    }
}