package com.exam_prep.api.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionImportDto {
    private String prompt;
    private String explanation;
    private String chapter;
    private List<OptionImportDto> options;
}
