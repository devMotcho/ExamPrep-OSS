package com.exam_prep.api.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
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
