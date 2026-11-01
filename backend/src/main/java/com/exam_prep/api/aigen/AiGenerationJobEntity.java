package com.exam_prep.api.aigen;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_generation_jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiGenerationJobEntity {

    public enum Status { QUEUED, PROCESSING, READY, FAILED, COMPLETED, DISCARDED, EXPIRED }

    @Id
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "study_area_id")
    private UUID studyAreaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(nullable = false)
    private int progress;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private String model;

    @Column(name = "original_filename")
    private String originalFilename;

    @Column(name = "page_count", nullable = false)
    private int pageCount;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    @Column(name = "cost_usd", nullable = false)
    private BigDecimal costUsd;

    @Column(name = "reserved_usd", nullable = false)
    private BigDecimal reservedUsd;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "saved_count")
    private Integer savedCount;

    @Column(name = "consent_at", nullable = false)
    private ZonedDateTime consentAt;

    @Column(name = "created_at", nullable = false)
    private ZonedDateTime createdAt;

    @Column(name = "last_attempt_at", nullable = false)
    private ZonedDateTime lastAttemptAt;

    @Column(name = "updated_at", nullable = false)
    private ZonedDateTime updatedAt;

    @PreUpdate
    @PrePersist
    void touch() {
        updatedAt = ZonedDateTime.now();
    }

    /** Result is excluded on purpose: it holds document-derived content. */
    @Override
    public String toString() {
        return "AiGenerationJob[" + id + ", " + status + "]";
    }
}
