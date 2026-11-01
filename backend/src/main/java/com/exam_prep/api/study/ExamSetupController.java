package com.exam_prep.api.study;

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

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExamSetupController {

    private final ExamSetupService setupService;
    private final UserService userService;

    private UserEntity currentUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @GetMapping("/study-areas/{id}/exam-setups")
    public List<ExamSetupService.Setup> listSetups(@PathVariable UUID id, Principal principal) {
        return setupService.listSetups(id, currentUser(principal));
    }

    @PostMapping("/study-areas/{id}/exam-setups")
    public ExamSetupService.Setup createSetup(@PathVariable UUID id,
                                                   @RequestBody ExamSetupService.SetupRequest request,
                                                   Principal principal) {
        return setupService.createSetup(id, request, currentUser(principal));
    }

    public record DefaultRequest(boolean isDefault) {}

    @PutMapping("/exam-setups/{id}/default")
    public ResponseEntity<Void> setDefault(@PathVariable UUID id, @RequestBody DefaultRequest request, Principal principal) {
        setupService.setDefault(id, request.isDefault(), currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/exam-setups/{id}")
    public ResponseEntity<Void> deleteSetup(@PathVariable UUID id, Principal principal) {
        setupService.deleteSetup(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }
}
