package com.exam_prep.api.study;

import com.exam_prep.api.dto.ExamSessionDto;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

/** Study plan, readiness report and marks, available to every signed-in user. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StudyInsightsController {

    private final StudyPlanService planService;
    private final ReadinessService readinessService;
    private final QuestionMarkService markService;
    private final UserService userService;

    private UserEntity currentUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @GetMapping("/me/study-plan")
    public StudyPlanService.Plan plan(@RequestParam(required = false) UUID studyAreaId, Principal principal) {
        return planService.today(currentUser(principal), studyAreaId);
    }

    @PostMapping("/me/study-plan/start")
    public ResponseEntity<ExamSessionDto> startPlan(@RequestParam(required = false) UUID studyAreaId, Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planService.start(currentUser(principal), studyAreaId));
    }

    @GetMapping("/study-areas/{id}/readiness")
    public ReadinessService.Readiness readiness(@PathVariable UUID id, Principal principal) {
        return readinessService.readiness(id, currentUser(principal));
    }

    @GetMapping("/sessions/{id}/report")
    public ReadinessService.SessionReport sessionReport(@PathVariable UUID id, Principal principal) {
        return readinessService.sessionReport(id, currentUser(principal));
    }

    @GetMapping("/me/question-marks")
    public List<QuestionMarkService.Mark> listMarks(@RequestParam(required = false) UUID studyAreaId, Principal principal) {
        return markService.list(currentUser(principal), studyAreaId);
    }

    @PutMapping("/questions/{id}/mark")
    public QuestionMarkService.Mark mark(@PathVariable UUID id, Principal principal) {
        return markService.mark(id, currentUser(principal));
    }

    @PutMapping("/questions/{id}/note")
    public QuestionMarkService.Mark saveNote(@PathVariable UUID id, @RequestBody QuestionMarkService.NoteRequest request, Principal principal) {
        return markService.saveNote(id, request.note(), currentUser(principal));
    }

    @DeleteMapping("/question-marks/{id}/mark")
    public ResponseEntity<Void> unmark(@PathVariable UUID id, Principal principal) {
        markService.unmark(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/question-marks/{id}/note")
    public ResponseEntity<Void> deleteNote(@PathVariable UUID id, Principal principal) {
        markService.deleteNote(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/question-marks/{id}")
    public ResponseEntity<Void> deleteMark(@PathVariable UUID id, Principal principal) {
        markService.delete(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/study-areas/{id}/practice-marked")
    public ResponseEntity<ExamSessionDto> practiseMarked(@PathVariable UUID id, Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(markService.practiseMarked(id, currentUser(principal)));
    }
}
