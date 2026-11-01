package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.aigen.AiGenException;
import com.exam_prep.api.aigen.AiSettingsService;
import com.exam_prep.api.config.ServiceSettings;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.email.DynamicMailSenderFactory;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.service.S3Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class SiteConfigController {

    private final SiteConfigRepository siteConfigRepository;
    private final S3Service s3Service;
    private final AiSettingsService aiSettingsService;
    private final ServiceSettings serviceSettings;
    private final DynamicMailSenderFactory mailSenderFactory;

    /** Sent to the client instead of a stored secret; receiving it back means "leave unchanged". */
    private static final String SECRET_MASK = "********";

    /** The only settings anonymous visitors may read. A new setting stays private until it is listed here. */
    private static final Set<String> PUBLIC_KEYS = Set.of(
            "company_name", "tagline", "logo_url", "favicon_url",
            "meta_title", "meta_description", "og_image_url",
            "primary_color", "primary_color_dark", "secondary_color", "secondary_color_dark",
            "accent_color", "accent_color_dark",
            "color_success", "color_warning", "color_info", "color_danger",
            "phone_primary", "phone_secondary", "email_support", "email_sales", "address", "google_maps_url",
            "url_linkedin", "url_instagram", "url_facebook", "url_twitter",
            "contact_enabled", "contact_email_enabled", "email_enabled", "register_enabled", "confirmation_code_enabled",
            "oauth_google_enabled", "oauth_microsoft_enabled",
            "dark_mode_enabled", "default_page_size", "gallery_enabled", "multi_lang_enabled",
            AiSettingsService.ENABLED);

    @GetMapping("/public")
    @Cacheable("siteConfigPublic")
    public ResponseEntity<Map<String, String>> getPublicConfig() {
        Map<String, String> configMap = siteConfigRepository.findAllById(PUBLIC_KEYS).stream()
                .filter(c -> !isSecret(c))
                .collect(Collectors.toMap(
                        SiteConfigEntity::getKey,
                        c -> "image_url".equalsIgnoreCase(c.getType()) ? s3Service.refreshPresignedUrlIfNeeded(c.getValue()) : c.getValue()
                ));

        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=300")
                .body(configMap);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    public ResponseEntity<List<SiteConfigEntity>> getAllConfigs() {
        return ResponseEntity.ok(siteConfigRepository.findAll().stream()
                .map(c -> isSecret(c) ? masked(c) : withRefreshedUrl(c))
                .collect(Collectors.toList()));
    }

    /** What the settings page tells administrators about how S3 and SMTP credentials are kept. */
    @GetMapping("/secret-storage")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    public ResponseEntity<Map<String, Object>> getSecretStorage() {
        return ResponseEntity.ok(Map.of(
                "encryptionAvailable", serviceSettings.isEncryptionAvailable(),
                "envManaged", serviceSettings.envManagedSecrets()));
    }

    @PutMapping("/{key}")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    @CacheEvict(value = "siteConfigPublic", allEntries = true)
    public ResponseEntity<SiteConfigEntity> updateConfig(@PathVariable String key,
            @RequestBody Map<String, String> body) {
        SiteConfigEntity entity = siteConfigRepository.findById(key)
                .orElseThrow(() -> new RuntimeException("Config not found"));

        Map<String, String> update = new HashMap<>();
        update.put(key, body.get("value"));
        return ResponseEntity.ok(save(new ArrayList<>(List.of(entity)), update).stream()
                .filter(saved -> key.equals(saved.getKey()))
                .findFirst()
                .map(this::masked)
                .orElseThrow());
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    @CacheEvict(value = "siteConfigPublic", allEntries = true)
    public ResponseEntity<List<SiteConfigEntity>> updateBulkConfig(@RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(save(new ArrayList<>(siteConfigRepository.findAllById(updates.keySet())), updates).stream()
                .map(this::masked)
                .collect(Collectors.toList()));
    }

    /**
     * Checks everything first, so a refused or bad value leaves all settings untouched. A secret tied to a changed
     * host, username or endpoint is cleared unless the same request brings a new one: it must not follow the change.
     * The cleared row is part of the result, so the page can show that it is gone.
     */
    private List<SiteConfigEntity> save(List<SiteConfigEntity> configs, Map<String, String> updates) {
        Set<String> secretsToClear = new HashSet<>();
        for (SiteConfigEntity config : configs) {
            ServiceSettings.secretTiedTo(config.getKey())
                    .filter(secret -> isChange(config, updates.get(config.getKey())))
                    .ifPresent(secret -> {
                        refuseIfEnvManaged(config.getKey(), secret);
                        secretsToClear.add(secret);
                    });
        }

        for (SiteConfigEntity config : configs) {
            applyValue(config, updates.get(config.getKey()));
        }

        secretsToClear.removeIf(secret -> isNewSecret(updates.get(secret)));
        for (String secret : secretsToClear) {
            SiteConfigEntity row = configs.stream().filter(config -> secret.equals(config.getKey())).findFirst()
                    .or(() -> siteConfigRepository.findById(secret)
                            .map(found -> { configs.add(found); return found; }))
                    .orElse(null);
            if (row != null) {
                row.setValue("");
            }
        }

        List<SiteConfigEntity> saved = siteConfigRepository.saveAll(configs);
        if (configs.stream().anyMatch(config -> config.getKey().startsWith("smtp_"))) {
            mailSenderFactory.invalidateCache();
        }
        return saved;
    }

    private static boolean isChange(SiteConfigEntity config, String incoming) {
        return incoming != null && !incoming.equals(Objects.requireNonNullElse(config.getValue(), ""));
    }

    private static boolean isNewSecret(String incoming) {
        return incoming != null && !SECRET_MASK.equals(incoming);
    }

    /** With a secret in the environment, a value from this page could point it at another server. */
    private void refuseIfEnvManaged(String key, String secret) {
        if (serviceSettings.isEnvManaged(key) || serviceSettings.isEnvManaged(secret)) {
            throw new AppException(key + " is set in the environment, or goes with a secret that is. Change it there.", HttpStatus.CONFLICT);
        }
    }

    private void applyValue(SiteConfigEntity entity, String incoming) {
        if (incoming == null || (isSecret(entity) && SECRET_MASK.equals(incoming))) {
            return;
        }
        if (isSecret(entity) && serviceSettings.isEnvManaged(entity.getKey())) {
            return; // The environment wins; storing a second copy would only mislead.
        }
        entity.setValue(serviceSettings.prepareForStorage(entity.getKey(), aiSettingsService.prepareForStorage(entity.getKey(), incoming)));
    }

    private static boolean isSecret(SiteConfigEntity entity) {
        return "password".equalsIgnoreCase(entity.getType());
    }

    /** Always a copy: changing a managed entity could write the mask to the database. */
    private SiteConfigEntity masked(SiteConfigEntity entity) {
        boolean hide = isSecret(entity);
        return copyWith(entity, hide
                ? (entity.getValue() == null || entity.getValue().isEmpty() ? "" : SECRET_MASK)
                : entity.getValue(), hide ? null : entity.getDefaultValue());
    }

    private SiteConfigEntity withRefreshedUrl(SiteConfigEntity entity) {
        return copyWith(entity, s3Service.refreshPresignedUrlIfNeeded(entity.getValue()), entity.getDefaultValue());
    }

    private static SiteConfigEntity copyWith(SiteConfigEntity entity, String value, String defaultValue) {
        return SiteConfigEntity.builder()
                .key(entity.getKey())
                .value(value)
                .type(entity.getType())
                .label(entity.getLabel())
                .group(entity.getGroup())
                .defaultValue(defaultValue)
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    @ExceptionHandler(AiGenException.class)
    public ResponseEntity<Map<String, Object>> handleAiSettingError(AiGenException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage(), "code", e.getCode().name()));
    }
}
