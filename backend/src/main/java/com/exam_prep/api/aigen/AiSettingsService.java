package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.provider.ProviderRegistry;
import com.exam_prep.api.aigen.provider.QuestionGenerationProvider;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.repository.SiteConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Reads, validates and encrypts the "ai" settings stored in site_config. */
@Service
@RequiredArgsConstructor
public class AiSettingsService {

    public static final String GROUP = "ai";
    public static final String ENABLED = "ai_generation_enabled";
    public static final String PROVIDER = "ai_provider";
    public static final String ANTHROPIC_KEY = "anthropic_api_key";
    public static final String OPENAI_KEY = "openai_api_key";
    public static final String MODEL = "ai_model";
    /** Generations each user may run in a rolling {@link AiJobReservationService#WINDOW_DAYS}-day window. */
    public static final String QUOTA = "ai_quota_per_user";
    public static final String SPEND_CAP = "ai_monthly_spend_cap_usd";
    public static final String RATE_LIMIT = "ai_rate_limit_per_hour";
    public static final String PRICE_INPUT = "ai_price_input_per_mtok";
    public static final String PRICE_OUTPUT = "ai_price_output_per_mtok";

    private static final Set<String> ENCRYPTED_KEYS = Set.of(ANTHROPIC_KEY, OPENAI_KEY);
    private static final Set<String> INTEGER_KEYS = Set.of(QUOTA, RATE_LIMIT);
    private static final Set<String> DECIMAL_KEYS = Set.of(SPEND_CAP);
    private static final Set<String> OPTIONAL_DECIMAL_KEYS = Set.of(PRICE_INPUT, PRICE_OUTPUT);

    /** Prices are USD per million tokens, from the providers' published pricing pages (2026-10). */
    private static final Map<String, Pricing> KNOWN_PRICES = Map.of(
            "claude-opus-5-5", new Pricing(new BigDecimal("4"), new BigDecimal("20")),
            "claude-opus-5", new Pricing(new BigDecimal("5"), new BigDecimal("25")),
            "claude-sonnet-5-5", new Pricing(new BigDecimal("2"), new BigDecimal("10")),
            "claude-fable-5-1", new Pricing(new BigDecimal("10"), new BigDecimal("50")),
            "gpt-6-astra", new Pricing(new BigDecimal("10"), new BigDecimal("50")),
            "gpt-6.1-sol", new Pricing(new BigDecimal("2"), new BigDecimal("10")),
            "gpt-6.1-terra", new Pricing(new BigDecimal("1"), new BigDecimal("5")),
            "gpt-6-luna", new Pricing(new BigDecimal("0.10"), new BigDecimal("0.50")));

    private final SiteConfigRepository siteConfigRepository;
    private final AiSecretCipher cipher;
    private final ProviderRegistry providers;

    public record Pricing(BigDecimal inputPerMtok, BigDecimal outputPerMtok) {}

    /** Snapshot of non-secret settings. API keys are deliberately not part of it. */
    public record Settings(boolean enabled, String provider, String model, boolean keyStored,
                           int quota, BigDecimal spendCapUsd, int rateLimitPerHour,
                           Optional<Pricing> pricing) {}

    public Settings load() {
        Map<String, String> values = siteConfigRepository.findAll().stream()
                .filter(c -> GROUP.equals(c.getGroup()))
                .collect(Collectors.toMap(SiteConfigEntity::getKey, c -> c.getValue() == null ? "" : c.getValue()));

        String provider = values.getOrDefault(PROVIDER, "anthropic");
        String configuredModel = values.getOrDefault(MODEL, "").trim();
        String model = configuredModel;
        if (model.isEmpty()) {
            model = providers.find(provider).map(QuestionGenerationProvider::defaultModel).orElse("");
        }
        return new Settings(
                "true".equalsIgnoreCase(values.get(ENABLED)),
                provider,
                model,
                !values.getOrDefault(keyName(provider), "").isBlank(),
                parseInt(values.get(QUOTA), 10),
                parseDecimal(values.get(SPEND_CAP)).orElse(BigDecimal.ZERO),
                parseInt(values.get(RATE_LIMIT), 5),
                resolvePricing(model, values));
    }

