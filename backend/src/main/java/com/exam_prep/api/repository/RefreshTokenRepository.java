package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.auth.RefreshTokenEntity;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
    Optional<RefreshTokenEntity> findByToken(String token);
    void deleteByUser(UserEntity user);
    void deleteByToken(String token);

    /** A bulk delete, so a refresh rotating one of these tokens at the same moment cannot make it fail. */
    @Modifying
    @Transactional
    @Query("delete from RefreshTokenEntity t where t.user = :user")
    int revokeAllForUser(@Param("user") UserEntity user);
}
