package com.exam_prep.api.user.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @Value("${app.jwt.access-expiration-ms}")
    private long jwtAccessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long jwtRefreshExpirationMs;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${server.servlet.session.cookie.same-site:Lax}")
    private String sessionCookieSameSite;

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/send-code")
    public ResponseEntity<?> sendCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required."));
        }
        confirmationCodeService.sendConfirmationCode(email);
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

        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be at least 8 characters."));
        }

        confirmationCodeService.validateConfirmationCode(email, code);
        authService.resetPassword(email, newPassword);

        return ResponseEntity.ok(Map.of("message", NEUTRAL_PASSWORD_RESET));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest requestBody) {
        if (confirmationCodeService.isConfirmationCodeEnabled()) {
            confirmationCodeService.validateConfirmationCode(requestBody.getEmail(), requestBody.getCode());
        }
        authService.register(requestBody);
        return ResponseEntity.ok(Map.of("message", "User registered successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest requestBody, HttpServletResponse response) {
        String ip = clientIpResolver.resolveClientIp(request);
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
    public ResponseEntity<?> refresh(HttpServletRequest request,
                                     HttpServletResponse response,
                                     @RequestBody(required = false) Map<String, String> body) {
        // Cookie path (standard email/password login)
        String refreshTokenStr = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refresh_token".equals(cookie.getName())) {
                    refreshTokenStr = cookie.getValue();
                }
            }
        }

        // Bearer path (OAuth2 / cross-domain — token sent in request body)
        boolean isBearerPath = false;
        if (refreshTokenStr == null && body != null) {
            refreshTokenStr = body.get("refresh_token");
            if (refreshTokenStr != null) {
                isBearerPath = true;
            }
        }

        if (refreshTokenStr == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Refresh token missing"));
        }

        RefreshTokenEntity refreshTokenEntity = authService.verifyRefreshToken(refreshTokenStr);
        UserEntity user = refreshTokenEntity.getUser();

        // Rotate refresh token
        String newRefreshToken = authService.rotateRefreshToken(refreshTokenEntity);
        String newAccessToken  = jwtService.generateAccessToken(user.getEmail(), user.getRole());

        if (isBearerPath) {
            // Return new tokens in the response body so the frontend can update localStorage
            return ResponseEntity.ok(Map.of(
                    "access_token",  newAccessToken,
                    "refresh_token", newRefreshToken,
                    "expires_in",    jwtAccessExpirationMs / 1000
            ));
        }

        // Cookie path — set httpOnly cookies as usual
        addCookie(response, "access_token",  newAccessToken,  jwtAccessExpirationMs);
        addCookie(response, "refresh_token", newRefreshToken, jwtRefreshExpirationMs);
        return ResponseEntity.ok(Map.of("message", "Token refreshed successfully"));
    }


    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        // Invalidate the session if it exists to destroy any Spring Security context cached in the HttpSession
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        clearCookie(response, "access_token");
        clearCookie(response, "refresh_token");

        // Clear the JSESSIONID cookie as well, with the attributes it was set with
        boolean secure = isSecureCookie();
        String secureFlag = secure ? " Secure;" : "";
        String partitionedFlag = secure ? " Partitioned;" : "";
        response.addHeader("Set-Cookie", String.format("JSESSIONID=; Max-Age=0; Path=/; HttpOnly;%s%s SameSite=%s",
                secureFlag, partitionedFlag, sessionCookieSameSite));

        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(java.security.Principal principal) {
        // JwtAuthFilter populates the Spring Security context for BOTH auth paths:
        //   • Cookie path  (standard login)  — reads access_token httpOnly cookie
        //   • Bearer path  (OAuth2 login)     — reads Authorization: Bearer header
        // Using Principal here means this endpoint works identically for both.
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

        confirmationCodeService.validateConfirmationCode(email, code);
        userService.confirmEmail(email);

        return ResponseEntity.ok(Map.of("message", "Email confirmed successfully."));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
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

        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be at least 8 characters."));
        }

        UserEntity user = userService.findByEmail(principal.getName());

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Current password is incorrect."));
        }

        if (confirmationCodeService.isConfirmationCodeEnabled()) {
            String code = body.get("code");
            confirmationCodeService.validateConfirmationCode(user.getEmail(), code);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userService.save(user);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully."));
    }

    private void setTokens(HttpServletResponse response, UserEntity user) {
        String accessToken = jwtService.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = authService.createRefreshToken(user);

        addCookie(response, "access_token", accessToken, jwtAccessExpirationMs);
        addCookie(response, "refresh_token", refreshToken, jwtRefreshExpirationMs);
    }

    private boolean isSecureCookie() {
        if (cookieSecure) {
            return true;
        }
        if (request == null) {
            return false;
        }
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if ("https".equalsIgnoreCase(forwardedProto)) {
            return true;
        }

        String serverName = request.getServerName();
        if (serverName == null) {
            return true;
        }

        // Local development hostnames
        if (serverName.equals("localhost") || 
            serverName.equals("127.0.0.1") || 
            serverName.equals("0.0.0.0") || 
            serverName.endsWith(".local")) {
            return false;
        }

        // Private local IP ranges (RFC 1918)
        if (serverName.startsWith("192.168.") || serverName.startsWith("10.")) {
            return false;
        }

        if (serverName.startsWith("172.")) {
            try {
                String[] parts = serverName.split("\\.");
                if (parts.length >= 2) {
                    int secondOctet = Integer.parseInt(parts[1]);
                    if (secondOctet >= 16 && secondOctet <= 31) {
                        return false;
                    }
                }
            } catch (Exception e) {
                // Ignore parsing errors, default to secure
            }
        }

        // For all public domains in production, we must enforce Secure cookies
        return true;
    }

    private void addCookie(HttpServletResponse response, String name, String value, long maxAgeMs) {
        // Add SameSite attribute via header because standard Cookie class doesn't support it well in older Java versions
        boolean secure = isSecureCookie();
        String secureFlag      = secure ? " Secure;" : "";
        String partitionedFlag = secure ? " Partitioned;" : "";
        response.addHeader("Set-Cookie", String.format("%s=%s; Max-Age=%d; Path=/; HttpOnly;%s%s SameSite=%s",
                name, value, maxAgeMs / 1000, secureFlag, partitionedFlag, cookieSameSite));
    }

    private void clearCookie(HttpServletResponse response, String name) {
        boolean secure = isSecureCookie();
        String secureFlag      = secure ? " Secure;" : "";
        String partitionedFlag = secure ? " Partitioned;" : "";
        response.addHeader("Set-Cookie", String.format("%s=; Max-Age=0; Path=/; HttpOnly;%s%s SameSite=%s",
                name, secureFlag, partitionedFlag, cookieSameSite));
    }
}
