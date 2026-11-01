package com.exam_prep.api.dto;

import lombok.*;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionAnswerDto {
    private UUID id;
    private UUID questionId;
    private UUID selectedOptionId;
    private ZonedDateTime answeredAt;
    private boolean correct;
    
    private UUID correctOptionId;
    private String explanation;
}
