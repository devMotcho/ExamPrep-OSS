package com.exam_prep.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.entity.ConfirmationCodeEntity;

import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConfirmationCodeRepository extends JpaRepository<ConfirmationCodeEntity, UUID> {

    /** One atomic statement: each guess takes an attempt first, so simultaneous guesses cannot exceed the limit. */
    @Modifying
    @Query("update ConfirmationCodeEntity c set c.attempts = c.attempts + 1 "
            + "where c.email = :email and c.purpose = :purpose and c.attempts < :maxAttempts and c.expiresAt > :now")
    int claimAttempt(@Param("email") String email, @Param("purpose") CodePurpose purpose,
                     @Param("maxAttempts") int maxAttempts, @Param("now") ZonedDateTime now);

    Optional<ConfirmationCodeEntity> findFirstByEmailAndPurposeOrderByCreatedAtDesc(String email, CodePurpose purpose);

    @Modifying
    @Query("delete from ConfirmationCodeEntity c where c.email = :email and c.purpose = :purpose")
    int deleteByEmailAndPurpose(@Param("email") String email, @Param("purpose") CodePurpose purpose);

    @Modifying
    @Query("delete from ConfirmationCodeEntity c where c.expiresAt < :now")
    int deleteExpired(@Param("now") ZonedDateTime now);
}
