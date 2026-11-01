package com.exam_prep.api.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionDto {
    private UUID id;
    private String prompt;
    private String imageUrl;
    private String explanation;
    private UUID correctOptionId;
    private UUID chapterId;
    private Integer orderIndex;
    private List<OptionDto> options;
}
