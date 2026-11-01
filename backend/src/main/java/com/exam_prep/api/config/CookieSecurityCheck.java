package com.exam_prep.api.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * CSRF tokens are off because auth cookies rely on SameSite. COOKIE_SAME_SITE=None removes that protection,
 * and browsers drop a SameSite=None cookie that is not Secure, so that combination stops the app from starting.
 */
@Component
@Slf4j
public class CookieSecurityCheck {

    private final String sameSite;
    private final boolean secure;

    public CookieSecurityCheck(@Value("${app.cookie.same-site:Lax}") String sameSite,
                               @Value("${app.cookie.secure:false}") boolean secure) {
        this.sameSite = sameSite;
        this.secure = secure;
    }

    @PostConstruct
    void check() {
        if (!"None".equalsIgnoreCase(sameSite == null ? "" : sameSite.trim())) {
            return;
        }
        if (!secure) {
            throw new IllegalStateException("COOKIE_SAME_SITE=None requires COOKIE_SECURE=true.");
        }
        log.warn("COOKIE_SAME_SITE=None: browsers send auth cookies on cross-site requests and this app has no CSRF tokens, "
                + "so other sites can make requests as a signed-in user. Use Lax unless the frontend is on another site.");
    }
}
