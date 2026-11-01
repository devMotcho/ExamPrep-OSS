package com.exam_prep.api.aigen;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiGenerationJobRepository extends JpaRepository<AiGenerationJobEntity, UUID> {

    Optional<AiGenerationJobEntity> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from AiGenerationJobEntity j where j.id = :id and j.userId = :userId")
    Optional<AiGenerationJobEntity> lockByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    Optional<AiGenerationJobEntity> findFirstByStudyAreaIdAndUserIdOrderByCreatedAtDesc(UUID studyAreaId, UUID userId);

    boolean existsByUserIdAndStatusIn(UUID userId, Collection<AiGenerationJobEntity.Status> statuses);

    /** A failed generation only uses up quota when it cost something or may have: its reservation is still held. */
    String COUNTS_TOWARD_QUOTA = "j.userId = :userId and j.createdAt >= :since and (j.status <> com.exam_prep.api.aigen.AiGenerationJobEntity$Status.FAILED "
            + "or j.costUsd > 0 or j.reservedUsd > 0)";

    @Query("select count(j) from AiGenerationJobEntity j where " + COUNTS_TOWARD_QUOTA)
    long countTowardQuota(@Param("userId") UUID userId, @Param("since") ZonedDateTime since);

    @Query("select min(j.createdAt) from AiGenerationJobEntity j where " + COUNTS_TOWARD_QUOTA)
    Optional<ZonedDateTime> oldestTowardQuota(@Param("userId") UUID userId, @Param("since") ZonedDateTime since);

    @Query("select coalesce(sum(j.costUsd + j.reservedUsd), 0) from AiGenerationJobEntity j where j.lastAttemptAt >= :since")
    BigDecimal sumSpendSince(@Param("since") ZonedDateTime since);

    List<AiGenerationJobEntity> findByStatusIn(Collection<AiGenerationJobEntity.Status> statuses);

    List<AiGenerationJobEntity> findByStatusInAndUpdatedAtBefore(Collection<AiGenerationJobEntity.Status> statuses, ZonedDateTime before);

    @Modifying
    @Transactional
    @Query("update AiGenerationJobEntity j set j.progress = :progress, j.updatedAt = :now where j.id = :id and j.status = com.exam_prep.api.aigen.AiGenerationJobEntity$Status.PROCESSING")
    int updateProgress(@Param("id") UUID id, @Param("progress") int progress, @Param("now") ZonedDateTime now);
}
