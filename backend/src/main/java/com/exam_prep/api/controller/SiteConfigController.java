package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.aigen.AiGenException;
import com.exam_prep.api.aigen.AiSettingsService;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.service.S3Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class SiteConfigController {

    private final SiteConfigRepository siteConfigRepository;
    private final S3Service s3Service;
    private final AiSettingsService aiSettingsService;

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

    @PutMapping("/{key}")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    @CacheEvict(value = "siteConfigPublic", allEntries = true)
    public ResponseEntity<SiteConfigEntity> updateConfig(@PathVariable String key,
            @RequestBody Map<String, String> body) {
        SiteConfigEntity entity = siteConfigRepository.findById(key)
                .orElseThrow(() -> new RuntimeException("Config not found"));

        applyValue(entity, body.get("value"));
        return ResponseEntity.ok(masked(siteConfigRepository.save(entity)));
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    @CacheEvict(value = "siteConfigPublic", allEntries = true)
    public ResponseEntity<List<SiteConfigEntity>> updateBulkConfig(@RequestBody Map<String, String> updates) {
        List<SiteConfigEntity> configs = siteConfigRepository.findAllById(updates.keySet());
        // Validates and encrypts everything first, so a bad value leaves all settings untouched.
        for (SiteConfigEntity config : configs) {
            applyValue(config, updates.get(config.getKey()));
        }
        return ResponseEntity.ok(siteConfigRepository.saveAll(configs).stream()
                .map(this::masked)
                .collect(Collectors.toList()));
    }

    private void applyValue(SiteConfigEntity entity, String incoming) {
        if (incoming == null || (isSecret(entity) && SECRET_MASK.equals(incoming))) {
            return;
        }
        entity.setValue(aiSettingsService.prepareForStorage(entity.getKey(), incoming));
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
