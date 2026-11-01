package com.exam_prep.api.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptionImportDto {
    private String text;
    private boolean correct;
}
