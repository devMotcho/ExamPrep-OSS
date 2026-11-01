package com.exam_prep.api.security;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class JsonBodyLimitFilterTest {

    private static final int LIMIT = JsonBodyLimitFilter.MAX_BODY_BYTES;

    private final MockFilterChain chain = new MockFilterChain();
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    /** Mimics chunked transfer: a body without a declared length. */
    private static MockHttpServletRequest chunked(byte[] body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login") {
            @Override
            public int getContentLength() {
                return -1;
            }

            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        request.setContentType("application/json");
        request.addHeader("Transfer-Encoding", "chunked");
        request.setContent(body);
        return request;
    }

    private static MockHttpServletRequest declared(String contentType, int size) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setContentType(contentType);
        request.setContent(new byte[size]);
        return request;
    }

    private void run(HttpServletRequest request) throws Exception {
        new JsonBodyLimitFilter().doFilter(request, response, chain);
    }

    @Test
    void aBodyAtTheLimitPasses() throws Exception {
        run(declared("application/json", LIMIT));
        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void aLargerBodyIsRefused() throws Exception {
        run(declared("application/json", LIMIT + 1));
        assertEquals(413, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void aMissingContentTypeDoesNotHelp() throws Exception {
        run(declared(null, LIMIT + 1));
        assertEquals(413, response.getStatus());
    }

    @Test
    void aTextContentTypeDoesNotHelp() throws Exception {
        run(declared("text/plain", LIMIT + 1));
        assertEquals(413, response.getStatus());
    }

    @Test
    void multipartHasItsOwnLimits() throws Exception {
        run(declared("Multipart/Form-Data; boundary=x", LIMIT + 1));
        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void anUndeclaredLengthIsCountedToo() throws Exception {
        run(chunked(new byte[LIMIT + 1]));
        assertEquals(413, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void anUndeclaredLengthWithinTheLimitStaysReadable() throws Exception {
        byte[] body = "{\"email\":\"a@example.com\"}".getBytes();
        run(chunked(body));
        assertEquals(200, response.getStatus());
        assertArrayEquals(body, chain.getRequest().getInputStream().readAllBytes());
    }

    @Test
    void aRequestWithoutABodyPasses() throws Exception {
        run(new MockHttpServletRequest("GET", "/api/api/study-areas"));
        assertEquals(200, response.getStatus());
    }

    @Test
    void itRunsBeforeTheSecurityChain() {
        assertEquals(Ordered.HIGHEST_PRECEDENCE, AnnotationUtils.findAnnotation(JsonBodyLimitFilter.class, Order.class).value());
    }
}
