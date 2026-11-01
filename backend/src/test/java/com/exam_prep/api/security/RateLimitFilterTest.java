package com.exam_prep.api.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    private int post(RateLimitFilter filter, String path) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("POST", path), response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void telemetryHasItsOwnLimit() throws Exception {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setTelemetryLimit(2);
        properties.setDefaultLimit(50);
        RateLimitFilter filter = new RateLimitFilter(new ClientIpResolver(), properties);
        String path = "/api/auth/telemetry/visit";

        assertEquals(200, post(filter, path));
        assertEquals(200, post(filter, path));
        assertEquals(429, post(filter, path));
    }
}
