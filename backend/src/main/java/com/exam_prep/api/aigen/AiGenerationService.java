package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.AiDtos.GeneratedQuestion;
import com.exam_prep.api.aigen.AiDtos.JobResponse;
import com.exam_prep.api.aigen.AiDtos.QuotaInfo;
import com.exam_prep.api.aigen.AiDtos.StatusResponse;
import com.exam_prep.api.aigen.AiGenerationJobEntity.Status;
import com.exam_prep.api.aigen.AiSettingsService.Settings;
import com.exam_prep.api.dto.OptionImportDto;
import com.exam_prep.api.dto.QuestionImportDto;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.service.StudyAreaService;
import com.exam_prep.api.user.UserEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiGenerationService {

    private static final int MAX_ATTEMPTS = 3;

    private final AiSettingsService settingsService;
    private final AiPdfValidator pdfValidator;
    private final AiJobReservationService reservations;
    private final AiGenerationJobRepository jobs;
    private final AiGenerationWorker worker;
    private final StudyAreaRepository studyAreaRepository;
    private final StudyAreaService studyAreaService;
    private final ObjectMapper objectMapper;

    private final Cache<String, Bucket> rateLimits = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(2)).maximumSize(100_000).build();

    public StatusResponse status(UUID studyAreaId, UserEntity user) {
        requireEditableArea(studyAreaId, user);
        Settings s = settingsService.load();
        QuotaInfo quota = new QuotaInfo(
                s.quota(),
                reservations.usedQuota(user.getId()),
                AiJobReservationService.WINDOW_DAYS,
                reservations.nextAvailableAt(user.getId()));
        boolean available = settingsService.isOperational(s);
        return new StatusResponse(available, available ? providerName(s.provider()) : null, quota);
    }

    public JobResponse create(UUID studyAreaId, MultipartFile file, boolean consent, UserEntity user) {
        requireEditableArea(studyAreaId, user);
        String filename = safeFilename(file);
        return launch(file, consent, user, () -> AiGenerationJobEntity.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .studyAreaId(studyAreaId)
                .originalFilename(filename)
                .attempts(1)
                .costUsd(BigDecimal.ZERO)
                .consentAt(ZonedDateTime.now())
                .createdAt(ZonedDateTime.now())
                .build());
    }

    /** The PDF is not kept after an attempt, so a retry uploads it again (the page resends it automatically). */
    public JobResponse retry(UUID jobId, MultipartFile file, boolean consent, UserEntity user) {
        AiGenerationJobEntity existing = requireOwned(jobId, user);
        if (existing.getStudyAreaId() == null) {
            throw new AppException("Study area not found", HttpStatus.NOT_FOUND);
        }
        requireEditableArea(existing.getStudyAreaId(), user);
        return launch(file, consent, user, () -> {
            AiGenerationJobEntity job = jobs.findByIdAndUserId(jobId, user.getId())
                    .orElseThrow(() -> new AppException("Generation not found", HttpStatus.NOT_FOUND));
            if (job.getStatus() != Status.FAILED) {
                throw new AiGenException(AiErrorCode.AI_INVALID_STATE, HttpStatus.CONFLICT);
            }
            if (job.getAttempts() >= MAX_ATTEMPTS) {
                throw new AiGenException(AiErrorCode.AI_RETRY_LIMIT, HttpStatus.CONFLICT);
            }
            job.setAttempts(job.getAttempts() + 1);
            job.setConsentAt(ZonedDateTime.now());
            return job;
        });
    }

    private JobResponse launch(MultipartFile file, boolean consent, UserEntity user,
                               java.util.function.Supplier<AiGenerationJobEntity> jobSupplier) {
        Settings settings = requireOperational();
        if (!consent) {
            throw new AiGenException(AiErrorCode.AI_CONSENT_REQUIRED, HttpStatus.BAD_REQUEST);
        }
        pdfValidator.checkUpload(file);
        consumeRateLimit(user.getId(), settings.rateLimitPerHour());

        Path pdf = null;
        boolean handedOff = false;
        try {
            pdf = worker.newTempFile();
            file.transferTo(pdf);
            int pages = pdfValidator.checkDocument(pdf);
            AiGenerationJobEntity job = reservations.reserve(user.getId(), settings, pages, jobSupplier);
            handedOff = true;
            worker.submit(job.getId(), pdf);
            return toResponse(jobs.findById(job.getId()).orElse(job));
        } catch (IOException e) {
            throw new AiGenException(AiErrorCode.AI_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            if (!handedOff) {
                AiGenerationWorker.deleteQuietly(pdf);
            }
        }
    }

    public JobResponse get(UUID jobId, UserEntity user) {
        return toResponse(requireOwned(jobId, user));
    }

    /** Most recent generation still needing attention, so that a reopened page can resume it. */
    public JobResponse latestOpen(UUID studyAreaId, UserEntity user) {
        requireEditableArea(studyAreaId, user);
        return jobs.findFirstByStudyAreaIdAndUserIdOrderByCreatedAtDesc(studyAreaId, user.getId())
                .filter(j -> j.getStatus() == Status.QUEUED || j.getStatus() == Status.PROCESSING || j.getStatus() == Status.READY)
                .map(this::toResponse)
                .orElse(null);
    }

    /** Saves the reviewed questions through the regular import logic, atomically and at most once. */
    @Transactional
    public JobResponse approve(UUID jobId, List<QuestionImportDto> questions, UserEntity user) {
        AiGenerationJobEntity job = jobs.lockByIdAndUserId(jobId, user.getId())
                .orElseThrow(() -> new AppException("Generation not found", HttpStatus.NOT_FOUND));
        if (job.getStatus() != Status.READY) {
            throw new AiGenException(AiErrorCode.AI_INVALID_STATE, HttpStatus.CONFLICT);
        }
        if (job.getStudyAreaId() == null) {
            throw new AppException("Study area not found", HttpStatus.NOT_FOUND);
        }
        if (questions == null || questions.isEmpty()) {
            throw new AiGenException(AiErrorCode.AI_INVALID_QUESTION, HttpStatus.BAD_REQUEST);
        }
        if (questions.size() > AiQuestionPrompt.QUESTION_COUNT) {
            throw new AiGenException(AiErrorCode.AI_TOO_MANY_QUESTIONS, HttpStatus.BAD_REQUEST);
        }
        List<QuestionImportDto> safe = questions.stream()
                .map(AiGenerationService::toSafeImport)
                .toList();
        studyAreaService.importQuestions(job.getStudyAreaId(), safe, user);
        job.setStatus(Status.COMPLETED);
        job.setSavedCount(safe.size());
        job.setResultJson(null);
        return toResponse(jobs.save(job));
    }

    @Transactional
    public JobResponse discard(UUID jobId, UserEntity user) {
        AiGenerationJobEntity job = jobs.lockByIdAndUserId(jobId, user.getId())
                .orElseThrow(() -> new AppException("Generation not found", HttpStatus.NOT_FOUND));
        if (job.getStatus() != Status.READY && job.getStatus() != Status.FAILED) {
            throw new AiGenException(AiErrorCode.AI_INVALID_STATE, HttpStatus.CONFLICT);
        }
        job.setStatus(Status.DISCARDED);
        job.setResultJson(null);
        return toResponse(jobs.save(job));
    }

    /**
     * Prompt and explanation are rendered as HTML elsewhere in the app, while text from a PDF, the
     * model or this review is plain text. Escaping stops a crafted document from injecting markup.
     */
    private static QuestionImportDto toSafeImport(QuestionImportDto q) {
        if (q == null) {
            throw new AiGenException(AiErrorCode.AI_INVALID_QUESTION, HttpStatus.BAD_REQUEST);
        }
        StudyAreaService.validateImportItem(q);
        String chapter = q.getChapter() == null || q.getChapter().isBlank() ? null : q.getChapter().trim();
        if (AiOutputValidator.exceedsLimits(q.getPrompt(), q.getExplanation(), chapter, q.getOptions())) {
            throw new AiGenException(AiErrorCode.AI_INVALID_QUESTION, HttpStatus.BAD_REQUEST);
        }
        List<OptionImportDto> options = q.getOptions().stream()
                .map(o -> new OptionImportDto(o.getText().trim(), o.isCorrect()))
                .toList();
        return new QuestionImportDto(escapeHtml(q.getPrompt().trim()),
                q.getExplanation() == null ? null : escapeHtml(q.getExplanation().trim()), chapter, options);
    }

    private static String escapeHtml(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private Settings requireOperational() {
        Settings s = settingsService.load();
        if (!s.enabled()) {
            throw new AiGenException(AiErrorCode.AI_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (!settingsService.isConfigured(s)) {
            throw new AiGenException(AiErrorCode.AI_NOT_CONFIGURED, HttpStatus.SERVICE_UNAVAILABLE);
        }
        return s;
    }

    private void consumeRateLimit(UUID userId, int perHour) {
        int limit = Math.max(perHour, 1);
        Bucket bucket = rateLimits.get(userId + ":" + limit, k -> Bucket.builder()
                .addLimit(l -> l.capacity(limit).refillGreedy(limit, Duration.ofHours(1)))
                .build());
        if (perHour <= 0 || !bucket.tryConsume(1)) {
            throw new AiGenException(AiErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    /** Same rule as adding questions: the area's creator, or an administrator. */
    private void requireEditableArea(UUID studyAreaId, UserEntity user) {
        StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        if (!area.getCreatedBy().getId().equals(user.getId()) && !"ROLE_ADMIN".equals(user.getRole())) {
            throw new AppException("Only the creator of the study area can generate questions", HttpStatus.FORBIDDEN);
        }
    }

    /** Other users' jobs look exactly like jobs that do not exist. */
    private AiGenerationJobEntity requireOwned(UUID jobId, UserEntity user) {
        return jobs.findByIdAndUserId(jobId, user.getId())
                .orElseThrow(() -> new AppException("Generation not found", HttpStatus.NOT_FOUND));
    }

    private static String providerName(String provider) {
        return "openai".equals(provider) ? "OpenAI" : "Anthropic";
    }

    private static String safeFilename(MultipartFile file) {
        String name = file == null ? null : file.getOriginalFilename();
        if (name == null) {
            return "document.pdf";
        }
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "");
        return base.length() > 200 ? base.substring(base.length() - 200) : base;
    }

    private JobResponse toResponse(AiGenerationJobEntity job) {
        List<GeneratedQuestion> questions = null;
        if (job.getStatus() == Status.READY && job.getResultJson() != null) {
            try {
                questions = objectMapper.readValue(job.getResultJson(), new TypeReference<>() {});
            } catch (JsonProcessingException e) {
                throw new AiGenException(AiErrorCode.AI_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
        boolean failed = job.getStatus() == Status.FAILED;
        String message = null;
        if (failed && job.getErrorCode() != null) {
            message = AiErrorCode.valueOf(job.getErrorCode()).message();
        }
        return new JobResponse(job.getId(), job.getStudyAreaId(), job.getStatus().name(), job.getProgress(),
                job.getOriginalFilename(), job.getPageCount(), job.getAttempts(),
                failed && job.getAttempts() < MAX_ATTEMPTS, job.getErrorCode(), message,
                job.getSavedCount(), job.getCreatedAt(), questions);
    }
}
