package com.exam_prep.api.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final ClientIpResolver clientIpResolver;
    private final RateLimitProperties rateLimitProperties;
    /** Bounded: the key includes the path, so unknown URLs must not be able to grow this without limit. */
    private final Cache<String, Bucket> cache = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10)).maximumSize(100_000).build();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String clientIp = clientIpResolver.resolveClientIp(request);
        String path = request.getRequestURI();
        String method = request.getMethod();

        int limit = getLimit(method, path);
        String cacheKey = clientIp + "::" + path;

        Bucket bucket = cache.get(cacheKey, k -> createNewBucket(limit));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            response.setHeader("X-RateLimit-Reset", "60"); // Refill window of 60 seconds
            
            filterChain.doFilter(request, response);
        } else {
            long nanosToWait = probe.getNanosToWaitForRefill();
            long secondsToWait = (nanosToWait / 1_000_000_000) + 1;

            log.warn("Rate limit exceeded for IP: {} on endpoint: {} [Limit: {}/min, Wait: {}s]", 
                    clientIp, path, limit, secondsToWait);
            
            sendErrorResponse(response, secondsToWait);
        }
    }

    private int getLimit(String method, String uri) {
        if ("POST".equalsIgnoreCase(method)) {
            if (uri.endsWith("/auth/login") || uri.endsWith("/auth/reset-password") || uri.endsWith("/auth/send-code")) {
                return rateLimitProperties.getLoginLimit();
            } else if (uri.endsWith("/auth/register")) {
                return rateLimitProperties.getRegisterLimit();
            } else if (uri.endsWith("/contact")) {
                return rateLimitProperties.getContactLimit();
            } else if (uri.endsWith("/auth/telemetry/visit")) {
                return rateLimitProperties.getTelemetryLimit();
            }
        }
        return rateLimitProperties.getDefaultLimit();
    }

    private Bucket createNewBucket(int limit) {
        return Bucket.builder()
                .addLimit(l -> l.capacity(limit).refillGreedy(limit, Duration.ofMinutes(1)))
                .build();
    }

    private void sendErrorResponse(HttpServletResponse response, long secondsToWait) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(secondsToWait));
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(String.format("{\"error\": \"Too many requests\", \"retryAfter\": %d}", secondsToWait));
    }
}
