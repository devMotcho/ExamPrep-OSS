package com.exam_prep.api.user.lockout;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LoginLockoutService {

    private final LoginLockoutRepository loginLockoutRepository;

    private String cleanUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }

    @Transactional(readOnly = true)
    public long getRemainingLockoutTime(String ip) {
        Optional<LoginLockoutEntity> opt = loginLockoutRepository.findByIpAddress(ip);
        if (opt.isEmpty()) {
            return 0;
        }
        
        LoginLockoutEntity entity = opt.get();
        if (entity.getLockedUntil() == null) {
            return 0;
        }
        
        long remaining = entity.getLockedUntil() - System.currentTimeMillis();
        return remaining > 0 ? (remaining / 1000) + 1 : 0;
    }

    @Transactional
    public void registerFailedAttempt(String ip, String username) {
        String cleanUser = cleanUsername(username);
        LoginLockoutEntity entity = loginLockoutRepository.findByIpAddress(ip)
                .orElseGet(() -> LoginLockoutEntity.builder()
                        .ipAddress(ip)
                        .username(cleanUser)
                        .failedAttempts(0)
                        .build());

        entity.setFailedAttempts(entity.getFailedAttempts() + 1);
        entity.setUsername(cleanUser); // Record the latest attempted username for audits

        // Exponential backoff: 2^failedAttempts seconds, capped at 1 day (86400 seconds)
        long delaySeconds = (long) Math.pow(2, entity.getFailedAttempts());
        delaySeconds = Math.min(delaySeconds, 86400);

        entity.setLockedUntil(System.currentTimeMillis() + (delaySeconds * 1000));
        loginLockoutRepository.save(entity);
    }

    @Transactional
    public void registerSuccessfulLogin(String ip) {
        loginLockoutRepository.findByIpAddress(ip)
                .ifPresent(loginLockoutRepository::delete);
    }
}
