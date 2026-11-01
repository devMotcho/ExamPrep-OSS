package com.exam_prep.api.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import com.exam_prep.api.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_DEV')")
public class AdminUserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    // ── GET all ────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<UserEntity>> getAllUsers() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));
        if (isDev) {
            return ResponseEntity.ok(userRepository.findAll());
        } else {
            return ResponseEntity.ok(userRepository.findAll().stream()
                    .filter(u -> !"ROLE_DEV".equals(u.getRole()))
                    .collect(java.util.stream.Collectors.toList()));
        }
    }

    // ── POST create ────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserDto request) {
        org.springframework.security.core.Authentication securityAuth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = securityAuth != null && securityAuth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));

        String assignedRole = request.getRole() != null ? request.getRole() : "ROLE_USER";

        if ("ROLE_DEV".equals(assignedRole)) {
            throw new IllegalArgumentException("The Developer role can only be assigned directly via system configuration or database updates.");
        }

        requireAssignableRole(assignedRole);

        if ("ROLE_ADMIN".equals(assignedRole) && !isDev) {
            throw new IllegalArgumentException("Only Developers are authorized to assign the Administrator role.");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("A user with this email address already exists.");
        }

        // Trusted roles (ADMIN / DEV) are always confirmed — they are provisioned by
        // privileged operators and must never be blocked by the email-confirmation gate.
        boolean autoConfirm = "ROLE_ADMIN".equals(assignedRole) || "ROLE_DEV".equals(assignedRole);

        UserEntity user = UserEntity.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .phone(request.getPhone() != null ? request.getPhone().trim() : null)
                .role(assignedRole)
                .isActive(request.isActive())
                .isConfirmed(autoConfirm)
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        return ResponseEntity.ok(userRepository.save(user));
    }

    // ── PUT update ─────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserDto request) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));

        // Hide dev users from standard admins
        if ("ROLE_DEV".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("User not found.");
        }

        // Prevent setting role to ROLE_DEV
        if ("ROLE_DEV".equals(request.getRole())) {
            throw new IllegalArgumentException("The Developer role can only be assigned directly via system configuration or database updates.");
        }

        requireAssignableRole(request.getRole());

        // Standard Admins cannot promote users to Admin
        if ("ROLE_ADMIN".equals(request.getRole()) && !isDev) {
            throw new IllegalArgumentException("Only Developers are authorized to assign the Administrator role.");
        }

        // Guard: editing another admin account is not permitted for standard admins
        if ("ROLE_ADMIN".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("Administrator accounts cannot be edited.");
        }

        // Check email uniqueness only if it changed
        String newEmail = request.getEmail().trim().toLowerCase();
        if (!newEmail.equals(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("A user with this email address already exists.");
        }

        user.setName(request.getName().trim());
        user.setEmail(newEmail);
        user.setPhone(request.getPhone() != null ? request.getPhone().trim() : null);
        user.setRole(request.getRole());
        user.setActive(request.isActive());

        // If the user is being promoted to a trusted role, auto-confirm their account.
        if ("ROLE_ADMIN".equals(request.getRole()) || "ROLE_DEV".equals(request.getRole())) {
            user.setConfirmed(true);
        }

        userRepository.save(user);

        return ResponseEntity.ok(user);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));

        // Hide dev users from standard admins
        if ("ROLE_DEV".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("User not found.");
        }

        // Guard: cannot delete an admin for standard admins
        if ("ROLE_ADMIN".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("Administrator accounts cannot be deleted.");
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully."));
    }



    // ── ADMINISTRATIVE RESET PASSWORD ──────────────────────────────────────────

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(
            @PathVariable UUID id,
            @Valid @RequestBody ResetPasswordRequest body) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));

        // Hide dev users from standard admins
        if ("ROLE_DEV".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("User not found.");
        }

        // Guard: reset password of an admin account is not permitted for standard admins
        if ("ROLE_ADMIN".equals(user.getRole()) && !isDev) {
            throw new IllegalArgumentException("Administrator passwords cannot be changed by another Administrator.");
        }

        user.setPassword(passwordEncoder.encode(body.getPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user);

        return ResponseEntity.ok(Map.of("message", "Password reset successfully."));
    }

    // ── Utility ────────────────────────────────────────────────────────────────

    private static void requireAssignableRole(String role) {
        if (!"ROLE_USER".equals(role) && !"ROLE_ADMIN".equals(role)) {
            throw new IllegalArgumentException("Unknown role.");
        }
    }

    @GetMapping("/count")
    public ResponseEntity<?> getUserCount() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));
        long count = isDev ? userRepository.count() : userRepository.countByRoleNot("ROLE_DEV");
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    /** DTO for user creation — password is mandatory. */
    @Data
    public static class CreateUserDto {

        @NotBlank(message = "Name is required.")
        @Size(max = com.exam_prep.api.dto.ContentLimits.NAME)
        private String name;

        @NotBlank(message = "Email is required.")
        @Email(message = "Please enter a valid email address.")
        @Size(max = com.exam_prep.api.dto.ContentLimits.EMAIL)
        private String email;

        @Size(max = com.exam_prep.api.dto.ContentLimits.PHONE)
        private String phone;

        private String role;

        @JsonProperty("active")
        private boolean active = true;

        @NotBlank(message = "Password is required for new users.")
        @Size(min = 8, max = com.exam_prep.api.dto.ContentLimits.PASSWORD, message = "Password must be between 8 and 72 characters.")
        private String password;
    }

    /** DTO for user updates — password is optional. */
    @Data
    public static class UpdateUserDto {

        @NotBlank(message = "Name is required.")
        @Size(max = com.exam_prep.api.dto.ContentLimits.NAME)
        private String name;

        @NotBlank(message = "Email is required.")
        @Email(message = "Please enter a valid email address.")
        @Size(max = com.exam_prep.api.dto.ContentLimits.EMAIL)
        private String email;

        @Size(max = com.exam_prep.api.dto.ContentLimits.PHONE)
        private String phone;

        private String role;

        @JsonProperty("active")
        private boolean active = true;
    }

    /** DTO for administrative password reset. */
    @Data
    public static class ResetPasswordRequest {
        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = com.exam_prep.api.dto.ContentLimits.PASSWORD, message = "Password must be between 8 and 72 characters.")
        private String password;
    }
}
