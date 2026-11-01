package com.exam_prep.api.user.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.RefreshTokenRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final SiteConfigRepository siteConfigRepository;

    /** Long enough for another tab's simultaneous refresh or a client retry, too short to be useful to a thief. */
    static final Duration ROTATION_GRACE = Duration.ofSeconds(10);
    private static final String ROTATED_JUST_NOW = "Refresh token was just rotated";

    @Value("${app.jwt.refresh-expiration-ms}")
    private long jwtRefreshExpirationMs;

    /**
     * Registration deliberately keeps its 409 for a taken address, so people can tell they already have an
     * account. It therefore reveals whether an email is registered, unlike send-code and reset-password;
     * the register rate limit is what slows down enumeration through this endpoint.
     *
     * @param emailVerified Whether the caller checked a code sent to the address. Nothing else proves that this
     *                      person owns it, so without one the account stays unconfirmed.
     */
    @Transactional
    public UserEntity register(RegisterRequest request, boolean emailVerified) {
        boolean isRegisterEnabled = siteConfigRepository.findById("register_enabled")
                .map(entity -> "true".equalsIgnoreCase(entity.getValue()))
                .orElse(true);

        if (!isRegisterEnabled) {
            throw new AppException("User registration is currently disabled.", HttpStatus.FORBIDDEN);
        }

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new AppException("Passwords do not match", HttpStatus.BAD_REQUEST);
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException("Email already exists", HttpStatus.CONFLICT);
        }

        UserEntity user = UserEntity.builder()
                .name(request.getName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .role("ROLE_USER")
                .isActive(true)
                .isConfirmed(emailVerified)
                .build();

        return userRepository.save(user);
    }

    @Transactional
    public UserEntity authenticate(AuthRequest request) {
        UserEntity user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException("Invalid email or password", HttpStatus.UNAUTHORIZED));

        if (!user.isActive()) {
            throw new AppException("Account is disabled", HttpStatus.FORBIDDEN);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new AppException("Invalid email or password", HttpStatus.UNAUTHORIZED);
        }

        user.setLastLoginAt(ZonedDateTime.now());
        return userRepository.save(user);
    }

    /**
     * Sets a new password and signs the user out of every device. An unknown address is ignored without
     * an error: codes can be requested for any address, so its owner must not learn whether an account exists.
     *
     * <p>The code proves who owns the address. If the account was unconfirmed until now, whoever set up its
     * social sign-in never showed that, so the link goes.
     */
    @Transactional
    public void resetPassword(String email, String newPassword) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setPassword(passwordEncoder.encode(newPassword));
            if (!user.isConfirmed()) {
                user.setOauthProvider(null);
                user.setOauthSubject(null);
                user.setConfirmed(true);
            }
            userRepository.save(user);
            refreshTokenRepository.revokeAllForUser(user);
        });
    }

    /** A new sign-in: the start of a new token family. */
    @Transactional
    public String createRefreshToken(UserEntity user) {
        return issueRefreshToken(user, UUID.randomUUID());
    }

    private String issueRefreshToken(UserEntity user, UUID familyId) {
        String token = TokenHash.newToken();
        refreshTokenRepository.save(RefreshTokenEntity.builder()
                .user(user)
                .tokenHash(TokenHash.sha256(token))
                .familyId(familyId)
                .expiryDate(ZonedDateTime.now().plusNanos(jwtRefreshExpirationMs * 1_000_000))
                .build());
        return token;
    }

    public record Rotation(UserEntity user, String refreshToken) {}

    /**
     * Exchanges a refresh token for its successor. A token that was already exchanged means two parties hold it,
     * so the family ends and everyone holding it signs in again; the exception is a repeat within a few seconds,
     * which is another tab or a retry and only gets a 409. Keeps its work when throwing, or that revocation
     * would be rolled back.
     */
    @Transactional(noRollbackFor = AppException.class)
    public Rotation rotateRefreshToken(String presented) {
        RefreshTokenEntity token = refreshTokenRepository.findByTokenHash(TokenHash.sha256(presented))
                .orElseThrow(() -> new AppException("Invalid refresh token", HttpStatus.UNAUTHORIZED));
        ZonedDateTime now = ZonedDateTime.now();

        if (token.getExpiryDate().isBefore(now)) {
            refreshTokenRepository.delete(token);
            throw new AppException("Refresh token expired", HttpStatus.UNAUTHORIZED);
        }

        if (token.isRevoked()) {
            if (token.getRotatedAt() != null && token.getRotatedAt().isAfter(now.minus(ROTATION_GRACE))) {
                throw new AppException(ROTATED_JUST_NOW, HttpStatus.CONFLICT);
            }
            refreshTokenRepository.revokeFamily(token.getFamilyId());
            throw new AppException("Refresh token revoked", HttpStatus.UNAUTHORIZED);
        }

        UserEntity user = token.getUser();
        if (!user.isActive()) {
            throw new AppException("Account is disabled", HttpStatus.FORBIDDEN);
        }

        if (refreshTokenRepository.markRotated(token.getId(), now) == 0) {
            throw new AppException(ROTATED_JUST_NOW, HttpStatus.CONFLICT);
        }
        return new Rotation(user, issueRefreshToken(user, token.getFamilyId()));
    }

    /** Ends the session the token belongs to. An unknown token is fine: the outcome is the same. */
    @Transactional
    public void revokeSession(String presented) {
        if (presented == null || presented.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(TokenHash.sha256(presented))
                .ifPresent(token -> refreshTokenRepository.revokeFamily(token.getFamilyId()));
    }

    /** Signs the user out everywhere. Access tokens already issued last until they expire. */
    public void revokeAllSessions(UserEntity user) {
        refreshTokenRepository.revokeAllForUser(user);
    }

    @Scheduled(cron = "0 45 3 * * *", zone = "UTC")
    @Transactional
    public void deleteExpiredTokens() {
        refreshTokenRepository.deleteExpired(ZonedDateTime.now());
    }

    /**
     * Find or create a user account for an OAuth2 login.
     *
     * <p>Resolution order:
     * <ol>
     *   <li>Look up by (oauth_provider, oauth_subject) → existing linked account.</li>
     *   <li>Look up by email → link provider to existing local account.</li>
     *   <li>Create a new account (guarded by register_enabled site_config).</li>
     * </ol>
     *
     * @param email    Email from the OAuth2 provider.
     * @param name     Display name from the OAuth2 provider.
     * @param provider Provider identifier ("google" or "microsoft").
     * @param subject  Stable provider-issued unique user ID.
     * @param emailVerified Whether the provider vouches for the email. An existing account is only
     *                      linked when it does, or anyone able to claim an address could take it over.
     *                      Linking to an unconfirmed account also removes its password and sessions, as
     *                      whoever created them never proved they own the address, and confirms it.
     * @return The persisted UserEntity.
     */
    @Transactional
    public UserEntity findOrCreateOAuthUser(String email, String name, String provider, String subject, boolean emailVerified) {
        // 1. Try exact provider + subject match (fastest path for returning users)
        java.util.Optional<UserEntity> bySubject = userRepository.findByOauthProviderAndOauthSubject(provider, subject);
        if (bySubject.isPresent()) {
            UserEntity user = bySubject.get();
            if (!user.isActive()) {
                throw new AppException("Account is disabled", HttpStatus.FORBIDDEN);
            }
            user.setLastLoginAt(java.time.ZonedDateTime.now());
            return userRepository.save(user);
        }

        // 2. Try matching by email → link the OAuth identity to the existing account
        java.util.Optional<UserEntity> byEmail = userRepository.findByEmail(email);
        if (byEmail.isPresent()) {
            if (!emailVerified) {
                throw new AppException("An account with this email already exists. Sign in with your password.", HttpStatus.CONFLICT);
            }
            UserEntity user = byEmail.get();
            if (!user.isActive()) {
                throw new AppException("Account is disabled", HttpStatus.FORBIDDEN);
            }
            if (!user.isConfirmed()) {
                user.setPassword(noLocalPassword(provider));
                refreshTokenRepository.revokeAllForUser(user);
                user.setConfirmed(true);
            }
            user.setOauthProvider(provider);
            user.setOauthSubject(subject);
            if (user.getName() == null && name != null) {
                user.setName(name);
            }
            user.setLastLoginAt(java.time.ZonedDateTime.now());
            return userRepository.save(user);
        }

        // 3. New user — check register_enabled gate
        boolean isRegisterEnabled = siteConfigRepository.findById("register_enabled")
                .map(entity -> "true".equalsIgnoreCase(entity.getValue()))
                .orElse(true);
        if (!isRegisterEnabled) {
            throw new AppException("User registration is currently disabled.", HttpStatus.FORBIDDEN);
        }

        UserEntity newUser = UserEntity.builder()
                .name(name)
                .email(email)
                .password(noLocalPassword(provider))
                .role("ROLE_USER")
                .isActive(true)
                .isConfirmed(emailVerified) // Only the provider's word confirms an address.
                .oauthProvider(provider)
                .oauthSubject(subject)
                .build();

        newUser.setLastLoginAt(java.time.ZonedDateTime.now());
        return userRepository.save(newUser);
    }

    /** Not a password hash, so no password ever matches it. */
    private static String noLocalPassword(String provider) {
        return "OAUTH_" + provider.toUpperCase();
    }
}
