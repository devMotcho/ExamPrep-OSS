package com.exam_prep.api.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * The address rate limits and login lockouts are keyed on. Request headers are never read here, as anyone can
 * send them: with {@code server.forward-headers-strategy=native}, Tomcat only applies X-Forwarded-For when the
 * connection comes from a trusted proxy ({@code server.tomcat.remoteip.internal-proxies}).
 */
@Component
public class ClientIpResolver {

    public String resolveClientIp(HttpServletRequest request) {
        return request == null ? "0.0.0.0" : request.getRemoteAddr();
    }
}
