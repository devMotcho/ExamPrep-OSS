package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.SiteConfigEntity;

public interface SiteConfigRepository extends JpaRepository<SiteConfigEntity, String> {
}
