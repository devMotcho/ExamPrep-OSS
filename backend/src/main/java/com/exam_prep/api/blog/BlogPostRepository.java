package com.exam_prep.api.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BlogPostRepository extends JpaRepository<BlogPostEntity, UUID> {
    List<BlogPostEntity> findByLocaleAndStatusOrderByPublishedAtDesc(String locale, String status);

    List<BlogPostEntity> findByLocaleAndStatusAndFeatureKeyOrderByPublishedAtDesc(String locale, String status, String featureKey);

    Optional<BlogPostEntity> findBySlugAndLocaleAndStatus(String slug, String locale, String status);

    List<BlogPostEntity> findBySlugAndStatus(String slug, String status);

    List<BlogPostEntity> findAllByOrderByUpdatedAtDesc();

    boolean existsBySlugAndLocale(String slug, String locale);

    boolean existsBySlugAndLocaleAndIdNot(String slug, String locale, UUID id);
}
