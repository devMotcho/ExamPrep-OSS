package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.ChapterEntity;

import java.util.List;
import java.util.UUID;

public interface ChapterRepository extends JpaRepository<ChapterEntity, UUID> {
    List<ChapterEntity> findByStudyAreaIdOrderByCreatedAtAsc(UUID studyAreaId);
    java.util.Optional<ChapterEntity> findByStudyAreaIdAndTitleIgnoreCase(UUID studyAreaId, String title);
}
