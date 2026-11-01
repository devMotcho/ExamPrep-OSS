package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.entity.ConfirmationCodeEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.email.EmailNotificationService;
import com.exam_prep.api.repository.ConfirmationCodeRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import java.time.ZonedDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ConfirmationCodeServiceTest {

    private static final String EMAIL = "a@example.com";
    private final ConfirmationCodeRepository repository = mock(ConfirmationCodeRepository.class);
    private final EmailNotificationService email = mock(EmailNotificationService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ConfirmationCodeService service = new ConfirmationCodeService(repository, mock(SiteConfigRepository.class), email, jdbc);

    private void stored(int attempts) {
        when(repository.claimAttempt(eq(EMAIL), eq(CodePurpose.PASSWORD_RESET), anyInt(), any())).thenReturn(1);
        when(repository.findFirstByEmailAndPurposeOrderByCreatedAtDesc(EMAIL, CodePurpose.PASSWORD_RESET)).thenReturn(Optional.of(
                ConfirmationCodeEntity.builder().email(EMAIL).code("123456").purpose(CodePurpose.PASSWORD_RESET)
                        .attempts(attempts).expiresAt(ZonedDateTime.now().plusMinutes(5)).build()));
    }

    @Test
    void theRightCodeWorksAndIsUsedUp() {
        stored(1);
        when(repository.deleteByEmailAndPurpose(EMAIL, CodePurpose.PASSWORD_RESET)).thenReturn(1);
        assertDoesNotThrow(() -> service.validateConfirmationCode(EMAIL, "123456", CodePurpose.PASSWORD_RESET));
        verify(repository).deleteByEmailAndPurpose(EMAIL, CodePurpose.PASSWORD_RESET);
    }

    @Test
    void aWrongGuessKeepsTheCodeUntilTheLastAttempt() {
        stored(4);
        assertThrows(AppException.class, () -> service.validateConfirmationCode(EMAIL, "000000", CodePurpose.PASSWORD_RESET));
        verify(repository, never()).deleteByEmailAndPurpose(anyString(), any());
    }

    @Test
    void theFifthWrongGuessBurnsTheCode() {
        stored(ConfirmationCodeService.MAX_ATTEMPTS);
        assertThrows(AppException.class, () -> service.validateConfirmationCode(EMAIL, "000000", CodePurpose.PASSWORD_RESET));
        verify(repository).deleteByEmailAndPurpose(EMAIL, CodePurpose.PASSWORD_RESET);
    }

    @Test
    void noAttemptLeftMeansTheCodeIsNotEvenCompared() {
        when(repository.claimAttempt(any(), any(), anyInt(), any())).thenReturn(0);
        assertThrows(AppException.class, () -> service.validateConfirmationCode(EMAIL, "123456", CodePurpose.PASSWORD_RESET));
        verify(repository, never()).findFirstByEmailAndPurposeOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void aCodeIsBoundToItsPurpose() {
        // A claim is scoped by purpose, so a code sent for another one finds nothing here.
        stored(1);
        assertThrows(AppException.class, () -> service.validateConfirmationCode(EMAIL, "123456", CodePurpose.CONTACT));
        verify(repository).claimAttempt(eq(EMAIL), eq(CodePurpose.CONTACT), anyInt(), any());
    }

    @Test
    void differentlyWrittenAddressesShareACode() {
        stored(1);
        when(repository.deleteByEmailAndPurpose(EMAIL, CodePurpose.PASSWORD_RESET)).thenReturn(1);
        assertDoesNotThrow(() -> service.validateConfirmationCode(" A@Example.com ", "123456", CodePurpose.PASSWORD_RESET));
    }

    @Test
    void anAddressOverItsHourlyLimitGetsNoEmail() {
        when(jdbc.update(anyString(), any(), any())).thenReturn(0);
        service.sendConfirmationCode(EMAIL, CodePurpose.PASSWORD_RESET);
        verify(email, never()).send(any());
        verify(repository, never()).save(any());
    }
}
