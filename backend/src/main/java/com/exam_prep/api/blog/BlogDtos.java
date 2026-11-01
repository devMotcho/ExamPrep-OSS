package com.exam_prep.api.blog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

public final class BlogDtos {

    private BlogDtos() {
    }

    public record PostRequest(
            @NotBlank @Size(max = 160) String title,
            @NotBlank @Size(max = 120) @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "Use lowercase letters, numbers and hyphens.") String slug,
            @NotBlank @Pattern(regexp = "^(pt|en)$") String locale,
            @Size(max = 300) String excerpt,
            @Size(max = 200000) String contentMd,
            @Size(max = 50) @Pattern(regexp = "^[a-z0-9-]*$") String featureKey,
            @NotBlank @Pattern(regexp = "^(DRAFT|PUBLISHED)$") String status,
            @Size(max = 500) @Pattern(regexp = "^(/api/blog/media/[0-9a-f-]+|https://\\S+)?$") String coverUrl
    ) {
    }

    public record PostSummary(UUID id, String slug, String locale, String title, String excerpt, String featureKey,
                              String status, String authorName, int readingMinutes, ZonedDateTime publishedAt,
                              ZonedDateTime updatedAt, String coverUrl) {
    }

    public record PostDetail(UUID id, String slug, String locale, String title, String excerpt, String contentMd,
                             String featureKey, String status, String authorName, int readingMinutes,
                             ZonedDateTime publishedAt, ZonedDateTime updatedAt, List<String> translations, String coverUrl) {
    }

    public record MediaResponse(String url, String contentType) {
    }
}
