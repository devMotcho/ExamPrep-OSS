package com.exam_prep.api.user.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.RefreshTokenRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

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

    @Value("${app.jwt.refresh-expiration-ms}")
    private long jwtRefreshExpirationMs;

    /**
     * Registration deliberately keeps its 409 for a taken address, so people can tell they already have an
     * account. It therefore reveals whether an email is registered, unlike send-code and reset-password;
     * the register rate limit is what slows down enumeration through this endpoint.
     */
    @Transactional
    public UserEntity register(RegisterRequest request) {
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
                .isConfirmed(true)
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
     */
    @Transactional
    public void resetPassword(String email, String newPassword) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);
            refreshTokenRepository.revokeAllForUser(user);
        });
    }

    @Transactional
    public String createRefreshToken(UserEntity user) {
        String token = UUID.randomUUID().toString();
        RefreshTokenEntity refreshToken = RefreshTokenEntity.builder()
                .user(user)
                .token(token)
                .expiryDate(ZonedDateTime.now().plusNanos(jwtRefreshExpirationMs * 1_000_000))
                .build();

        refreshTokenRepository.save(refreshToken);
        return token;
    }

    @Transactional
    public RefreshTokenEntity verifyRefreshToken(String token) {
        RefreshTokenEntity refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new AppException("Invalid refresh token", HttpStatus.UNAUTHORIZED));

        if (refreshToken.getExpiryDate().isBefore(ZonedDateTime.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new AppException("Refresh token expired", HttpStatus.UNAUTHORIZED);
        }

        if (refreshToken.isRevoked()) {
            throw new AppException("Refresh token revoked", HttpStatus.UNAUTHORIZED);
        }

        if (!refreshToken.getUser().isActive()) {
            throw new AppException("Account is disabled", HttpStatus.FORBIDDEN);
        }

        return refreshToken;
    }

    @Transactional
    public String rotateRefreshToken(RefreshTokenEntity oldToken) {
        UserEntity user = oldToken.getUser();
        refreshTokenRepository.delete(oldToken);
        return createRefreshToken(user);
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
                .password("OAUTH_" + provider.toUpperCase()) // sentinel — no local password
                .role("ROLE_USER")
                .isActive(true)
                .isConfirmed(true)
                .oauthProvider(provider)
                .oauthSubject(subject)
                .build();

        newUser.setLastLoginAt(java.time.ZonedDateTime.now());
        return userRepository.save(newUser);
    }
}
