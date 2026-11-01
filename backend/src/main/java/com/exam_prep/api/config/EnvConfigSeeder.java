package com.exam_prep.api.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.repository.SiteConfigRepository;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class EnvConfigSeeder implements CommandLineRunner {

    private final SiteConfigRepository siteConfigRepository;
    private final Environment env;
    private final ServiceSettings serviceSettings;

    /** Shown in the settings page, so they are copied. Secrets never are: see {@link ServiceSettings}. */
    private static final Map<String, String> VISIBLE_SETTINGS = Map.ofEntries(
            Map.entry("AWS_S3_REGION", "s3_region"),
            Map.entry("AWS_S3_BUCKET", "s3_bucket"),
            Map.entry("AWS_S3_ENDPOINT", "s3_endpoint"),
            Map.entry("OAUTH_GOOGLE_ENABLED", "oauth_google_enabled"),
            Map.entry("OAUTH_MICROSOFT_ENABLED", "oauth_microsoft_enabled"),
            Map.entry("SMTP_HOST", "smtp_host"),
            Map.entry("SMTP_PORT", "smtp_port"),
            Map.entry("SMTP_USERNAME", "smtp_username"),
            Map.entry("EMAIL_SENDER_NAME", "email_sender_name"));

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Synchronizing environment variables with site_config...");

        VISIBLE_SETTINGS.forEach((property, configKey) -> {
            String envValue = env.getProperty(property);
            if (envValue != null && !envValue.trim().isEmpty()) {
                siteConfigRepository.findById(configKey).ifPresent(config -> {
                    if (!envValue.equals(config.getValue())) {
                        log.info("Populating {} from environment variable (property: {}).", configKey, property);
                        config.setValue(envValue);
                        siteConfigRepository.save(config);
                    }
                });
            }
        });

        ServiceSettings.SECRET_KEYS.forEach(configKey -> siteConfigRepository.findById(configKey).ifPresent(config -> {
            String stored = config.getValue();
            if (stored == null || stored.isEmpty()) {
                return;
            }
            String prepared = serviceSettings.isEnvManaged(configKey) ? "" : serviceSettings.prepareForStorage(configKey, stored);
            if (!prepared.equals(stored)) {
                log.info("{} is {} in the database.", configKey, prepared.isEmpty() ? "set in the environment, so it was cleared" : "now encrypted");
                config.setValue(prepared);
                siteConfigRepository.save(config);
            }
        }));
    }
}
