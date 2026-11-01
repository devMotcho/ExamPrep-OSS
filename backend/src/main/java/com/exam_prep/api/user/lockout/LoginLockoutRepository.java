package com.exam_prep.api.user.lockout;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoginLockoutRepository extends JpaRepository<LoginLockoutEntity, UUID> {
    Optional<LoginLockoutEntity> findByIpAddress(String ipAddress);
}
