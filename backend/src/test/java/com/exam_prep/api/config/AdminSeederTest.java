package com.exam_prep.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AdminSeederTest {

    private static final String STRONG = "correct-horse-battery";

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final AdminSeeder seeder = new AdminSeeder(users, encoder);

    private void configure(String adminEmail, String adminPassword, String devEmail, String devPassword) {
        ReflectionTestUtils.setField(seeder, "adminEmail", adminEmail);
        ReflectionTestUtils.setField(seeder, "adminPassword", adminPassword);
        ReflectionTestUtils.setField(seeder, "devEmail", devEmail);
        ReflectionTestUtils.setField(seeder, "devPassword", devPassword);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"admin", "dev12345", "elevenchars"})
    void rejectsShortPasswords(String password) {
        assertTrue(AdminSeeder.passwordProblem(password).isPresent());
    }

    @ParameterizedTest
    @ValueSource(strings = {"password1234", "PASSWORD1234", "123456789012", "changemechangeme", "aaaaaaaaaaaaaaaa", "abababababab"})
    void rejectsKnownWeakPasswords(String password) {
        assertTrue(AdminSeeder.passwordProblem(password).isPresent());
    }

    @Test
    void acceptsALongUnguessablePassword() {
        assertFalse(AdminSeeder.passwordProblem(STRONG).isPresent());
    }

    @Test
    void seedsNothingWhenNothingIsConfigured() {
        configure("", "", "", "");
        seeder.run();
        verify(users, never()).save(any());
    }

    @Test
    void seedsNothingWithAWeakPassword() {
        configure("admin@example.test", "password1234", "dev@example.test", "short");
        seeder.run();
        verify(users, never()).save(any());
    }

    @Test
    void seedsNothingWithoutBothValues() {
        configure("admin@example.test", "", "", STRONG);
        seeder.run();
        verify(users, never()).save(any());
    }

    @Test
    void seedsOnlyTheAccountThatIsConfigured() {
        configure("admin@example.test", STRONG, "", "");
        when(encoder.encode(STRONG)).thenReturn("hash");

        seeder.run();

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(users, times(1)).save(saved.capture());
        assertEquals("ROLE_ADMIN", saved.getValue().getRole());
        assertEquals("hash", saved.getValue().getPassword());
    }

    @Test
    void leavesAnExistingAccountAlone() {
        configure("admin@example.test", STRONG, "", "");
        when(users.existsByEmail("admin@example.test")).thenReturn(true);
        seeder.run();
        verify(users, never()).save(any());
    }
}
