package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.AiDtos.ApproveRequest;
import com.exam_prep.api.aigen.AiDtos.JobResponse;
import com.exam_prep.api.aigen.AiDtos.StatusResponse;
import com.exam_prep.api.aigen.AiDtos.TestConnectionResponse;
import com.exam_prep.api.aigen.AiDtos.UsageResponse;
import com.exam_prep.api.aigen.AiSettingsService.Settings;
import com.exam_prep.api.aigen.provider.ProviderCallException;
import com.exam_prep.api.aigen.provider.ProviderRegistry;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AiGenerationController {

    private final AiGenerationService service;
    private final AiSettingsService settingsService;
    private final AiJobReservationService reservations;
    private final ProviderRegistry providers;
    private final UserService userService;

    private UserEntity user(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }

    @GetMapping("/study-areas/{id}/ai-generation/status")
    public StatusResponse status(@PathVariable UUID id, Principal principal) {
        return service.status(id, user(principal));
    }

    @PostMapping("/study-areas/{id}/ai-generation/jobs")
    public ResponseEntity<JobResponse> create(@PathVariable UUID id,
                                              @RequestParam(value = "file", required = false) MultipartFile file,
                                              @RequestParam(value = "consent", defaultValue = "false") boolean consent,
                                              Principal principal) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.create(id, file, consent, user(principal)));
    }

    @GetMapping("/study-areas/{id}/ai-generation/jobs/open")
    public ResponseEntity<JobResponse> open(@PathVariable UUID id, Principal principal) {
        JobResponse job = service.latestOpen(id, user(principal));
        return job == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(job);
    }

    @GetMapping("/ai-generation/jobs/{jobId}")
    public JobResponse get(@PathVariable UUID jobId, Principal principal) {
        return service.get(jobId, user(principal));
    }

    @PostMapping("/ai-generation/jobs/{jobId}/retry")
    public ResponseEntity<JobResponse> retry(@PathVariable UUID jobId,
                                             @RequestParam(value = "file", required = false) MultipartFile file,
                                             @RequestParam(value = "consent", defaultValue = "false") boolean consent,
                                             Principal principal) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.retry(jobId, file, consent, user(principal)));
    }

    @PostMapping("/ai-generation/jobs/{jobId}/approve")
    public JobResponse approve(@PathVariable UUID jobId, @RequestBody ApproveRequest body, Principal principal) {
        return service.approve(jobId, body.questions(), user(principal));
    }

    @PostMapping("/ai-generation/jobs/{jobId}/discard")
    public JobResponse discard(@PathVariable UUID jobId, Principal principal) {
        return service.discard(jobId, user(principal));
    }

    /** Tests the saved provider, key and model. A failure is a normal result for this endpoint, not an HTTP error. */
    @PostMapping("/config/ai/test")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    public TestConnectionResponse testConnection() {
        Settings s = settingsService.load();
        try {
            if (!s.keyStored()) {
                return failure(s, AiErrorCode.AI_NOT_CONFIGURED);
            }
            var provider = providers.find(s.provider()).orElse(null);
            if (provider == null) {
                return failure(s, AiErrorCode.AI_NOT_CONFIGURED);
            }
            provider.testConnection(settingsService.decryptApiKey(s.provider()), s.model());
            if (s.pricing().isEmpty()) {
                return failure(s, AiErrorCode.AI_PRICING_UNKNOWN);
            }
            return new TestConnectionResponse(true, s.provider(), s.model(), null, null);
        } catch (ProviderCallException e) {
            return failure(s, e.getCode());
        } catch (AiGenException e) {
            return failure(s, e.getCode());
        }
    }

    private static TestConnectionResponse failure(Settings s, AiErrorCode code) {
        return new TestConnectionResponse(false, s.provider(), s.model(), code.name(), code.message());
    }

    @GetMapping("/config/ai/usage")
    @PreAuthorize("hasAnyRole('ADMIN','DEV')")
    public UsageResponse usage() {
        return new UsageResponse(reservations.spentThisMonth(), settingsService.load().spendCapUsd());
    }

    @ExceptionHandler(AiGenException.class)
    public ResponseEntity<Map<String, Object>> handle(AiGenException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage(), "code", e.getCode().name()));
    }
}
