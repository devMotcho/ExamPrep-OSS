package com.exam_prep.api.user.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class OAuthExchangeServiceTest {

    private final OAuthExchangeService service = new OAuthExchangeService();
    private final UUID user = UUID.randomUUID();

    @Test
    void aCodeWorksOnce() {
        OAuthExchangeService.Issued issued = service.issue(user);
        assertEquals(user, service.consume(issued.code(), issued.binding()).orElseThrow());
        assertTrue(service.consume(issued.code(), issued.binding()).isEmpty());
    }

    @Test
    void aCodeNeedsTheCookieFromTheSameRedirect() {
        OAuthExchangeService.Issued issued = service.issue(user);
        assertTrue(service.consume(issued.code(), "another-browser").isEmpty());
        assertTrue(service.consume(issued.code(), null).isEmpty());
    }

    @Test
    void anUnknownCodeIsRefused() {
        assertTrue(service.consume("made-up", "made-up").isEmpty());
        assertTrue(service.consume(null, null).isEmpty());
    }
}
