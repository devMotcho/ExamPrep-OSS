package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.exam_prep.api.entity.ConfirmationCodeEntity;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConfirmationCodeRepository extends JpaRepository<ConfirmationCodeEntity, UUID> {
    Optional<ConfirmationCodeEntity> findTopByEmailAndCodeOrderByCreatedAtDesc(String email, String code);
    void deleteByEmail(String email);
}
