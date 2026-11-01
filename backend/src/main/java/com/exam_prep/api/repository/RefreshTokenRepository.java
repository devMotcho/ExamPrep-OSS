package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.auth.RefreshTokenEntity;

import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
    Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

    /** One atomic statement: of two simultaneous refreshes, only one gets to rotate a token. */
    @Modifying
    @Query("update RefreshTokenEntity t set t.revoked = true, t.rotatedAt = :now where t.id = :id and t.revoked = false")
    int markRotated(@Param("id") UUID id, @Param("now") ZonedDateTime now);

    @Modifying
    @Query("delete from RefreshTokenEntity t where t.familyId = :familyId")
    int revokeFamily(@Param("familyId") UUID familyId);

    @Modifying
    @Query("delete from RefreshTokenEntity t where t.expiryDate < :now")
    int deleteExpired(@Param("now") ZonedDateTime now);

    /** A bulk delete, so a refresh rotating one of these tokens at the same moment cannot make it fail. */
    @Modifying
    @Transactional
    @Query("delete from RefreshTokenEntity t where t.user = :user")
    int revokeAllForUser(@Param("user") UserEntity user);
}
