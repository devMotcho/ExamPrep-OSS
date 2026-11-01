package com.exam_prep.api.config;

import com.exam_prep.api.aigen.AiGenException;
import com.exam_prep.api.aigen.AiSecretCipher;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.repository.SiteConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * S3 and SMTP settings: the environment first, then what was entered on the settings page. Secrets from the
 * environment stay there and are never copied to the database. Secrets entered on the page are encrypted when
 * AI_SETTINGS_ENCRYPTION_KEY is set; without it they are stored as entered, which the page says.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ServiceSettings {

    public static final Set<String> SECRET_KEYS = Set.of("s3_access_key", "s3_secret_key", "smtp_password");

    private static final Map<String, String> ENV_NAMES = Map.of(
            "s3_access_key", "AWS_S3_ACCESS_KEY",
            "s3_secret_key", "AWS_S3_SECRET_KEY",
            "s3_region", "AWS_S3_REGION",
            "s3_bucket", "AWS_S3_BUCKET",
            "s3_endpoint", "AWS_S3_ENDPOINT",
            "smtp_host", "SMTP_HOST",
            "smtp_port", "SMTP_PORT",
            "smtp_username", "SMTP_USERNAME",
            "smtp_password", "SMTP_PASSWORD");

    /** Each of these says where a secret is sent or who it belongs to, so the secret is only good for its value. */
    private static final Map<String, String> SECRET_TIED_TO = Map.of(
            "smtp_host", "smtp_password",
            "smtp_username", "smtp_password",
            "s3_endpoint", "s3_secret_key");

    private final Environment env;
    private final SiteConfigRepository siteConfigRepository;
    private final AiSecretCipher cipher;

    public String resolve(String key) {
        String fromEnv = envValue(key);
        if (fromEnv != null) {
            return fromEnv;
        }
        String stored = siteConfigRepository.findById(key).map(SiteConfigEntity::getValue).orElse(null);
        return SECRET_KEYS.contains(key) ? decrypt(key, stored) : stored;
    }

    public static Optional<String> secretTiedTo(String key) {
        return Optional.ofNullable(SECRET_TIED_TO.get(key));
    }

    public boolean isEnvManaged(String key) {
        return envValue(key) != null;
    }

    public List<String> envManagedSecrets() {
        return SECRET_KEYS.stream().filter(this::isEnvManaged).sorted().toList();
    }

    public boolean isEncryptionAvailable() {
        return cipher.isAvailable();
    }

    /** What to store for a value entered on the settings page. Anything but these secrets passes through. */
    public String prepareForStorage(String key, String value) {
        if (!SECRET_KEYS.contains(key) || value == null || value.isEmpty()
                || AiSecretCipher.isEncrypted(value) || !cipher.isAvailable()) {
            return value;
        }
        return cipher.encrypt(value, key);
    }

    private String envValue(String key) {
        String name = ENV_NAMES.get(key);
        // Compose always passes a default port, which says nothing unless the host comes from there too.
        if (name == null || ("smtp_port".equals(key) && isBlank(env.getProperty("SMTP_HOST")))) {
            return null;
        }
        String value = env.getProperty(name);
        return isBlank(value) ? null : value;
    }

    private String decrypt(String key, String stored) {
        if (!AiSecretCipher.isEncrypted(stored)) {
            return stored;
        }
        try {
            return cipher.decrypt(stored, key);
        } catch (AiGenException e) {
            log.warn("{} cannot be decrypted with the current AI_SETTINGS_ENCRYPTION_KEY. Enter it again in the settings.", key);
            return null;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
