package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.exam_prep.api.entity.ContactMessageStatusEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContactMessageStatusRepository extends JpaRepository<ContactMessageStatusEntity, UUID> {
    Optional<ContactMessageStatusEntity> findByName(String name);
    List<ContactMessageStatusEntity> findAllByOrderByCreatedAtDesc();
}
