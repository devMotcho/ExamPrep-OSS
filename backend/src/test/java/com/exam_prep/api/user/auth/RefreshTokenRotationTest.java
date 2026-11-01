package com.exam_prep.api.user.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.RefreshTokenRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class RefreshTokenRotationTest {

    private static final String PRESENTED = "presented-token";

    private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
    private final AuthService service = new AuthService(mock(UserRepository.class), tokens, mock(JwtService.class),
            mock(PasswordEncoder.class), mock(SiteConfigRepository.class));
    private final UUID family = UUID.randomUUID();
    private final UserEntity user = UserEntity.builder().id(UUID.randomUUID()).isActive(true).build();

    private RefreshTokenEntity stored(boolean revoked, ZonedDateTime rotatedAt) {
        RefreshTokenEntity token = RefreshTokenEntity.builder().id(UUID.randomUUID()).user(user).familyId(family)
                .tokenHash(TokenHash.sha256(PRESENTED)).revoked(revoked).rotatedAt(rotatedAt)
                .expiryDate(ZonedDateTime.now().plusDays(1)).build();
        when(tokens.findByTokenHash(TokenHash.sha256(PRESENTED))).thenReturn(Optional.of(token));
        return token;
    }

    @Test
    void onlyAHashIsStored() {
        String token = service.createRefreshToken(user);
        ArgumentCaptor<RefreshTokenEntity> saved = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(tokens).save(saved.capture());
        assertEquals(TokenHash.sha256(token), saved.getValue().getTokenHash());
        assertNotEquals(token, saved.getValue().getTokenHash());
    }

    @Test
    void rotationStaysInTheFamily() {
        RefreshTokenEntity token = stored(false, null);
        when(tokens.markRotated(eq(token.getId()), any())).thenReturn(1);

        AuthService.Rotation rotation = service.rotateRefreshToken(PRESENTED);

        assertNotEquals(PRESENTED, rotation.refreshToken());
        ArgumentCaptor<RefreshTokenEntity> saved = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(tokens).save(saved.capture());
        assertEquals(family, saved.getValue().getFamilyId());
    }

    @Test
    void reusingARotatedTokenEndsTheFamily() {
        stored(true, ZonedDateTime.now().minusMinutes(5));
        AppException e = assertThrows(AppException.class, () -> service.rotateRefreshToken(PRESENTED));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getStatus());
        verify(tokens).revokeFamily(family);
    }

    @Test
    void aRepeatRightAfterRotationIsNotTreatedAsTheft() {
        stored(true, ZonedDateTime.now().minusSeconds(1));
        AppException e = assertThrows(AppException.class, () -> service.rotateRefreshToken(PRESENTED));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(tokens, never()).revokeFamily(any());
    }

    @Test
    void losingARotationRaceIssuesNothing() {
        RefreshTokenEntity token = stored(false, null);
        when(tokens.markRotated(eq(token.getId()), any())).thenReturn(0);
        AppException e = assertThrows(AppException.class, () -> service.rotateRefreshToken(PRESENTED));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        verify(tokens, never()).save(any());
    }

    @Test
    void anUnknownTokenIsRejected() {
        when(tokens.findByTokenHash(any())).thenReturn(Optional.empty());
        AppException e = assertThrows(AppException.class, () -> service.rotateRefreshToken(PRESENTED));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getStatus());
    }

    @Test
    void logoutEndsTheSession() {
        stored(false, null);
        service.revokeSession(PRESENTED);
        verify(tokens).revokeFamily(family);
    }

    @Test
    void newOAuthAccountIsOnlyConfirmedWhenTheProviderVouches() {
        UserRepository users = mock(UserRepository.class);
        when(users.findByOauthProviderAndOauthSubject(any(), any())).thenReturn(Optional.empty());
        when(users.findByEmail(any())).thenReturn(Optional.empty());
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        AuthService authService = new AuthService(users, tokens, mock(JwtService.class),
                mock(PasswordEncoder.class), mock(SiteConfigRepository.class));

        assertEquals(false, authService.findOrCreateOAuthUser("a@example.com", "A", "microsoft", "s", false).isConfirmed());
        assertEquals(true, authService.findOrCreateOAuthUser("a@example.com", "A", "google", "s", true).isConfirmed());
    }
}
