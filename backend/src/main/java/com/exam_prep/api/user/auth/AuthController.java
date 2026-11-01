package com.exam_prep.api.user.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.ContentLimits;
import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.security.ClientIpResolver;
import com.exam_prep.api.service.ConfirmationCodeService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.lockout.LoginLockoutService;

import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    /** Identical whether or not the address has an account, and whether or not delivery worked. */
    static final String NEUTRAL_CODE_SENT = "If this address can receive email, a verification code is on its way.";
    static final String NEUTRAL_PASSWORD_RESET = "If an account exists for this address, its password has been reset.";

    private final AuthService authService;
    private final UserService userService;
    private final JwtService jwtService;
    private final HttpServletRequest request;
    private final LoginLockoutService loginLockoutService;
    private final ClientIpResolver clientIpResolver;
    private final ConfirmationCodeService confirmationCodeService;
    private final PasswordEncoder passwordEncoder;
    private final AuthCookies authCookies;
    private final OAuthExchangeService oAuthExchangeService;

    @Value("${app.jwt.access-expiration-ms}")
    private long jwtAccessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long jwtRefreshExpirationMs;

    @Value("${server.servlet.session.cookie.same-site:Lax}")
    private String sessionCookieSameSite;

    @PostMapping("/send-code")
    public ResponseEntity<?> sendCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required."));
        }
        if (email.length() > 255 || !email.trim().matches("[^@\\s]+@[^@\\s]+")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please enter a valid email address."));
        }
        CodePurpose purpose;
        try {
            purpose = CodePurpose.valueOf(String.valueOf(body.get("purpose")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "A valid purpose is required."));
        }
        confirmationCodeService.sendConfirmationCode(email, purpose);
        return ResponseEntity.ok(Map.of("message", NEUTRAL_CODE_SENT));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        String newPassword = body.get("newPassword");

        if (email == null || code == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email, code, and newPassword are required."));
        }

        if (newPassword.length() < 8 || newPassword.length() > ContentLimits.PASSWORD) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be between 8 and 72 characters."));
        }

        confirmationCodeService.validateConfirmationCode(email, code, CodePurpose.PASSWORD_RESET);
        authService.resetPassword(email, newPassword);

        return ResponseEntity.ok(Map.of("message", NEUTRAL_PASSWORD_RESET));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest requestBody) {
        boolean emailVerified = confirmationCodeService.isConfirmationCodeEnabled();
        if (emailVerified) {
            confirmationCodeService.validateConfirmationCode(requestBody.getEmail(), requestBody.getCode(), CodePurpose.REGISTER);
        }
        authService.register(requestBody, emailVerified);
        return ResponseEntity.ok(Map.of("message", "User registered successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest requestBody, HttpServletResponse response) {
        String ip = clientIpResolver.resolveClientKey(request);
        String username = requestBody.getEmail();
        
        // 1. Check if currently locked out
        long remaining = loginLockoutService.getRemainingLockoutTime(ip);
        if (remaining > 0) {
            return ResponseEntity.status(HttpStatus.LOCKED)
                .body(Map.of(
                    "error", "Locked",
                    "message", "Too many failed attempts. Please wait " + remaining + " seconds.",
                    "retryAfter", remaining
                ));
        }

        try {
            UserEntity user = authService.authenticate(requestBody);
            setTokens(response, user);
            
            // On success, reset failed attempts
            loginLockoutService.registerSuccessfulLogin(ip);
            
            return ResponseEntity.ok(Map.of("message", "Login successful"));
        } catch (AppException e) {
            if (e.getStatus() == HttpStatus.UNAUTHORIZED) {
                // Register failed attempt
                loginLockoutService.registerFailedAttempt(ip, username);
                long newRemaining = loginLockoutService.getRemainingLockoutTime(ip);
                
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                        "error", "Unauthorized",
                        "message", e.getMessage() + ". Please wait " + newRemaining + " seconds before trying again.",
                        "retryAfter", newRemaining
                    ));
            }
            throw e; // rethrow other exceptions (e.g. disabled account, etc.)
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        String presented = authCookies.read(request, AuthCookies.REFRESH);
        if (presented == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Refresh token missing"));
        }

        AuthService.Rotation rotation = authService.rotateRefreshToken(presented);
        UserEntity user = rotation.user();
        String newAccessToken = jwtService.generateAccessToken(user.getEmail(), user.getRole());

        authCookies.set(request, response, AuthCookies.ACCESS, newAccessToken, jwtAccessExpirationMs / 1000);
        authCookies.set(request, response, AuthCookies.REFRESH, rotation.refreshToken(), jwtRefreshExpirationMs / 1000);
        return ResponseEntity.ok(Map.of("message", "Token refreshed successfully"));
    }

    /** Ends a social sign-in: turns the code from the redirect into session cookies, in this browser only. */
    @PostMapping("/oauth2/exchange")
    public ResponseEntity<?> exchangeOAuthCode(HttpServletRequest request, HttpServletResponse response,
                                               @RequestBody Map<String, String> body) {
        String binding = authCookies.read(request, AuthCookies.OAUTH_BINDING);
        authCookies.clear(request, response, AuthCookies.OAUTH_BINDING);

        UserEntity user = oAuthExchangeService.consume(body.get("code"), binding)
                .map(userService::findById)
                .filter(UserEntity::isActive)
                .orElseThrow(() -> new AppException("This sign-in link is not valid anymore.", HttpStatus.UNAUTHORIZED));

        setTokens(response, user);
        return ResponseEntity.ok(Map.of("message", "Login successful"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.revokeSession(authCookies.read(request, AuthCookies.REFRESH));

        // Invalidate the session if it exists to destroy any Spring Security context cached in the HttpSession
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        authCookies.clear(request, response, AuthCookies.ACCESS);
        authCookies.clear(request, response, AuthCookies.REFRESH);
        authCookies.clearSession(request, response, sessionCookieSameSite);

        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(java.security.Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }

        String email = principal.getName();
        UserEntity user = userService.findByEmail(email);

        return ResponseEntity.ok(UserMeResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole())
                .isActive(user.isActive())
                .isConfirmed(user.isConfirmed())
                .build());
    }


    @PostMapping("/confirm-email")
    public ResponseEntity<?> confirmEmail(
            java.security.Principal principal,
            @RequestBody Map<String, String> body) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }

        String email = principal.getName();
        String code = body.get("code");

        confirmationCodeService.validateConfirmationCode(email, code, CodePurpose.EMAIL_CONFIRMATION);
        userService.confirmEmail(email);

        return ResponseEntity.ok(Map.of("message", "Email confirmed successfully."));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            HttpServletResponse response,
            java.security.Principal principal,
            @RequestBody Map<String, String> body) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }

        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");

        if (currentPassword == null || currentPassword.isBlank() ||
            newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Both current and new passwords are required."));
        }

        if (newPassword.length() < 8 || newPassword.length() > ContentLimits.PASSWORD) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be between 8 and 72 characters."));
        }

        UserEntity user = userService.findByEmail(principal.getName());

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Current password is incorrect."));
        }

        if (confirmationCodeService.isConfirmationCodeEnabled()) {
            String code = body.get("code");
            confirmationCodeService.validateConfirmationCode(user.getEmail(), code, CodePurpose.PASSWORD_CHANGE);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userService.save(user);

        // Every other session ends; this one continues on a new token.
        authService.revokeAllSessions(user);
        setTokens(response, user);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully."));
    }

    private void setTokens(HttpServletResponse response, UserEntity user) {
        String accessToken = jwtService.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = authService.createRefreshToken(user);

        authCookies.set(request, response, AuthCookies.ACCESS, accessToken, jwtAccessExpirationMs / 1000);
        authCookies.set(request, response, AuthCookies.REFRESH, refreshToken, jwtRefreshExpirationMs / 1000);
    }
}
