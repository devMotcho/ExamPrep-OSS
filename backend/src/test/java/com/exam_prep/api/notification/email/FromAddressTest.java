package com.exam_prep.api.notification.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.notification.NotificationPayload;
import com.exam_prep.api.notification.NotificationProperties;
import com.exam_prep.api.notification.NotificationType;
import com.exam_prep.api.repository.SiteConfigRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class FromAddressTest {

    private Optional<String> resolve(String from, String username) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setUsername(username);
        NotificationProperties properties = new NotificationProperties();
        properties.getEmail().setSenderName("ExamPrep");
        properties.getEmail().setFrom(from);
        SiteConfigRepository repo = mock(SiteConfigRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        when(repo.findAllById(any())).thenReturn(List.of());
        return new DynamicMailSenderFactory(sender, properties, repo, new com.exam_prep.api.config.ServiceSettings(
                new org.springframework.mock.env.MockEnvironment(), repo,
                new com.exam_prep.api.aigen.AiSecretCipher(new org.springframework.mock.env.MockEnvironment()))).resolveFromAddress();
    }

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {
            "noreply@exam.example, user@smtp.example, noreply@exam.example",
            "null, user@smtp.example, user@smtp.example",
            "'', user@smtp.example, user@smtp.example",
            "not an address, user@smtp.example, user@smtp.example",
            "noreply@exam.example, apikey, noreply@exam.example"})
    void usesTheFirstValidAddress(String from, String username, String expected) {
        assertEquals("ExamPrep <" + expected + ">", resolve(from, username).orElseThrow());
    }

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {"null, null", "null, apikey", "ExamPrep, apikey", "'', ''"})
    void noValidAddressMeansNoFrom(String from, String username) {
        assertTrue(resolve(from, username).isEmpty());
    }

    private final DynamicMailSenderFactory factory = mock(DynamicMailSenderFactory.class);
    private final EmailRecipientResolver recipients = mock(EmailRecipientResolver.class);
    private final EmailNotificationService service =
            new EmailNotificationService(factory, recipients, mock(EmailTemplateService.class));

    @Test
    void nothingIsSentWithoutAFromAddress() {
        JavaMailSender sender = mock(JavaMailSender.class);
        when(factory.getMailSender()).thenReturn(sender);
        when(factory.resolveFromAddress()).thenReturn(Optional.empty());
        when(recipients.resolve(any())).thenReturn(List.of("to@example.com"));

        assertFalse(service.send(new NotificationPayload("s", "b", NotificationType.SYSTEM, null)));
        assertThrows(EmailDeliveryException.class,
                () -> service.send(new NotificationPayload("s", "b", NotificationType.CUSTOM, Map.of("recipient", "to@example.com"))));
        assertFalse(service.sendReminder("to@example.com", "s", Map.of(), "https://api.example/u"));
        verify(sender, never()).createMimeMessage();
    }
}
