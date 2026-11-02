package com.exam_prep.api.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.exam_prep.api.dto.StudyAreaSummaryDto;
import com.exam_prep.api.entity.StudyAreaEntity;

import java.util.List;
import java.util.UUID;

public interface StudyAreaRepository extends JpaRepository<StudyAreaEntity, UUID> {

    String SUMMARY = "select new com.exam_prep.api.dto.StudyAreaSummaryDto(s.id, s.title, s.description, u.name, u.publicName, u.id, "
            + "s.createdAt, s.visibility, "
            + "(select count(q) from QuestionEntity q where q.studyArea = s), "
            + "(select count(j) from UserStudyAreaEntity j where j.studyAreaId = s.id)) "
            + "from StudyAreaEntity s join s.createdBy u ";

    String VISIBLE = "(s.visibility = com.exam_prep.api.entity.Visibility.PUBLIC or u.id = :userId "
            + "or exists (select 1 from UserStudyAreaEntity m where m.studyAreaId = s.id and m.userId = :userId)) "
            + "and (:search = '' or lower(s.title) like :search escape '\\' or lower(s.description) like :search escape '\\') ";

    /** Most starred and largest first. An anonymous visitor passes an id that belongs to nobody. */
    @Query(value = SUMMARY + "where " + VISIBLE
            + "order by ((select count(j) from UserStudyAreaEntity j where j.studyAreaId = s.id) * 10 "
            + "+ (select count(q) from QuestionEntity q where q.studyArea = s)) desc, s.createdAt desc",
            countQuery = "select count(s) from StudyAreaEntity s join s.createdBy u where " + VISIBLE)
    Page<StudyAreaSummaryDto> findVisibleSummaries(@Param("userId") UUID userId, @Param("search") String search, Pageable pageable);

    @Query(SUMMARY + "where u.id = :userId "
            + "or exists (select 1 from UserStudyAreaEntity m where m.studyAreaId = s.id and m.userId = :userId) "
            + "order by s.createdAt desc")
    List<StudyAreaSummaryDto> findJoinedOrCreatedSummaries(@Param("userId") UUID userId);

    @Query(SUMMARY + "order by s.createdAt desc")
    List<StudyAreaSummaryDto> findAllSummaries();

    long countByCreatedById(UUID userId);
}
