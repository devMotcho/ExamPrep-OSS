package com.exam_prep.api.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.Collection;
import java.util.List;
import java.time.ZonedDateTime;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
    List<UserEntity> findByRoleIn(Collection<String> roles);
    List<UserEntity> findByRole(String role);
    long countByRole(String role);
    long countByRoleNot(String role);
    long countByIsActiveTrue();
    long countByIsActiveTrueAndRoleNot(String role);
    List<UserEntity> findTop5ByOrderByCreatedAtDesc();
    List<UserEntity> findTop5ByRoleNotOrderByCreatedAtDesc(String role);
    List<UserEntity> findByCreatedAtAfter(ZonedDateTime dateTime);
    long countByCreatedAtAfter(ZonedDateTime dateTime);
    long countByCreatedAtBetween(ZonedDateTime start, ZonedDateTime end);
    long countByCreatedAtAfterAndRoleNot(ZonedDateTime dateTime, String role);
    long countByCreatedAtBetweenAndRoleNot(ZonedDateTime start, ZonedDateTime end, String role);
    Optional<UserEntity> findByOauthProviderAndOauthSubject(String oauthProvider, String oauthSubject);
}
