package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.ExamSessionDto;
import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.dto.SessionAnswerDto;
import com.exam_prep.api.entity.SessionSettings;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.ExamSessionService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExamSessionController {

    private final ExamSessionService examSessionService;
    private final UserService userService;

    private UserEntity getAuthenticatedUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @PostMapping("/study-areas/{id}/sessions")
    public ResponseEntity<ExamSessionDto> startSession(
            @PathVariable UUID id,
            @RequestBody(required = false) SessionSettings settings,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(examSessionService.startSession(id, settings, user));
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<ExamSessionDto> getSessionState(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(examSessionService.getSessionState(id, user));
    }

    @PostMapping("/sessions/{id}/answers")
    public ResponseEntity<SessionAnswerDto> submitAnswer(
            @PathVariable UUID id,
            @RequestBody Map<String, UUID> body,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        UUID questionId = body.get("questionId");
        UUID optionId = body.get("optionId");
        return ResponseEntity.ok(examSessionService.submitAnswer(id, questionId, optionId, user));
    }

    @PostMapping("/sessions/{id}/complete")
    public ResponseEntity<ExamSessionDto> completeSession(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(examSessionService.completeSession(id, user));
    }

    @GetMapping("/sessions/{id}/result")
    public ResponseEntity<ExamSessionDto> getSessionResult(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(examSessionService.getSessionResult(id, user));
    }

    @PostMapping("/sessions/{id}/practice-wrong")
    public ResponseEntity<ExamSessionDto> practiceWrong(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(examSessionService.startWrongAnswersPractice(id, user));
    }

    @GetMapping("/sessions/{id}/comparison")
    public ResponseEntity<RetentionDtos.SessionComparison> getComparison(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(examSessionService.getSessionComparison(id, user));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ExamSessionDto>> getMySessions(Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(examSessionService.getMySessions(user));
    }
}
