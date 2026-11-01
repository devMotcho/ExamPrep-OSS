package com.exam_prep.api.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionSettings {
    private boolean showAnswerPerQuestion;
    private boolean allowBack;
    private double discountFactor;
    private double passingScore;
    private int examDurationMinutes;
    private List<UUID> selectedChapterIds;
    private List<UUID> selectedQuestionIds;
    private Map<UUID, Integer> chapterQuestionCounts;
    /** "SIMULATION" when the exam setup asked for one. The server decides whether the session really counts as one. */
    private String preset;
}