    /** True when a job could actually run. Anything missing fails closed. */
    public boolean isOperational(Settings s) {
        return s.enabled() && isConfigured(s);
    }

    public boolean isConfigured(Settings s) {
        return cipher.isAvailable() && providers.find(s.provider()).isPresent()
                && s.keyStored() && !s.model().isEmpty() && s.pricing().isPresent();
    }

    /** Decrypted key for the given provider. Keep the result in a local variable; never log or store it. */
    public String decryptApiKey(String provider) {
        String name = keyName(provider);
        String stored = siteConfigRepository.findById(name).map(SiteConfigEntity::getValue).orElse("");
        if (stored.isBlank()) {
            throw new AiGenException(AiErrorCode.AI_NOT_CONFIGURED, HttpStatus.SERVICE_UNAVAILABLE);
        }
        return cipher.decrypt(stored, name);
    }

    /** Validates an incoming value for a config key and returns what must be persisted. */
    public String prepareForStorage(String key, String rawValue) {
        String value = rawValue.trim();
        if (ENCRYPTED_KEYS.contains(key)) {
            if (value.isEmpty()) {
                return ""; // explicit clear
            }
            if (value.length() > 1024 || value.chars().anyMatch(Character::isWhitespace)) {
                throw invalid("The API key format is invalid.");
            }
            return cipher.encrypt(value, key);
        }
        if (ENABLED.equals(key) && !value.equals("true") && !value.equals("false")) {
            throw invalid("ai_generation_enabled must be true or false.");
        }
        if (PROVIDER.equals(key) && !value.equals("anthropic") && !value.equals("openai")) {
            throw invalid("ai_provider must be anthropic or openai.");
        }
        if (MODEL.equals(key) && !value.isEmpty() && !value.matches("[A-Za-z0-9._:\\-]{1,100}")) {
            throw invalid("The model identifier is invalid.");
        }
        if (INTEGER_KEYS.contains(key) && !value.matches("\\d{1,6}")) {
            throw invalid(key + " must be a whole number greater than or equal to 0.");
        }
        if (DECIMAL_KEYS.contains(key) && parseDecimal(value).isEmpty()) {
            throw invalid(key + " must be a number greater than or equal to 0.");
        }
        if (OPTIONAL_DECIMAL_KEYS.contains(key) && !value.isEmpty() && parseDecimal(value).isEmpty()) {
            throw invalid(key + " must be empty or a number greater than or equal to 0.");
        }
        return key.startsWith("ai_") ? value : rawValue;
    }

    private static AiGenException invalid(String message) {
        return new AiGenException(AiErrorCode.AI_INVALID_SETTING, message, HttpStatus.BAD_REQUEST);
    }

    private static String keyName(String provider) {
        return "openai".equals(provider) ? OPENAI_KEY : ANTHROPIC_KEY;
    }

    /** Custom prices win when both are set; an unknown model without them has no price, so generation is refused. */
    private static Optional<Pricing> resolvePricing(String model, Map<String, String> values) {
        Optional<BigDecimal> in = parseDecimal(values.get(PRICE_INPUT));
        Optional<BigDecimal> out = parseDecimal(values.get(PRICE_OUTPUT));
        if (in.isPresent() && out.isPresent()) {
            return Optional.of(new Pricing(in.get(), out.get()));
        }
        return Optional.ofNullable(KNOWN_PRICES.get(model));
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value == null ? "" : value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static Optional<BigDecimal> parseDecimal(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            BigDecimal parsed = new BigDecimal(value.trim());
            return parsed.signum() < 0 || parsed.compareTo(new BigDecimal("1000000")) > 0 ? Optional.empty() : Optional.of(parsed);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
