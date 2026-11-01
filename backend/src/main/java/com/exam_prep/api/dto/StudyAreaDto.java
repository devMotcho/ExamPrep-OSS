package com.exam_prep.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import com.exam_prep.api.entity.Visibility;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudyAreaDto {
    private UUID id;
    @NotBlank(message = "Title is required")
    @Size(max = ContentLimits.TITLE)
    private String title;
    @Size(max = ContentLimits.DESCRIPTION)
    private String description;
    private String createdBy;
    private UUID createdById;
    private ZonedDateTime createdAt;
    private Visibility visibility;
    private int questionCount;
    private boolean starred;
    private long starCount;
    private List<QuestionDto> questions;
    private List<ChapterDto> chapters;
}
