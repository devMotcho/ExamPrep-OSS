package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.ExamSessionEntity;

import java.util.List;
import java.util.UUID;

public interface ExamSessionRepository extends JpaRepository<ExamSessionEntity, UUID> {
    List<ExamSessionEntity> findByUserIdOrderByStartedAtDesc(UUID userId);
    java.util.Optional<ExamSessionEntity> findFirstByUserAndStudyAreaAndCompletedAtIsNull(com.exam_prep.api.user.UserEntity user, com.exam_prep.api.entity.StudyAreaEntity studyArea);
    java.util.Optional<ExamSessionEntity> findFirstByUserIdAndStudyAreaIdAndSessionKindNotInAndCompletedAtBeforeOrderByCompletedAtDesc(UUID userId, UUID studyAreaId, java.util.Collection<String> kinds, java.time.ZonedDateTime before);
    long countByUserIdAndCompletedAtIsNotNull(UUID userId);
}
