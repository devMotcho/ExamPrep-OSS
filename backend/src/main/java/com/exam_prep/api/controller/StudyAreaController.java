package com.exam_prep.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.exam_prep.api.dto.ChapterDto;
import com.exam_prep.api.dto.PageResponse;
import com.exam_prep.api.dto.StudyAreaSummaryDto;
import com.exam_prep.api.dto.QuestionDto;
import com.exam_prep.api.dto.QuestionOrderDto;
import com.exam_prep.api.dto.ReorderRequest;
import com.exam_prep.api.dto.StudyAreaDto;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.StudyAreaService;
import com.exam_prep.api.service.UploadLimitService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StudyAreaController {

    private final StudyAreaService studyAreaService;
    private final UserService userService;
    private final UploadLimitService uploadLimitService;

    private UserEntity getAuthenticatedUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    private UserEntity getOptionalUser(Principal principal) {
        if (principal == null) {
            return null;
        }
        try {
            return userService.findByEmail(principal.getName());
        } catch (Exception e) {
            return null;
        }
    }

    @PostMapping("/study-areas")
    public ResponseEntity<StudyAreaDto> createStudyArea(@Valid @RequestBody StudyAreaDto dto, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(studyAreaService.createStudyArea(dto, user));
    }

    @GetMapping("/study-areas")
    public ResponseEntity<PageResponse<StudyAreaSummaryDto>> listStudyAreas(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(required = false) String q,
            Principal principal) {
        UserEntity user = getOptionalUser(principal);
        return ResponseEntity.ok(studyAreaService.listVisible(user, page, size, q));
    }

    @GetMapping("/study-areas/mine")
    public ResponseEntity<List<StudyAreaSummaryDto>> listMyStudyAreas(Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(studyAreaService.listUserJoinedOrCreated(user));
    }

    @GetMapping("/study-areas/{id}")
    public ResponseEntity<StudyAreaDto> getStudyAreaDetail(@PathVariable UUID id, Principal principal) {
        UserEntity user = getOptionalUser(principal);
        return ResponseEntity.ok(studyAreaService.getStudyAreaDetail(id, user));
    }

    @PutMapping("/study-areas/{id}")
    public ResponseEntity<StudyAreaDto> updateStudyArea(
            @PathVariable UUID id,
            @Valid @RequestBody StudyAreaDto dto,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(studyAreaService.updateStudyArea(id, dto, user));
    }

    @DeleteMapping("/study-areas/{id}")
    public ResponseEntity<Void> deleteStudyArea(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.deleteStudyArea(id, user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/study-areas/{id}/join")
    public ResponseEntity<Void> joinStudyArea(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.joinStudyArea(id, user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/study-areas/{id}/star")
    public ResponseEntity<Void> starStudyArea(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.joinStudyArea(id, user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/study-areas/{id}/unstar")
    public ResponseEntity<Void> unstarStudyArea(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.unstarStudyArea(id, user);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/study-areas/{id}/questions")
    public ResponseEntity<QuestionDto> addQuestion(
            @PathVariable UUID id,
            @Valid @RequestBody QuestionDto questionDto,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(studyAreaService.addQuestion(id, questionDto, user));
    }

    @PostMapping("/study-areas/{id}/questions/import")
    public ResponseEntity<List<QuestionDto>> importQuestions(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        uploadLimitService.enforce(file, user.getId());
        return ResponseEntity.ok(studyAreaService.bulkImport(id, file, user));
    }

    @PutMapping("/questions/{id}")
    public ResponseEntity<QuestionDto> editQuestion(
            @PathVariable UUID id,
            @Valid @RequestBody QuestionDto questionDto,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(studyAreaService.editQuestion(id, questionDto, user));
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<Void> deleteQuestion(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.deleteQuestion(id, user);
        return ResponseEntity.noContent().build();
    }

    // ── CHAPTERS ───────────────────────────────────────────────────────────────

    @GetMapping("/study-areas/{studyAreaId}/chapters")
    public ResponseEntity<List<ChapterDto>> listChapters(@PathVariable UUID studyAreaId,
            Principal principal) {
        // Applies the same visibility rules as the study area itself.
        studyAreaService.getStudyAreaDetail(studyAreaId, getOptionalUser(principal));
        return ResponseEntity.ok(studyAreaService.listChapters(studyAreaId));
    }

    @PostMapping("/study-areas/{studyAreaId}/chapters")
    public ResponseEntity<ChapterDto> createChapter(
            @PathVariable UUID studyAreaId,
            @Valid @RequestBody ChapterDto chapterDto,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(studyAreaService.createChapter(studyAreaId, chapterDto, user));
    }

    @PutMapping("/chapters/{chapterId}")
    public ResponseEntity<ChapterDto> editChapter(
            @PathVariable UUID chapterId,
            @Valid @RequestBody ChapterDto chapterDto,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(studyAreaService.editChapter(chapterId, chapterDto, user));
    }

    @DeleteMapping("/chapters/{chapterId}")
    public ResponseEntity<Void> deleteChapter(@PathVariable UUID chapterId, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.deleteChapter(chapterId, user);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/study-areas/{studyAreaId}/chapters/reorder")
    public ResponseEntity<Void> reorderChapters(
            @PathVariable UUID studyAreaId,
            @RequestBody ReorderRequest request,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.reorderChapters(studyAreaId, request.getItemIds(), user);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/study-areas/{studyAreaId}/questions/reorder")
    public ResponseEntity<Void> reorderQuestions(
            @PathVariable UUID studyAreaId,
            @RequestBody List<QuestionOrderDto> request,
            Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.reorderQuestions(studyAreaId, request, user);
        return ResponseEntity.ok().build();
    }
}
