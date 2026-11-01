package com.exam_prep.api.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class CookieSecurityCheckTest {

    @Test
    void sameSiteNoneRequiresSecure() {
        assertThrows(IllegalStateException.class, () -> new CookieSecurityCheck("None", false).check());
        assertThrows(IllegalStateException.class, () -> new CookieSecurityCheck("none", false).check());
        assertDoesNotThrow(() -> new CookieSecurityCheck("None", true).check());
    }

    @Test
    void otherValuesAreLeftAlone() {
        assertDoesNotThrow(() -> new CookieSecurityCheck("Lax", false).check());
        assertDoesNotThrow(() -> new CookieSecurityCheck("Strict", false).check());
    }
}
