package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.OptionEntity;

import java.util.UUID;

public interface OptionRepository extends JpaRepository<OptionEntity, UUID> {
}
