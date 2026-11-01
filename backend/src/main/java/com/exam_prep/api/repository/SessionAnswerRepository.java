package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.SessionAnswerEntity;

import java.util.Optional;
import java.util.UUID;

public interface SessionAnswerRepository extends JpaRepository<SessionAnswerEntity, UUID> {
    Optional<SessionAnswerEntity> findBySessionIdAndQuestionId(UUID sessionId, UUID questionId);
}
