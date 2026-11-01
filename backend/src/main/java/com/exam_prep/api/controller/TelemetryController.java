package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/auth/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    /** What the frontend generates: a UUID, or its "dev-..." fallback. 100 is the column's size. */
    private static final Pattern DEVICE_ID = Pattern.compile("[A-Za-z0-9_-]{8,100}");

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;

    @PostMapping("/visit")
    public ResponseEntity<Void> recordVisit(@RequestBody VisitRequest request) {
        if (request.getDeviceId() == null || !DEVICE_ID.matcher(request.getDeviceId()).matches()) {
            return ResponseEntity.badRequest().build();
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());
        
        UUID userId = null;
        if (isAuthenticated) {
            String email = auth.getName();
            userId = userRepository.findByEmail(email)
                    .map(UserEntity::getId)
                    .orElse(null);
        }

        jdbcTemplate.update(
            "INSERT INTO device_telemetry (device_id, is_authenticated, user_id, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
            "ON CONFLICT (device_id) DO UPDATE SET is_authenticated = EXCLUDED.is_authenticated, user_id = EXCLUDED.user_id, last_seen_at = CURRENT_TIMESTAMP",
            request.getDeviceId(), isAuthenticated, userId
        );

        return ResponseEntity.ok().build();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisitRequest {
        private String deviceId;
    }
}
