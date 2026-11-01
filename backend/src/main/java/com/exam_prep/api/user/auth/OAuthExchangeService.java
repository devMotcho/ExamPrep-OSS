package com.exam_prep.api.user.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Hands a finished social sign-in to the web app: the redirect carries a code valid once and for a minute, and
 * no tokens. The code only works together with a cookie set on the same redirect, so a code sent to someone
 * else cannot sign them in to the wrong account. Kept in memory: a single backend instance is assumed.
 */
@Service
public class OAuthExchangeService {

    static final Duration LIFETIME = Duration.ofSeconds(60);

    public record Issued(String code, String binding) {}

    private record Pending(UUID userId, String bindingHash) {}

    private final Cache<String, Pending> pending = Caffeine.newBuilder()
            .expireAfterWrite(LIFETIME).maximumSize(100_000).build();

    public Issued issue(UUID userId) {
        String code = TokenHash.newToken();
        String binding = TokenHash.newToken();
        pending.put(TokenHash.sha256(code), new Pending(userId, TokenHash.sha256(binding)));
        return new Issued(code, binding);
    }

    /** Always uses the code up, whether or not the binding matches. */
    public Optional<UUID> consume(String code, String binding) {
        if (code == null || code.isBlank() || binding == null || binding.isBlank()) {
            return Optional.empty();
        }
        Pending entry = pending.asMap().remove(TokenHash.sha256(code));
        if (entry == null || !MessageDigest.isEqual(
                entry.bindingHash().getBytes(StandardCharsets.UTF_8),
                TokenHash.sha256(binding).getBytes(StandardCharsets.UTF_8))) {
            return Optional.empty();
        }
        return Optional.of(entry.userId());
    }
}
