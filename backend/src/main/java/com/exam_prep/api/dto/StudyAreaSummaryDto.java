package com.exam_prep.api.dto;

import com.exam_prep.api.entity.Visibility;
import com.exam_prep.api.user.PublicNames;
import com.exam_prep.api.user.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
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
    /** The creator's public name. Null when they have none: an email address is never shown in its place. */
    private String createdBy;
    /** Only sent to the creator and to staff. */
    private UUID createdById;
    /** The creator's own name and public name, kept until {@link #showTo} decides what the viewer may see. */
    @JsonIgnore
    private String creatorName;
    @JsonIgnore
    private String creatorPublicName;
    private ZonedDateTime createdAt;
    private Visibility visibility;
    private long questionCount;
    private boolean starred;
    private long starCount;

    public StudyAreaSummaryDto(UUID id, String title, String description, String creatorName, String creatorPublicName,
                               UUID createdById, ZonedDateTime createdAt, Visibility visibility, long questionCount,
                               long starCount) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.creatorName = creatorName;
        this.creatorPublicName = creatorPublicName;
        this.createdBy = PublicNames.of(creatorPublicName, creatorName);
        this.createdById = createdById;
        this.createdAt = createdAt;
        this.visibility = visibility;
        this.questionCount = questionCount;
        this.starCount = starCount;
    }

    /** Narrows the creator fields to what this viewer may see; null is an anonymous visitor. */
    public void showTo(UserEntity viewer) {
        this.createdBy = PublicNames.creatorName(creatorPublicName, creatorName, viewer);
        this.createdById = createdById == null ? null : PublicNames.creatorId(createdById, viewer);
    }
}
