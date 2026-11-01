package com.exam_prep.api.aigen;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM for provider API keys at rest. The key comes from the
 * AI_SETTINGS_ENCRYPTION_KEY environment variable (base64 of 32 bytes, e.g.
 * `openssl rand -base64 32`). Fails closed: without a valid key, secrets can
 * be neither stored nor read. The config key is bound as AAD so a ciphertext
 * cannot be moved to a different setting.
 */
@Component
@Slf4j
public class AiSecretCipher {

    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public AiSecretCipher(Environment env) {
        this.key = parseKey(env.getProperty("AI_SETTINGS_ENCRYPTION_KEY"));
        if (key == null) {
            log.warn("AI_SETTINGS_ENCRYPTION_KEY is missing or invalid: AI generation stays unavailable.");
        }
    }

    private static SecretKeySpec parseKey(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(value.trim());
            return raw.length == 32 ? new SecretKeySpec(raw, "AES") : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public boolean isAvailable() {
        return key != null;
    }

    public String encrypt(String plaintext, String configKey) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(configKey.getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = Arrays.copyOf(iv, IV_BYTES + ciphertext.length);
            System.arraycopy(ciphertext, 0, out, IV_BYTES, ciphertext.length);
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new AiGenException(AiErrorCode.AI_ENCRYPTION_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    public String decrypt(String stored, String configKey) {
        requireKey();
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new AiGenException(AiErrorCode.AI_KEY_UNREADABLE, HttpStatus.SERVICE_UNAVAILABLE);
        }
        try {
            byte[] in = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, IV_BYTES));
            cipher.updateAAD(configKey.getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(in, IV_BYTES, in.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new AiGenException(AiErrorCode.AI_KEY_UNREADABLE, HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new AiGenException(AiErrorCode.AI_ENCRYPTION_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
}
