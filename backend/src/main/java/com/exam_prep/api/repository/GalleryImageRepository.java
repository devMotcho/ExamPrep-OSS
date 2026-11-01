package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.exam_prep.api.entity.GalleryImageEntity;

import java.util.List;
import java.util.UUID;

public interface GalleryImageRepository extends JpaRepository<GalleryImageEntity, UUID> {
    List<GalleryImageEntity> findAllByOrderByUploadedAtDesc();



    List<GalleryImageEntity> findByUploadedByIdOrderByUploadedAtDesc(UUID userId);
}
