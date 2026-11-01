package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.QuestionEntity;

import java.util.UUID;

public interface QuestionRepository extends JpaRepository<QuestionEntity, UUID> {
    long countByCreatedBy(com.exam_prep.api.user.UserEntity createdBy);
}
