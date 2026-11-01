package com.exam_prep.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChapterDto {
    private UUID id;
    @Size(max = ContentLimits.TITLE)
    private String title;
    private UUID studyAreaId;
    private Integer orderIndex;
    private ZonedDateTime createdAt;
}
