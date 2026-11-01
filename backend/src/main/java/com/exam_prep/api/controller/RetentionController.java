package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.RetentionService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RetentionController {

    private final RetentionService retentionService;
    private final UserService userService;

    private UserEntity getAuthenticatedUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @GetMapping("/me/progress")
    public ResponseEntity<List<RetentionDtos.AreaProgress>> getProgress(Principal principal) {
        return ResponseEntity.ok(retentionService.getProgress(getAuthenticatedUser(principal)));
    }

    @GetMapping("/me/retention")
    public ResponseEntity<RetentionDtos.RetentionState> getRetention(Principal principal) {
        return ResponseEntity.ok(retentionService.getState(getAuthenticatedUser(principal)));
    }

    @PutMapping("/me/retention/settings")
    public ResponseEntity<RetentionDtos.RetentionState> updateSettings(
            @RequestBody RetentionDtos.RetentionSettingsRequest request,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
            Principal principal) {
        return ResponseEntity.ok(retentionService.updateSettings(getAuthenticatedUser(principal), request, acceptLanguage));
    }

    @PutMapping("/study-areas/{id}/exam-date")
    public ResponseEntity<RetentionDtos.RetentionState> setExamDate(
            @PathVariable UUID id, @RequestBody RetentionDtos.ExamDateRequest request, Principal principal) {
        return ResponseEntity.ok(retentionService.setExamDate(getAuthenticatedUser(principal), id, request.examDate()));
    }

    @DeleteMapping("/study-areas/{id}/exam-date")
    public ResponseEntity<RetentionDtos.RetentionState> clearExamDate(@PathVariable UUID id, Principal principal) {
        return ResponseEntity.ok(retentionService.clearExamDate(getAuthenticatedUser(principal), id));
    }

    @GetMapping("/study-areas/popular")
    public ResponseEntity<RetentionDtos.PopularArea> getPopularArea() {
        return retentionService.mostPopularArea()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
