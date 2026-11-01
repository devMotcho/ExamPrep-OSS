package com.exam_prep.api.entity;

import lombok.*;
import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserStudyAreaId implements Serializable {
    private UUID userId;
    private UUID studyAreaId;
}
