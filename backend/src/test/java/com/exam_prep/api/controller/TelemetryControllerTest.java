package com.exam_prep.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.exam_prep.api.exception.GlobalExceptionHandler;
import com.exam_prep.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TelemetryControllerTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new TelemetryController(jdbc, mock(UserRepository.class)))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    private org.springframework.test.web.servlet.ResultActions visit(String body) throws Exception {
        return mvc.perform(post("/auth/telemetry/visit").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @ParameterizedTest
    @ValueSource(strings = {"3f2b8c1e-7a4d-4e9b-9c11-0a1b2c3d4e5f", "dev-abc123-1761998400000"})
    void acceptsWhatTheFrontendGenerates(String id) throws Exception {
        visit("{\"deviceId\":\"" + id + "\"}").andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"deviceId\":\"\"}", "{\"deviceId\":\"short\"}", "{\"deviceId\":\"has spaces in it\"}",
            "{\"deviceId\":\"<script>alert(1)</script>\"}", "not json", "{\"deviceId\":{\"a\":1}}"})
    void rejectsAnythingElseWithoutWriting(String body) throws Exception {
        visit(body).andExpect(status().isBadRequest());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsTooLongIds() throws Exception {
        visit("{\"deviceId\":\"" + "a".repeat(101) + "\"}").andExpect(status().isBadRequest());
    }
}
