package com.exam_prep.api.aigen;

import com.exam_prep.api.dto.OptionImportDto;
import com.exam_prep.api.dto.QuestionImportDto;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

public final class AiDtos {

    private AiDtos() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedQuestion(String prompt, String explanation, String chapter, Integer sourcePage,
                                    List<OptionImportDto> options) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeneratedPayload(List<GeneratedQuestion> questions) {}

    public record QuotaInfo(int limit, long used, int windowDays, java.time.ZonedDateTime nextAvailableAt) {}

    public record StatusResponse(boolean available, String providerName, QuotaInfo quota) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record JobResponse(UUID id, UUID studyAreaId, String status, int progress, String filename, int pageCount,
                              int attempts, boolean canRetry, String errorCode, String errorMessage,
                              Integer savedCount, ZonedDateTime createdAt, List<GeneratedQuestion> questions) {}

    public record ApproveRequest(List<QuestionImportDto> questions) {}

    public record TestConnectionResponse(boolean ok, String provider, String model, String code, String message) {}

    public record UsageResponse(java.math.BigDecimal spentThisMonthUsd, java.math.BigDecimal capUsd) {}
}
