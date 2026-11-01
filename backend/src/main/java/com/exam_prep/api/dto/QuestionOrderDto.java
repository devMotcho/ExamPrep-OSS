package com.exam_prep.api.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class QuestionOrderDto {
    private UUID id;
    private UUID chapterId;
    private int orderIndex;
}
