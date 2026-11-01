package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.UserStudyAreaEntity;
import com.exam_prep.api.entity.UserStudyAreaId;

import java.util.UUID;

public interface UserStudyAreaRepository extends JpaRepository<UserStudyAreaEntity, UserStudyAreaId> {
    boolean existsByUserIdAndStudyAreaId(UUID userId, UUID studyAreaId);
    long countByStudyAreaId(UUID studyAreaId);
    void deleteByUserIdAndStudyAreaId(UUID userId, UUID studyAreaId);

    @org.springframework.data.jpa.repository.Query("select u.studyAreaId from UserStudyAreaEntity u where u.userId = :userId")
    java.util.Set<UUID> findStudyAreaIdsByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);
}
