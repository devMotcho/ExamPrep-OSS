package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.exception.AppException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

class UploadLimitServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UploadLimitService service = new UploadLimitService(jdbc);
    private final UUID user = UUID.randomUUID();

    private static MockMultipartFile ofBytes(int size) {
        return new MockMultipartFile("file", new byte[size]);
    }

    private void limits(int mb, int perDay) {
        ReflectionTestUtils.setField(service, "maxMb", mb);
        ReflectionTestUtils.setField(service, "maxPerDay", perDay);
    }

    @BeforeEach
    void defaults() {
        limits(1, 5);
    }

    @Test
    void oversizedFileIs413AndDoesNotCount() {
        AppException e = assertThrows(AppException.class, () -> service.enforce(ofBytes(1024 * 1024 + 1), user));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, e.getStatus());
        assertTrue(e.getMessage().contains("1 MB"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void fileAtTheLimitIsAccepted() {
        when(jdbc.update(anyString(), any(), any(), any())).thenReturn(1);
        service.enforce(ofBytes(1024 * 1024), user);
    }

    @Test
    void exhaustedDayIs429() {
        when(jdbc.update(anyString(), any(), any(), any())).thenReturn(0);
        AppException e = assertThrows(AppException.class, () -> service.enforce(ofBytes(10), user));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
        assertTrue(e.getMessage().contains("5 uploads per day"));
    }

    @Test
    void zeroTurnsLimitsOff() {
        limits(0, 0);
        service.enforce(ofBytes(5 * 1024 * 1024), user);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
}
