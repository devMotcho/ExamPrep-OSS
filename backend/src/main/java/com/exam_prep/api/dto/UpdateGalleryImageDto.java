package com.exam_prep.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class UpdateGalleryImageDto {
    @jakarta.validation.constraints.Size(max = ContentLimits.FILENAME)
    private String filename;


}
