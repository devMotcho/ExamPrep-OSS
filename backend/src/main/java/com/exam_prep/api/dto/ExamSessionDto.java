package com.exam_prep.api.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import com.exam_prep.api.entity.SessionSettings;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamSessionDto {
    private UUID id;
    private UUID studyAreaId;
    private String studyAreaTitle;
    private ZonedDateTime startedAt;
    private ZonedDateTime completedAt;
    private SessionSettings settings;
    private List<SessionAnswerDto> answers;
    private BigDecimal finalScore;
    private List<QuestionDto> questions;
    private int currentIndex;
    private UUID practiceOfSessionId;
    private String sessionKind;
}
