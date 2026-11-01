package com.exam_prep.api.dto;

import lombok.*;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptionDto {
    private UUID id;
    private String text;
    private Boolean correct;
}
