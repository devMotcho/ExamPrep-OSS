package com.exam_prep.api.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.repository.SiteConfigRepository;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class EnvConfigSeeder implements CommandLineRunner {

    private final SiteConfigRepository siteConfigRepository;
    private final Environment env;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Synchronizing environment variables with site_config...");

        Map<String, String> propertyToConfigKeyMap = new HashMap<>();
        
        // AWS S3
        propertyToConfigKeyMap.put("AWS_S3_ACCESS_KEY", "s3_access_key");
        propertyToConfigKeyMap.put("AWS_S3_SECRET_KEY", "s3_secret_key");
        propertyToConfigKeyMap.put("AWS_S3_REGION", "s3_region");
        propertyToConfigKeyMap.put("AWS_S3_BUCKET", "s3_bucket");
        propertyToConfigKeyMap.put("AWS_S3_ENDPOINT", "s3_endpoint");
        
        // OAuth
        propertyToConfigKeyMap.put("OAUTH_GOOGLE_ENABLED", "oauth_google_enabled");
        propertyToConfigKeyMap.put("OAUTH_MICROSOFT_ENABLED", "oauth_microsoft_enabled");
        
        // SMTP and Email Notifications
        propertyToConfigKeyMap.put("SMTP_HOST", "smtp_host");
        propertyToConfigKeyMap.put("SMTP_PORT", "smtp_port");
        propertyToConfigKeyMap.put("SMTP_USERNAME", "smtp_username");
        propertyToConfigKeyMap.put("SMTP_PASSWORD", "smtp_password");
        propertyToConfigKeyMap.put("EMAIL_SENDER_NAME", "email_sender_name");

        propertyToConfigKeyMap.forEach((property, configKey) -> {
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
    }
}
