package com.exam_prep.api.user.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The HttpOnly cookies that carry a session, and the short-lived one that ties a sign-in to its browser. */
@Component
public class AuthCookies {

    static final String ACCESS = "access_token";
    static final String REFRESH = "refresh_token";
    static final String OAUTH_BINDING = "oauth_binding";

    @Value("${app.cookie.same-site:Lax}")
    private String sameSite = "Lax";

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    public String read(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    public void set(HttpServletRequest request, HttpServletResponse response, String name, String value, long maxAgeSeconds) {
        response.addHeader("Set-Cookie", String.format("%s=%s; Max-Age=%d; Path=/; HttpOnly;%s SameSite=%s",
                name, value, maxAgeSeconds, secureFlags(request), sameSite));
    }

    public void clear(HttpServletRequest request, HttpServletResponse response, String name) {
        set(request, response, name, "", 0);
    }

    /** Clears the session cookie of the OAuth handshake, with the same-site value it was set with. */
    public void clearSession(HttpServletRequest request, HttpServletResponse response, String sessionSameSite) {
        response.addHeader("Set-Cookie", String.format("JSESSIONID=; Max-Age=0; Path=/; HttpOnly;%s SameSite=%s",
                secureFlags(request), sessionSameSite));
    }

    private String secureFlags(HttpServletRequest request) {
        return isSecure(request) ? " Secure; Partitioned;" : "";
    }

    boolean isSecure(HttpServletRequest request) {
        if (cookieSecure) {
            return true;
        }
        if (request == null) {
            return false;
        }
        if (request.isSecure()) {
            return true;
        }
        if ("https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"))) {
            return true;
        }

        String serverName = request.getServerName();
        if (serverName == null) {
            return true;
        }

        // Local development hostnames
        if (serverName.equals("localhost") ||
            serverName.equals("127.0.0.1") ||
            serverName.equals("0.0.0.0") ||
            serverName.endsWith(".local")) {
            return false;
        }

        // Private local IP ranges (RFC 1918)
        if (serverName.startsWith("192.168.") || serverName.startsWith("10.")) {
            return false;
        }

        if (serverName.startsWith("172.")) {
            try {
                String[] parts = serverName.split("\\.");
                if (parts.length >= 2) {
                    int secondOctet = Integer.parseInt(parts[1]);
                    if (secondOctet >= 16 && secondOctet <= 31) {
                        return false;
                    }
                }
            } catch (NumberFormatException e) {
                // Not an address: default to secure
            }
        }

        // Anything else is a public name, which must get Secure cookies.
        return true;
    }
}
