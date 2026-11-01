package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.exam_prep.api.entity.StudyAreaEntity;

import java.util.List;
import java.util.UUID;

public interface StudyAreaRepository extends JpaRepository<StudyAreaEntity, UUID> {

    @Query("SELECT DISTINCT s FROM StudyAreaEntity s " +
           "LEFT JOIN UserStudyAreaEntity u ON u.studyAreaId = s.id " +
           "WHERE s.visibility = com.exam_prep.api.entity.Visibility.PUBLIC " +
           "OR s.createdBy.id = :userId " +
           "OR u.userId = :userId " +
           "ORDER BY s.createdAt DESC")
    List<StudyAreaEntity> findAllPublicOrUserOwn(@Param("userId") UUID userId);

    @Query("SELECT s FROM StudyAreaEntity s " +
           "WHERE s.visibility = com.exam_prep.api.entity.Visibility.PUBLIC " +
           "ORDER BY s.createdAt DESC")
    List<StudyAreaEntity> findAllPublic();

    @Query("SELECT DISTINCT s FROM StudyAreaEntity s " +
           "LEFT JOIN UserStudyAreaEntity u ON u.studyAreaId = s.id " +
           "WHERE s.createdBy.id = :userId " +
           "OR u.userId = :userId " +
           "ORDER BY s.createdAt DESC")
    List<StudyAreaEntity> findAllJoinedOrCreatedBy(@Param("userId") UUID userId);
}
