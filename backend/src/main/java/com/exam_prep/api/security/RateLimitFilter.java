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
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Counts each request twice: against a bucket for its limit class, route and client, and against a total per
 * client. Only a POST to a sensitive route counts against that route's stricter limit, and buckets of different
 * classes never mix, so any other request to the same path cannot create or use up a more generous bucket.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String UUID_SEGMENT = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    /** Longest number or token kept as part of a route: anything longer is an id. */
    private static final Pattern ID_SEGMENT = Pattern.compile(UUID_SEGMENT + "|[0-9]+|[A-Za-z0-9_-]{32,}");
    private static final Pattern REPEATED_SLASHES = Pattern.compile("/{2,}");

    enum LimitClass { LOGIN, REGISTER, CONTACT, TELEMETRY, DEFAULT, TOTAL }

    private static final Map<String, LimitClass> SENSITIVE_POSTS = Map.of(
            "/api/auth/login", LimitClass.LOGIN,
            "/api/auth/reset-password", LimitClass.LOGIN,
            "/api/auth/send-code", LimitClass.LOGIN,
            "/api/auth/confirm-email", LimitClass.LOGIN,
            "/api/auth/change-password", LimitClass.LOGIN,
            "/api/auth/oauth2/exchange", LimitClass.LOGIN,
            "/api/auth/register", LimitClass.REGISTER,
            "/api/contact", LimitClass.CONTACT,
            "/api/auth/telemetry/visit", LimitClass.TELEMETRY);

    private final ClientIpResolver clientIpResolver;
    private final RateLimitProperties rateLimitProperties;
    /** Bounded: the key includes the route, so unknown URLs must not be able to grow this without limit. */
    private final Cache<String, Bucket> cache = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10)).maximumSize(100_000).build();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String client = clientIpResolver.resolveClientKey(request);
        String route = normalizeRoute(request.getRequestURI());
        LimitClass limitClass = classify(request.getMethod(), route);
        int limit = limitFor(limitClass);

        ConsumptionProbe total = consume(LimitClass.TOTAL, "", client, rateLimitProperties.getTotalLimit());
        if (!total.isConsumed()) {
            reject(response, LimitClass.TOTAL, route, total);
            return;
        }

        ConsumptionProbe probe = consume(limitClass, route, client, limit);
        if (!probe.isConsumed()) {
            reject(response, limitClass, route, probe);
            return;
        }

        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
        response.setHeader("X-RateLimit-Reset", "60"); // Refill window of 60 seconds
        filterChain.doFilter(request, response);
    }

    private ConsumptionProbe consume(LimitClass limitClass, String route, String client, int limit) {
        return cache.get(limitClass + "|" + route + "|" + client, k -> createNewBucket(limit)).tryConsumeAndReturnRemaining(1);
    }

    private void reject(HttpServletResponse response, LimitClass limitClass, String route, ConsumptionProbe probe) throws IOException {
        long secondsToWait = (probe.getNanosToWaitForRefill() / 1_000_000_000) + 1;
        log.warn("Rate limit exceeded: class={} route={} wait={}s", limitClass, route, secondsToWait);
        sendErrorResponse(response, secondsToWait);
    }

    /** Ids become a placeholder, so one client has one bucket per route and not one per resource. */
    static String normalizeRoute(String uri) {
        String path = uri == null ? "/" : uri;
        int parameters = path.indexOf(';');
        if (parameters >= 0) {
            path = path.substring(0, parameters);
        }
        path = REPEATED_SLASHES.matcher(path).replaceAll("/");
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        StringBuilder route = new StringBuilder();
        for (String segment : path.split("/")) {
            if (!segment.isEmpty()) {
                route.append('/').append(ID_SEGMENT.matcher(segment).matches() ? "{id}" : segment);
            }
        }
        return route.isEmpty() ? "/" : route.toString();
    }

    static LimitClass classify(String method, String route) {
        return "POST".equalsIgnoreCase(method) ? SENSITIVE_POSTS.getOrDefault(route, LimitClass.DEFAULT) : LimitClass.DEFAULT;
    }

    private int limitFor(LimitClass limitClass) {
        return switch (limitClass) {
            case LOGIN -> rateLimitProperties.getLoginLimit();
            case REGISTER -> rateLimitProperties.getRegisterLimit();
            case CONTACT -> rateLimitProperties.getContactLimit();
            case TELEMETRY -> rateLimitProperties.getTelemetryLimit();
            case TOTAL -> rateLimitProperties.getTotalLimit();
            case DEFAULT -> rateLimitProperties.getDefaultLimit();
        };
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
