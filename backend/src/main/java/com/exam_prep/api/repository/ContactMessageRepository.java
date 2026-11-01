package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.ContactMessageEntity;

import java.util.List;
import java.util.UUID;
import java.time.ZonedDateTime;

public interface ContactMessageRepository extends JpaRepository<ContactMessageEntity, UUID> {
    List<ContactMessageEntity> findAllByOrderByCreatedAtDesc();
    long countByIsReadFalse();
    long countByStatusIsNull();
    List<ContactMessageEntity> findTop5ByOrderByCreatedAtDesc();
    List<ContactMessageEntity> findTop5ByStatusIsNullOrderByCreatedAtDesc();
    List<ContactMessageEntity> findByCreatedAtAfter(ZonedDateTime dateTime);
}
