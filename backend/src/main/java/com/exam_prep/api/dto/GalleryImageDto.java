package com.exam_prep.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class GalleryImageDto {
    private UUID id;
    private String filename;
    private String folder;
    private ZonedDateTime uploadedAt;
    private String url;
}
