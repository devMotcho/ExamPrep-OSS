package com.exam_prep.api.user.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.RefreshTokenRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.security.ClientIpResolver;
import com.exam_prep.api.service.ConfirmationCodeService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import com.exam_prep.api.user.lockout.LoginLockoutService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AccountConfirmationTest {

    private static final String EMAIL = "a@example.com";

    private final UserRepository users = mock(UserRepository.class);
    private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final ConfirmationCodeService codes = mock(ConfirmationCodeService.class);
    private final AuthService authService = new AuthService(users, tokens, mock(JwtService.class), encoder, mock(SiteConfigRepository.class));
    private final AuthController controller = new AuthController(authService, mock(UserService.class), mock(JwtService.class),
            mock(HttpServletRequest.class), mock(LoginLockoutService.class), mock(ClientIpResolver.class), codes, encoder,
            mock(AuthCookies.class), mock(OAuthExchangeService.class));

    @BeforeEach
    void setUp() {
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        when(encoder.encode(anyString())).thenAnswer(i -> "hashed:" + i.getArgument(0));
        when(encoder.matches(anyString(), anyString())).thenAnswer(i -> ("hashed:" + i.getArgument(0)).equals(i.getArgument(1)));
    }

    private static RegisterRequest registration(String code) {
        return RegisterRequest.builder().name("A").email(EMAIL).password("a-password").confirmPassword("a-password").code(code).build();
    }

    private UserEntity registeredThroughTheController(String code) {
        controller.register(registration(code));
        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(users).save(saved.capture());
        return saved.getValue();
    }

    private UserEntity existing(boolean confirmed, String provider, String subject) {
        UserEntity user = UserEntity.builder().email(EMAIL).password("hashed:a-password").role("ROLE_USER")
                .isActive(true).isConfirmed(confirmed).oauthProvider(provider).oauthSubject(subject).build();
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void registeringWithoutACodeLeavesTheAccountUnconfirmed() {
        when(codes.isConfirmationCodeEnabled()).thenReturn(false);

        assertFalse(registeredThroughTheController(null).isConfirmed());
        verify(codes, never()).validateConfirmationCode(any(), any(), any());
    }

    @Test
    void registeringWithAVerifiedCodeConfirmsTheAccount() {
        when(codes.isConfirmationCodeEnabled()).thenReturn(true);

        assertTrue(registeredThroughTheController("123456").isConfirmed());
        verify(codes).validateConfirmationCode(EMAIL, "123456", CodePurpose.REGISTER);
    }

    @Test
    void aWrongCodeCreatesNoAccount() {
        when(codes.isConfirmationCodeEnabled()).thenReturn(true);
        doThrow(new AppException("Invalid code", HttpStatus.BAD_REQUEST)).when(codes).validateConfirmationCode(EMAIL, "000000", CodePurpose.REGISTER);

        assertThrows(AppException.class, () -> controller.register(registration("000000")));
        verify(users, never()).save(any());
    }

    @Test
    void anUnconfirmedAccountCanStillSignIn() {
        UserEntity user = existing(false, null, null);

        assertEquals(user, authService.authenticate(new AuthRequest(EMAIL, "a-password")));
        assertFalse(user.isConfirmed());
    }

    @Test
    void aVerifiedProviderTakesOverAnUnconfirmedAccount() {
        UserEntity user = existing(false, null, null);

        UserEntity linked = authService.findOrCreateOAuthUser(EMAIL, "A", "google", "sub", true);

        assertTrue(linked.isConfirmed());
        assertEquals("google", linked.getOauthProvider());
        assertEquals("sub", linked.getOauthSubject());
        assertEquals("OAUTH_GOOGLE", linked.getPassword());
        assertFalse(encoder.matches("a-password", linked.getPassword()));
        verify(tokens).revokeAllForUser(user);
    }

    @Test
    void aVerifiedProviderReplacesAnEarlierLinkOnAnUnconfirmedAccount() {
        existing(false, "microsoft", "earlier");

        UserEntity linked = authService.findOrCreateOAuthUser(EMAIL, "A", "google", "sub", true);

        assertEquals("google", linked.getOauthProvider());
        assertEquals("sub", linked.getOauthSubject());
    }

    @Test
    void aVerifiedProviderLeavesAConfirmedAccountsPasswordAndSessionsAlone() {
        UserEntity user = existing(true, null, null);

        UserEntity linked = authService.findOrCreateOAuthUser(EMAIL, "A", "google", "sub", true);

        assertEquals("hashed:a-password", linked.getPassword());
        assertEquals("google", linked.getOauthProvider());
        verify(tokens, never()).revokeAllForUser(user);
    }

    @Test
    void anUnverifiedProviderCannotTouchAnExistingAccount() {
        UserEntity user = existing(false, null, null);

        AppException e = assertThrows(AppException.class, () -> authService.findOrCreateOAuthUser(EMAIL, "A", "microsoft", "sub", false));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals("hashed:a-password", user.getPassword());
        assertNull(user.getOauthSubject());
        assertFalse(user.isConfirmed());
        verify(tokens, never()).revokeAllForUser(any());
    }

    @Test
    void anUnverifiedProviderCreatesAnUnconfirmedAccount() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertFalse(authService.findOrCreateOAuthUser(EMAIL, "A", "microsoft", "sub", false).isConfirmed());
    }

    @Test
    void aResetOnAnUnconfirmedAccountRemovesTheLinkAndConfirmsIt() {
        UserEntity user = existing(false, "microsoft", "earlier");

        authService.resetPassword(EMAIL, "a-new-password");

        assertTrue(user.isConfirmed());
        assertNull(user.getOauthProvider());
        assertNull(user.getOauthSubject());
        assertEquals("hashed:a-new-password", user.getPassword());
        verify(tokens).revokeAllForUser(user);
    }

    @Test
    void aResetOnAConfirmedAccountKeepsItsLink() {
        UserEntity user = existing(true, "google", "sub");

        authService.resetPassword(EMAIL, "a-new-password");

        assertEquals("google", user.getOauthProvider());
        assertEquals("sub", user.getOauthSubject());
        verify(tokens).revokeAllForUser(user);
    }
}
