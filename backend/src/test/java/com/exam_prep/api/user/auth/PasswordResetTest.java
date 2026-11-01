package com.exam_prep.api.user.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.repository.RefreshTokenRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.security.ClientIpResolver;
import com.exam_prep.api.service.ConfirmationCodeService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import com.exam_prep.api.user.lockout.LoginLockoutService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordResetTest {

    private final UserRepository users = mock(UserRepository.class);
    private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final AuthService authService = new AuthService(users, tokens, mock(JwtService.class), encoder, mock(SiteConfigRepository.class));
    private final ConfirmationCodeService codes = mock(ConfirmationCodeService.class);
    private final AuthController controller = new AuthController(authService, mock(UserService.class), mock(JwtService.class),
            mock(HttpServletRequest.class), mock(LoginLockoutService.class), mock(ClientIpResolver.class), codes, encoder);

    private static final Map<String, String> RESET = Map.of("email", "a@example.com", "code", "123456", "newPassword", "a-new-password");

    @Test
    void resetRevokesEveryRefreshToken() {
        UserEntity user = new UserEntity();
        when(users.findByEmail("a@example.com")).thenReturn(Optional.of(user));
        when(encoder.encode("a-new-password")).thenReturn("hashed");

        authService.resetPassword("a@example.com", "a-new-password");

        assertEquals("hashed", user.getPassword());
        verify(users).save(user);
        verify(tokens).revokeAllForUser(user);
    }

    @Test
    void resetResponseIsTheSameForKnownAndUnknownEmails() {
        when(users.findByEmail("a@example.com")).thenReturn(Optional.of(new UserEntity()));
        ResponseEntity<?> known = controller.resetPassword(RESET);

        when(users.findByEmail("a@example.com")).thenReturn(Optional.empty());
        ResponseEntity<?> unknown = controller.resetPassword(RESET);

        assertEquals(known.getStatusCode(), unknown.getStatusCode());
        assertEquals(known.getBody(), unknown.getBody());
    }

    @Test
    void unknownEmailChangesNothing() {
        when(users.findByEmail("a@example.com")).thenReturn(Optional.empty());

        authService.resetPassword("a@example.com", "a-new-password");

        verify(users, never()).save(any());
        verify(tokens, never()).revokeAllForUser(any());
    }

    @Test
    void sendCodeResponseDoesNotDependOnTheAddress() {
        ResponseEntity<?> first = controller.sendCode(Map.of("email", "a@example.com"));
        ResponseEntity<?> second = controller.sendCode(Map.of("email", "nobody@example.com"));

        assertEquals(first.getStatusCode(), second.getStatusCode());
        assertEquals(first.getBody(), second.getBody());
        verify(users, never()).findByEmail(any());
    }
}
