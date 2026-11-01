package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.StudyAreaDto;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.StudyAreaService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/study-areas")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_DEV')")
public class AdminStudyAreaController {

    private final StudyAreaService studyAreaService;
    private final UserService userService;

    private UserEntity getAuthenticatedUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @GetMapping
    public ResponseEntity<List<StudyAreaDto>> getAllStudyAreas(Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(studyAreaService.listAllForAdmin(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStudyArea(@PathVariable UUID id, Principal principal) {
        UserEntity user = getAuthenticatedUser(principal);
        studyAreaService.deleteStudyArea(id, user);
        return ResponseEntity.noContent().build();
    }
}
