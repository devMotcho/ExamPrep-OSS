package com.exam_prep.api.dto;

import com.exam_prep.api.entity.Visibility;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.UUID;

/** A study area in a list: everything needed to show a card, and none of its questions. */
@Data
@NoArgsConstructor
public class StudyAreaSummaryDto {
    private UUID id;
    private String title;
    private String description;
    /** The creator's name. Null when they have none: an email address is never shown in its place. */
    private String createdBy;
    private UUID createdById;
    private ZonedDateTime createdAt;
    private Visibility visibility;
    private long questionCount;
    private boolean starred;
    private long starCount;

    public StudyAreaSummaryDto(UUID id, String title, String description, String createdBy, UUID createdById,
                               ZonedDateTime createdAt, Visibility visibility, long questionCount, long starCount) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.createdBy = createdBy == null || createdBy.isBlank() ? null : createdBy;
        this.createdById = createdById;
        this.createdAt = createdAt;
        this.visibility = visibility;
        this.questionCount = questionCount;
        this.starCount = starCount;
    }
}
