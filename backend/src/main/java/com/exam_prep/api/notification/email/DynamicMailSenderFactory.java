package com.exam_prep.api.notification.email;

import com.exam_prep.api.config.SiteConfigKey;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.NotificationProperties;
import com.exam_prep.api.repository.SiteConfigRepository;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import java.io.UnsupportedEncodingException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.stream.Collectors;

/**
 * Builds the {@link JavaMailSender} used for outbound email, honoring an optional
 * SMTP override stored in site config. Falls back to the application-configured
 * default sender when no override is present.
 *
 * <p>Results are cached under {@code smtpMailSender} since they require several
 * DB reads and object construction; call {@link #invalidateCache()} whenever the
 * underlying site config (smtp_host/port/username/password/sender name) changes.
 * Requires {@code @EnableCaching} on the application.</p>
 */
@Component
@Slf4j
@RequiredArgsConstructor
class DynamicMailSenderFactory {

    private static final String DEFAULT_SMTP_PORT = "587";

    private final JavaMailSender fallbackMailSender;
    private final NotificationProperties properties;
    private final SiteConfigRepository siteConfigRepository;

    @Cacheable("smtpMailSender")
    JavaMailSender getMailSender() {
        Map<String, String> config = loadSmtpConfig();
        String host = config.get(SiteConfigKey.SMTP_HOST.key());

        if (host == null || host.isBlank()) {
            return fallbackMailSender;
        }

        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(host);
        mailSender.setPort(parsePort(config.get(SiteConfigKey.SMTP_PORT.key())));
        String username = config.getOrDefault(SiteConfigKey.SMTP_USERNAME.key(), "");
        mailSender.setUsername(username);
        mailSender.setPassword(config.getOrDefault(SiteConfigKey.SMTP_PASSWORD.key(), ""));

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        // Relays without credentials (a local catcher, for instance) refuse an AUTH attempt.
        props.put("mail.smtp.auth", String.valueOf(!username.isBlank()));
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");

        return mailSender;
    }

    /** Call after any update to SMTP-related site config so the next send re-reads it. */
    @CacheEvict(value = "smtpMailSender", allEntries = true)
    void invalidateCache() {
        log.info("SMTP mail sender cache invalidated");
    }

    /**
     * The "Display Name &lt;address&gt;" From header: SMTP_FROM, else the SMTP username. Empty when neither is
     * an email address (usernames such as "apikey" are common), in which case nothing should be sent.
     */
    Optional<String> resolveFromAddress() {
        String configuredFrom = properties.getEmail().getFrom();
        String address = parseAddress(configuredFrom);
        if (address == null) {
            if (configuredFrom != null && !configuredFrom.isBlank()) {
                log.warn("SMTP_FROM is not a valid email address; trying the SMTP username instead.");
            }
            address = parseAddress(currentSmtpUsername());
        }
        if (address == null) {
            log.warn("Email sending is disabled: neither SMTP_FROM nor SMTP_USERNAME is a valid email address. Set SMTP_FROM.");
            return Optional.empty();
        }

        String senderName = resolveSenderName();
        try {
            return Optional.of(new InternetAddress(address, senderName, "UTF-8").toString());
        } catch (UnsupportedEncodingException e) {
            log.warn("Failed to encode the sender name, sending from the bare address: {}", e.getMessage());
            return Optional.of(address);
        }
    }

    private static String parseAddress(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            InternetAddress parsed = new InternetAddress(value.trim(), true);
            parsed.validate();
            return parsed.getAddress();
        } catch (AddressException e) {
            return null;
        }
    }

    private String resolveSenderName() {
        return siteConfigRepository.findById(SiteConfigKey.EMAIL_SENDER_NAME.key())
                .map(SiteConfigEntity::getValue)
                .filter(s -> !s.isBlank())
                .orElseGet(() -> properties.getEmail().getSenderName());
    }

    private String currentSmtpUsername() {
        JavaMailSender sender = getMailSender();
        if (sender instanceof JavaMailSenderImpl impl) {
            return impl.getUsername();
        }
        return null;
    }

    private Map<String, String> loadSmtpConfig() {
        List<String> keys = List.of(
                SiteConfigKey.SMTP_HOST.key(),
                SiteConfigKey.SMTP_PORT.key(),
                SiteConfigKey.SMTP_USERNAME.key(),
                SiteConfigKey.SMTP_PASSWORD.key()
        );

        return siteConfigRepository.findAllById(keys).stream()
                .collect(Collectors.toMap(SiteConfigEntity::getKey, SiteConfigEntity::getValue));
    }

    private int parsePort(String port) {
        String candidate = (port == null || port.isBlank()) ? DEFAULT_SMTP_PORT : port;
        try {
            return Integer.parseInt(candidate);
        } catch (NumberFormatException e) {
            log.warn("Invalid SMTP port '{}', falling back to default {}", port, DEFAULT_SMTP_PORT);
            return Integer.parseInt(DEFAULT_SMTP_PORT);
        }
    }
}