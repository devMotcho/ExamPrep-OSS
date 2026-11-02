package com.exam_prep.api.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    private final RateLimitProperties properties = new RateLimitProperties();

    private RateLimitFilter filter() {
        return new RateLimitFilter(new ClientIpResolver(), properties);
    }

    private int send(RateLimitFilter filter, String method, String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    private int post(RateLimitFilter filter, String path) throws Exception {
        return send(filter, "POST", path, "10.0.0.1");
    }

    @Test
    void telemetryHasItsOwnLimit() throws Exception {
        properties.setTelemetryLimit(2);
        properties.setDefaultLimit(50);
        RateLimitFilter filter = filter();
        String path = "/api/auth/telemetry/visit";

        assertEquals(200, post(filter, path));
        assertEquals(200, post(filter, path));
        assertEquals(429, post(filter, path));
    }

    @Test
    void accountChangesThatCheckThePasswordHaveTheLoginLimit() throws Exception {
        properties.setLoginLimit(1);
        properties.setDefaultLimit(50);
        RateLimitFilter filter = filter();

        assertEquals(200, post(filter, "/api/auth/me/email"));
        assertEquals(429, post(filter, "/api/auth/me/email"));
        assertEquals(200, send(filter, "DELETE", "/api/auth/me", "10.0.0.1"));
        assertEquals(429, send(filter, "DELETE", "/api/auth/me", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/auth/me", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/auth/me", "10.0.0.1"));
    }

    @Test
    void aGetDoesNotGiveASensitivePostTheDefaultLimit() throws Exception {
        properties.setLoginLimit(2);
        properties.setDefaultLimit(50);
        RateLimitFilter filter = filter();
        String path = "/api/auth/login";

        assertEquals(200, send(filter, "GET", path, "10.0.0.1"));
        assertEquals(200, post(filter, path));
        assertEquals(200, post(filter, path));
        assertEquals(429, post(filter, path));
    }

    @Test
    void aGetDoesNotUseUpASensitivePost() throws Exception {
        properties.setLoginLimit(1);
        properties.setDefaultLimit(50);
        RateLimitFilter filter = filter();
        for (int i = 0; i < 5; i++) {
            assertEquals(200, send(filter, "GET", "/api/auth/login", "10.0.0.1"));
        }
        assertEquals(200, post(filter, "/api/auth/login"));
    }

    @Test
    void pathVariationsShareTheSensitiveBucket() throws Exception {
        properties.setLoginLimit(1);
        RateLimitFilter filter = filter();
        assertEquals(200, post(filter, "/api/auth/login"));
        assertEquals(429, post(filter, "/api/auth/login/"));
        assertEquals(429, post(filter, "/api//auth/login"));
        assertEquals(429, post(filter, "/api/auth/login;x=1"));
    }

    @ParameterizedTest
    @CsvSource({
            "/api/auth/login, /api/auth/%6Cogin",
            "/api/auth/login, /api/auth/%6c%6f%67%69%6e",
            "/api/auth/login, /api/%61uth/login",
            "/api/auth/login, /%61pi/auth/login",
            "/api/auth/login, /api/auth/%256Cogin",
            "/api/auth/login, /api/auth/./login",
            "/api/auth/login, /api/auth/%2e/login",
            "/api/auth/login, /api/x/../auth/login",
            "/api/auth/login, /api/x/%2E%2E/auth/login",
            "/api/auth/login, /api/auth%2Flogin",
            "/api/auth/login, /api/auth%5Clogin",
            "/api/auth/login, /api/auth;a=1/login;b=2/",
            "/api/auth/login, /api/auth/login%2F",
            "/api/auth/login, /api/auth/login%3Bx=1",
            "/api/auth/register, /api/auth/%72egister",
            "/api/auth/send-code, /api/auth/send%2Dcode",
            "/api/auth/reset-password, /api/auth/reset%2Dpassword",
            "/api/auth/change-password, /api/auth/change%2dpassword",
            "/api/auth/confirm-email, /api/auth/confirm%2Demail",
            "/api/auth/oauth2/exchange, /api/auth/oauth2/%65xchange",
            "/api/contact, /api/%63ontact",
            "/api/auth/telemetry/visit, /api/auth/telemetry/%76isit",
    })
    void everySpellingOfASensitiveRouteSharesItsBucket(String route, String spelling) throws Exception {
        properties.setLoginLimit(1);
        properties.setRegisterLimit(1);
        properties.setContactLimit(1);
        properties.setTelemetryLimit(1);
        RateLimitFilter filter = filter();

        assertEquals(route, RateLimitFilter.normalizeRoute(spelling));
        assertEquals(200, post(filter, route));
        assertEquals(429, post(filter, spelling));
    }

    @Test
    void spellingsCannotStartAFreshBucketOneAfterTheOther() throws Exception {
        properties.setLoginLimit(2);
        RateLimitFilter filter = filter();
        assertEquals(200, post(filter, "/api/auth/%6Cogin"));
        assertEquals(200, post(filter, "/api/auth/l%6Fgin"));
        assertEquals(429, post(filter, "/api/auth/lo%67in"));
        assertEquals(429, post(filter, "/api/auth/login"));
    }

    @Test
    void encodedIdsShareOneBucket() {
        assertEquals("/api/api/questions/{id}",
                RateLimitFilter.normalizeRoute("/api/api/questions/%36f1d2c3a-1111-4222-8333-444455556666"));
    }

    @Test
    void anUndecodablePathIsLeftAlone() {
        assertEquals("/api/auth/%zzlogin", RateLimitFilter.normalizeRoute("/api/auth/%zzlogin"));
    }

    @Test
    void aLineBreakInAPathDoesNotBreakAnything() throws Exception {
        properties.setDefaultLimit(1);
        RateLimitFilter filter = filter();
        assertEquals(200, send(filter, "GET", "/api/x%0Ay", "10.0.0.1"));
        assertEquals(429, send(filter, "GET", "/api/x%0Ay", "10.0.0.1"));
    }

    @Test
    void idsInAPathShareOneBucket() throws Exception {
        properties.setDefaultLimit(2);
        RateLimitFilter filter = filter();
        assertEquals(200, send(filter, "GET", "/api/api/study-areas/6f1d2c3a-1111-4222-8333-444455556666", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/api/study-areas/7f1d2c3a-1111-4222-8333-444455556666", "10.0.0.1"));
        assertEquals(429, send(filter, "GET", "/api/api/study-areas/8f1d2c3a-1111-4222-8333-444455556666", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/api/study-areas", "10.0.0.1"));
    }

    @Test
    void routeNormalization() {
        assertEquals("/api/api/questions/{id}", RateLimitFilter.normalizeRoute("/api/api/questions/6f1d2c3a-1111-4222-8333-444455556666/"));
        assertEquals("/api/x/{id}/y", RateLimitFilter.normalizeRoute("/api//x/123/y"));
        assertEquals("/", RateLimitFilter.normalizeRoute("/"));
    }

    @Test
    void thereIsATotalPerClientAcrossRoutes() throws Exception {
        properties.setTotalLimit(2);
        RateLimitFilter filter = filter();
        assertEquals(200, send(filter, "GET", "/api/a", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/b", "10.0.0.1"));
        assertEquals(429, send(filter, "GET", "/api/c", "10.0.0.1"));
        assertEquals(200, send(filter, "GET", "/api/c", "10.0.0.2"));
    }

    @Test
    void oneIpv6SlashSixtyFourIsOneClient() throws Exception {
        properties.setLoginLimit(1);
        RateLimitFilter filter = filter();
        assertEquals(200, send(filter, "POST", "/api/auth/login", "2001:db8:1:2::1"));
        assertEquals(429, send(filter, "POST", "/api/auth/login", "2001:db8:1:2:aaaa:bbbb:cccc:dddd"));
        assertEquals(200, send(filter, "POST", "/api/auth/login", "2001:db8:1:3::1"));
    }

    @Test
    void limitKeys() {
        assertEquals("203.0.113.9", ClientIpResolver.limitKey("203.0.113.9"));
        assertEquals("2001:db8:1:2::/64", ClientIpResolver.limitKey("2001:0db8:0001:0002:ffff::1"));
        assertEquals("2001:db8:1:2::/64", ClientIpResolver.limitKey("2001:db8:1:2::1%eth0"));
        assertEquals("203.0.113.9", ClientIpResolver.limitKey("::ffff:203.0.113.9"));
    }
}
