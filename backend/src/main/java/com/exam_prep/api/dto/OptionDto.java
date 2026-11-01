package com.exam_prep.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptionDto {
    private UUID id;
    @NotBlank(message = "Option text is required")
    @Size(max = ContentLimits.OPTION)
    private String text;
    private Boolean correct;
}
