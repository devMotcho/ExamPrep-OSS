package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.AiDtos.GeneratedQuestion;
import com.exam_prep.api.aigen.AiGenerationJobEntity.Status;
import com.exam_prep.api.aigen.provider.GenerationOutcome;
import com.exam_prep.api.aigen.provider.GenerationRequest;
import com.exam_prep.api.aigen.provider.ProviderCallException;
import com.exam_prep.api.aigen.provider.ProviderRegistry;
import com.exam_prep.api.aigen.provider.QuestionGenerationProvider;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Runs generations on a small bounded pool (a request holds a whole PDF in memory while it is
 * sent). The temporary PDF is always deleted when the attempt ends, whatever the outcome. Logs
 * carry job ids, codes and exception classes only: never keys, PDF content or model output.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiGenerationWorker {

    private static final Path TEMP_DIR = Path.of(System.getProperty("java.io.tmpdir"), "examprep-ai-gen");
    /** Above the provider timeout (10 min) times its two attempts. */
    private static final long STALE_MINUTES = 30;
    private static final long UNREVIEWED_RETENTION_DAYS = 30;
    private static final long TYPICAL_OUTPUT_CHARS = 14_000;

    private final AiGenerationJobRepository jobs;
    private final AiSettingsService settingsService;
    private final ProviderRegistry providers;
    private final AiOutputValidator validator;
    private final ObjectMapper objectMapper;

    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(10), r -> new Thread(r, "ai-generation"));

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /** Private temp file (0600 in a 0700 directory). */
    public Path newTempFile() throws IOException {
        if (!Files.exists(TEMP_DIR)) {
            Files.createDirectories(TEMP_DIR, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        }
        return Files.createTempFile(TEMP_DIR, "upload-", ".pdf");
    }

    public static void deleteQuietly(Path file) {
        try {
            if (file != null) {
                Files.deleteIfExists(file);
            }
        } catch (IOException e) {
            log.warn("Could not delete a temporary AI generation file: {}", e.getClass().getSimpleName());
        }
    }

    /** Hands off the job; takes ownership of the temp file from this moment. */
    public void submit(UUID jobId, Path pdf) {
        try {
            executor.execute(() -> run(jobId, pdf));
        } catch (RejectedExecutionException e) {
            deleteQuietly(pdf);
            finishFailed(jobId, AiErrorCode.AI_BUSY, 0, 0);
        }
    }

    private void run(UUID jobId, Path pdf) {
        try {
            process(jobId, pdf);
        } catch (ProviderCallException e) {
            log.warn("AI job {} provider failure: code={} status={}", jobId, e.getCode(), e.getHttpStatus());
            finishFailed(jobId, e.getCode(), 0, 0);
        } catch (AiGenException e) {
            log.warn("AI job {} failed: code={}", jobId, e.getCode());
            finishFailed(jobId, e.getCode(), 0, 0);
        } catch (Throwable t) {
            log.error("AI job {} failed unexpectedly: {}", jobId, t.getClass().getName());
            finishFailed(jobId, AiErrorCode.AI_INTERNAL, 0, 0);
        } finally {
            deleteQuietly(pdf);
        }
    }

    private void process(UUID jobId, Path pdf) throws IOException {
        AiGenerationJobEntity job = jobs.findById(jobId).orElse(null);
        if (job == null || job.getStatus() != Status.QUEUED) {
            return;
        }
        job.setStatus(Status.PROCESSING);
        job.setProgress(10);
        job = jobs.save(job);

        QuestionGenerationProvider provider = providers.find(job.getProvider())
                .orElseThrow(() -> new AiGenException(AiErrorCode.AI_NOT_CONFIGURED, org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
        String apiKey = settingsService.decryptApiKey(job.getProvider());

        GenerationRequest request = new GenerationRequest(job.getModel(), Files.readAllBytes(pdf),
                AiQuestionPrompt.system(), AiQuestionPrompt.user(), AiQuestionPrompt.schema(),
                AiQuestionPrompt.MAX_OUTPUT_TOKENS);

        long[] lastWrite = {0};
        GenerationOutcome outcome = provider.generate(apiKey, request, chars -> {
            long now = System.currentTimeMillis();
            if (now - lastWrite[0] >= 2_000) {
                lastWrite[0] = now;
                int percent = (int) Math.min(95, 10 + chars * 85 / TYPICAL_OUTPUT_CHARS);
                jobs.updateProgress(jobId, percent, ZonedDateTime.now());
            }
        });

        long in = outcome.inputTokens();
        long out = outcome.outputTokens();
        switch (outcome.stop()) {
            case REFUSED -> finishFailed(jobId, AiErrorCode.AI_REFUSED, in, out);
            case TRUNCATED -> finishFailed(jobId, AiErrorCode.AI_TRUNCATED, in, out);
            case COMPLETE -> {
                try {
                    List<GeneratedQuestion> questions = validator.parse(outcome.text(), job.getPageCount());
                    finishReady(jobId, questions, in, out);
                } catch (AiOutputValidator.InvalidOutputException e) {
                    log.warn("AI job {} invalid output: {}", jobId, e.getMessage());
                    finishFailed(jobId, AiErrorCode.AI_OUTPUT_INVALID, in, out);
                }
            }
        }
    }

    private void finishReady(UUID jobId, List<GeneratedQuestion> questions, long in, long out) throws JsonProcessingException {
        String json = objectMapper.writeValueAsString(questions);
        update(jobId, in, out, job -> {
            job.setStatus(Status.READY);
            job.setProgress(100);
            job.setResultJson(json);
        });
    }

    /** Provider exceptions report no usage, so such an attempt records no cost and releases its reservation. */
    private void finishFailed(UUID jobId, AiErrorCode code, long in, long out) {
        update(jobId, in, out, job -> {
            job.setStatus(Status.FAILED);
            job.setErrorCode(code.name());
        });
    }

    private void update(UUID jobId, long in, long out, java.util.function.Consumer<AiGenerationJobEntity> change) {
        jobs.findById(jobId).ifPresent(job -> {
            if (job.getStatus() != Status.PROCESSING && job.getStatus() != Status.QUEUED) {
                return; // already closed by the stale-job sweep
            }
            change.accept(job);
            job.setInputTokens(job.getInputTokens() + in);
            job.setOutputTokens(job.getOutputTokens() + out);
            BigDecimal attemptCost = settingsService.load().pricing()
                    .filter(p -> in + out > 0)
                    .map(p -> AiJobReservationService.cost(p, in, out))
                    .orElse(BigDecimal.ZERO);
            job.setCostUsd(job.getCostUsd().add(attemptCost));
            job.setReservedUsd(BigDecimal.ZERO);
            jobs.save(job);
        });
    }

    /** Nothing survives a restart: the worker threads and queue are in memory. Single-instance deployment assumed. */
    @EventListener(ApplicationReadyEvent.class)
    public void recoverAfterRestart() {
        jobs.findByStatusIn(AiJobReservationService.ACTIVE).forEach(this::interrupt);
        cleanTempFiles(Instant.now());
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void sweep() {
        ZonedDateTime now = ZonedDateTime.now();
        jobs.findByStatusInAndUpdatedAtBefore(AiJobReservationService.ACTIVE, now.minusMinutes(STALE_MINUTES)).forEach(this::interrupt);
        jobs.findByStatusInAndUpdatedAtBefore(List.of(Status.READY), now.minusDays(UNREVIEWED_RETENTION_DAYS)).forEach(job -> {
            job.setStatus(Status.EXPIRED);
            job.setResultJson(null);
            jobs.save(job);
        });
        cleanTempFiles(Instant.now().minus(STALE_MINUTES + 10, ChronoUnit.MINUTES));
    }

    private void interrupt(AiGenerationJobEntity job) {
        job.setStatus(Status.FAILED);
        job.setErrorCode(AiErrorCode.AI_INTERRUPTED.name());
        job.setReservedUsd(BigDecimal.ZERO);
        jobs.save(job);
    }

    private void cleanTempFiles(Instant olderThan) {
        if (!Files.isDirectory(TEMP_DIR)) {
            return;
        }
        try (Stream<Path> files = Files.list(TEMP_DIR)) {
            files.filter(f -> {
                try {
                    return Files.getLastModifiedTime(f).toInstant().isBefore(olderThan);
                } catch (IOException e) {
                    return false;
                }
            }).forEach(AiGenerationWorker::deleteQuietly);
        } catch (IOException e) {
            log.warn("Could not clean AI generation temp files: {}", e.getClass().getSimpleName());
        }
    }
}
