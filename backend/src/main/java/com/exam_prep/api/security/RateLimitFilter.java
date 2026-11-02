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
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Counts each request twice: against a bucket for its limit class, route and client, and against a total per
 * client. Only a POST to a sensitive route counts against that route's stricter limit, and buckets of different
 * classes never mix, so any other request to the same path cannot create or use up a more generous bucket.
 * Routes are compared in decoded, normalized form, as the router sees them, and not as the client spelled them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String UUID_SEGMENT = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    /** Longest number or token kept as part of a route: anything longer is an id. */
    private static final Pattern ID_SEGMENT = Pattern.compile(UUID_SEGMENT + "|[0-9]+|[A-Za-z0-9_-]{32,}");
    private static final int MAX_DECODE_PASSES = 3;

    enum LimitClass { LOGIN, REGISTER, CONTACT, TELEMETRY, DEFAULT, TOTAL }

    private static final Map<String, LimitClass> SENSITIVE_POSTS = Map.of(
            "/api/auth/login", LimitClass.LOGIN,
            "/api/auth/reset-password", LimitClass.LOGIN,
            "/api/auth/send-code", LimitClass.LOGIN,
            "/api/auth/confirm-email", LimitClass.LOGIN,
            "/api/auth/change-password", LimitClass.LOGIN,
            "/api/auth/me/email", LimitClass.LOGIN,
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
        // A decoded route can hold line breaks, which must not reach the log.
        log.warn("Rate limit exceeded: class={} route={} wait={}s", limitClass, route.replaceAll("\\p{Cntrl}", "?"), secondsToWait);
        sendErrorResponse(response, secondsToWait);
    }

    /**
     * The route a request will reach, however its path is spelled. Ids become a placeholder, so one client has
     * one bucket per route and not one per resource. This reads more spellings as the same route than the servlet
     * container does: that can only merge buckets, never give a request a bucket of its own.
     */
    static String normalizeRoute(String uri) {
        String path = decode(uri == null ? "/" : uri).replace('\\', '/');
        Deque<String> segments = new ArrayDeque<>();
        for (String part : path.split("/")) {
            int parameters = part.indexOf(';');
            String segment = parameters >= 0 ? part.substring(0, parameters) : part;
            if (segment.equals("..")) {
                segments.pollLast();
            } else if (!segment.isEmpty() && !segment.equals(".")) {
                segments.addLast(ID_SEGMENT.matcher(segment).matches() ? "{id}" : segment);
            }
        }
        return "/" + String.join("/", segments);
    }

    /** More than once, as a proxy in front may decode too. Something undecodable is left as it is: nothing routes it. */
    private static String decode(String path) {
        String decoded = path;
        for (int pass = 0; pass < MAX_DECODE_PASSES && decoded.indexOf('%') >= 0; pass++) {
            try {
                decoded = UriUtils.decode(decoded, StandardCharsets.UTF_8);
            } catch (IllegalArgumentException e) {
                break;
            }
        }
        return decoded;
    }

    static LimitClass classify(String method, String route) {
        if ("DELETE".equalsIgnoreCase(method) && "/api/auth/me".equals(route)) {
            return LimitClass.LOGIN; // Checks the password, like a sign-in.
        }
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
