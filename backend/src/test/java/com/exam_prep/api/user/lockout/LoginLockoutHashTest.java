package com.exam_prep.api.user.lockout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

class LoginLockoutHashTest {

    @Test
    void storesAHashNotTheEmail() {
        String hash = LoginLockoutService.hashUsername("Someone@Example.org");
        assertFalse(hash.contains("example"));
        assertEquals("sha256:", hash.substring(0, 7));
        assertEquals(7 + 64, hash.length());
    }

    @Test
    void ignoresCaseAndSpacesLikeTheMigration() {
        // V8 hashes existing rows with sha256(lower(trim(username))); new rows must match them.
        assertEquals(LoginLockoutService.hashUsername("a@b.co"), LoginLockoutService.hashUsername("  A@B.co "));
        assertEquals("sha256:7d33d7e7c7204a107e47cadf7732505a8b320c5701edd38d48544135e11e8504",
                LoginLockoutService.hashUsername("old.user@example.org"));
    }
}
