package com.exam_prep.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.UUID;

import com.exam_prep.api.user.UserEntity;

@Entity
@Table(name = "user_study_areas")
@IdClass(UserStudyAreaId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserStudyAreaEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "study_area_id")
    private UUID studyAreaId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_area_id", insertable = false, updatable = false)
    private StudyAreaEntity studyArea;

    @Column(name = "joined_at", nullable = false)
    private ZonedDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = ZonedDateTime.now();
    }
}
