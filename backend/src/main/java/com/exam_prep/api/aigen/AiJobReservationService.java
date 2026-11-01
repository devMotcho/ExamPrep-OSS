package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.AiGenerationJobEntity.Status;
import com.exam_prep.api.aigen.AiSettingsService.Settings;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Atomically checks concurrency, quota and spend cap, then books the job with a worst-case
 * cost reservation. A transaction-scoped advisory lock serialises this short section, so
 * simultaneous uploads cannot overshoot either limit.
 */
@Service
@RequiredArgsConstructor
public class AiJobReservationService {

    public static final int WINDOW_DAYS = 30;

    private static final long ADVISORY_LOCK = 7_240_041L;
    /** Conservative upper estimate of tokens per PDF page (text plus page image). */
    private static final long INPUT_TOKENS_PER_PAGE = 3_000L;
    private static final BigDecimal MILLION = new BigDecimal(1_000_000);
    static final List<Status> ACTIVE = List.of(Status.QUEUED, Status.PROCESSING);

    private final AiGenerationJobRepository jobs;
    private final JdbcTemplate jdbc;

    /** The supplier builds a new job or returns the failed job being retried, after every check has passed. */
    @Transactional
    public AiGenerationJobEntity reserve(UUID userId, Settings settings, int pageCount,
                                         Supplier<AiGenerationJobEntity> jobSupplier) {
        jdbc.query("SELECT pg_advisory_xact_lock(?)", rs -> null, ADVISORY_LOCK);

        if (jobs.existsByUserIdAndStatusIn(userId, ACTIVE)) {
            throw new AiGenException(AiErrorCode.AI_JOB_ACTIVE, HttpStatus.CONFLICT);
        }
        if (usedQuota(userId) >= settings.quota()) {
            throw new AiGenException(AiErrorCode.AI_QUOTA_EXCEEDED, HttpStatus.TOO_MANY_REQUESTS);
        }
        AiSettingsService.Pricing pricing = settings.pricing()
                .orElseThrow(() -> new AiGenException(AiErrorCode.AI_PRICING_UNKNOWN, HttpStatus.SERVICE_UNAVAILABLE));
        BigDecimal reservation = cost(pricing, pageCount * INPUT_TOKENS_PER_PAGE, AiQuestionPrompt.MAX_OUTPUT_TOKENS);
        BigDecimal projected = spentThisMonth().add(reservation);
        if (projected.compareTo(settings.spendCapUsd()) > 0) {
            throw new AiGenException(AiErrorCode.AI_SPEND_CAP_REACHED, HttpStatus.SERVICE_UNAVAILABLE);
        }

        AiGenerationJobEntity job = jobSupplier.get();
        ZonedDateTime now = ZonedDateTime.now();
        job.setStatus(Status.QUEUED);
        job.setProgress(0);
        job.setErrorCode(null);
        job.setProvider(settings.provider());
        job.setModel(settings.model());
        job.setPageCount(pageCount);
        // A retry: what an earlier attempt may have cost stays counted when the new reservation replaces it.
        if (job.getReservedUsd() != null) {
            job.setCostUsd(job.getCostUsd().add(job.getReservedUsd()));
        }
        job.setReservedUsd(reservation);
        job.setLastAttemptAt(now);
        return jobs.save(job);
    }

    public long usedQuota(UUID userId) {
        ZonedDateTime since = ZonedDateTime.now().minusDays(WINDOW_DAYS);
        return jobs.countTowardQuota(userId, since);
    }

    /** When the oldest counted generation leaves the window and frees one use; null if nothing is counted. */
    public ZonedDateTime nextAvailableAt(UUID userId) {
        return jobs.oldestTowardQuota(userId, ZonedDateTime.now().minusDays(WINDOW_DAYS))
                .map(createdAt -> createdAt.plusDays(WINDOW_DAYS))
                .orElse(null);
    }

    public BigDecimal spentThisMonth() {
        ZonedDateTime monthStart = ZonedDateTime.now(ZoneOffset.UTC)
                .with(TemporalAdjusters.firstDayOfMonth()).toLocalDate().atStartOfDay(ZoneOffset.UTC);
        return jobs.sumSpendSince(monthStart);
    }

    static BigDecimal cost(AiSettingsService.Pricing pricing, long inputTokens, long outputTokens) {
        return pricing.inputPerMtok().multiply(BigDecimal.valueOf(inputTokens))
                .add(pricing.outputPerMtok().multiply(BigDecimal.valueOf(outputTokens)))
                .divide(MILLION, 6, RoundingMode.HALF_UP);
    }
}
