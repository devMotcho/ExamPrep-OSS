package com.exam_prep.api.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import com.exam_prep.api.user.UserRoleKey;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Creates the first admin and dev accounts from the environment. There are no built-in credentials:
 * a missing or weak setting is logged and skipped, and the app starts without that account.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    static final int MIN_PASSWORD_LENGTH = 12;

    private static final Set<String> WEAK_PASSWORDS = Set.of(
            "password1234", "password12345", "password123456", "passwordpassword",
            "adminadmin12", "adminadmin123", "adminadminadmin", "administrator", "administrator1",
            "changeme1234", "changemechangeme", "change_me_please", "changethispassword",
            "123456789012", "1234567890123", "12345678901234", "123456789abc", "abc123abc123",
            "qwertyuiop12", "qwertyuiop123", "qwerty123456", "letmeinletmein", "welcome12345",
            "examprep1234", "examprepexamprep", "super_secret_db_password");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email:}")
    private String adminEmail;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @Value("${app.dev.email:}")
    private String devEmail;

    @Value("${app.dev.password:}")
    private String devPassword;

    @Override
    public void run(String... args) {
        seed("DEFAULT_ADMIN", "Super Admin", UserRoleKey.ADMIN.key(), adminEmail, adminPassword);
        seed("DEFAULT_DEV", "Super Developer", UserRoleKey.DEV.key(), devEmail, devPassword);
    }

    private void seed(String envPrefix, String name, String role, String email, String password) {
        boolean emailSet = email != null && !email.isBlank();
        boolean passwordSet = password != null && !password.isBlank();

        if (!emailSet && !passwordSet) {
            if (userRepository.countByRole(role) == 0) {
                log.warn("No {} account exists and {}_EMAIL / {}_PASSWORD are not set: none was created.", role, envPrefix, envPrefix);
            }
            return;
        }
        if (!emailSet || !passwordSet) {
            log.warn("{}_EMAIL and {}_PASSWORD must be set together: no {} account was created.", envPrefix, envPrefix, role);
            return;
        }
        if (userRepository.existsByEmail(email.trim())) {
            log.info("Seeded {} account already exists.", role);
            return;
        }
        Optional<String> problem = passwordProblem(password);
        if (problem.isPresent()) {
            log.warn("{}_PASSWORD was rejected ({}): no {} account was created.", envPrefix, problem.get(), role);
            return;
        }
        userRepository.save(UserEntity.builder()
                .name(name)
                .email(email.trim())
                .password(passwordEncoder.encode(password))
                .role(role)
                .isActive(true)
                .build());
        log.info("Created the {} account from {}_EMAIL.", role, envPrefix);
    }

    /** Why this password may not be used for a seeded account, if there is a reason. */
    static Optional<String> passwordProblem(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            return Optional.of("it must have at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        String normalised = password.toLowerCase(Locale.ROOT);
        if (WEAK_PASSWORDS.contains(normalised) || normalised.chars().distinct().count() < 4) {
            return Optional.of("it is a known weak password");
        }
        return Optional.empty();
    }
}
