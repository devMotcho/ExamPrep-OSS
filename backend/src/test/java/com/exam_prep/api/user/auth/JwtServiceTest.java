package com.exam_prep.api.user.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class JwtServiceTest {

    @Test
    void refusesAMissingSecret() {
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> JwtService.requireStrongSecret(""));
        assertTrue(e.getMessage().contains("JWT_SECRET"));
        assertThrows(IllegalStateException.class, () -> JwtService.requireStrongSecret(null));
    }

    @Test
    void refusesASecretShorterThan32Bytes() {
        assertThrows(IllegalStateException.class, () -> JwtService.requireStrongSecret("a".repeat(31)));
    }

    @Test
    void acceptsA32ByteSecret() {
        assertDoesNotThrow(() -> JwtService.requireStrongSecret("a".repeat(32)));
    }
}
