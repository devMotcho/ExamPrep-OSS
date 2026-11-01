package com.exam_prep.api.dto;

import lombok.*;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChapterDto {
    private UUID id;
    private String title;
    private UUID studyAreaId;
    private Integer orderIndex;
    private ZonedDateTime createdAt;
}
