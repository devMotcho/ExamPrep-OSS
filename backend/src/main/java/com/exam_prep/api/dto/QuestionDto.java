package com.exam_prep.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionDto {
    private UUID id;
    @Size(max = ContentLimits.RICH_TEXT)
    private String prompt;
    @Size(max = ContentLimits.IMAGE_URL)
    private String imageUrl;
    @Size(max = ContentLimits.RICH_TEXT)
    private String explanation;
    private UUID correctOptionId;
    private UUID chapterId;
    private Integer orderIndex;
    @Size(max = ContentLimits.MAX_OPTIONS)
    private List<@Valid OptionDto> options;
}
