package com.exam_prep.api.user.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.exam_prep.api.dto.ContentLimits;
import com.exam_prep.api.entity.CodePurpose;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.ConfirmationCodeService;
import com.exam_prep.api.user.AccountDataExporter;
import com.exam_prep.api.user.AccountDeletionService;
import com.exam_prep.api.user.PublicNames;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

import java.security.Principal;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The account owner's own data rights: see and download everything, correct the profile and email, and delete the
 * account.
 */
@RestController
@RequestMapping("/auth/me")
@RequiredArgsConstructor
public class AccountController {

    static final int PUBLIC_NAME_MAX = 60;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ConfirmationCodeService confirmationCodeService;
    private final AccountDataExporter accountDataExporter;
    private final AccountDeletionService accountDeletionService;
    private final AuthService authService;
    private final JwtService jwtService;
    private final AuthCookies authCookies;

    @Value("${app.jwt.access-expiration-ms}")
    private long jwtAccessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long jwtRefreshExpirationMs;

    @Value("${server.servlet.session.cookie.same-site:Lax}")
    private String sessionCookieSameSite;

    /** Every row tied to the account, as JSON. Password hashes, tokens and codes are left out. */
    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> export(Principal principal) {
        UserEntity user = currentUser(principal);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"examprep-data-" + LocalDate.now() + ".json\"")
                .body(accountDataExporter.export(user.getId(), user.getEmail()));
    }

    /** Name and public name. A blank public name means "use the first word of my name". */
    @PatchMapping
    public ResponseEntity<?> updateProfile(Principal principal, @RequestBody Map<String, String> body) {
        UserEntity user = currentUser(principal);
        if (body.containsKey("name")) {
            String name = clean(body.get("name"));
            if (name.isEmpty() || name.length() > ContentLimits.NAME) {
                throw new AppException("Name must have between 1 and " + ContentLimits.NAME + " characters.", HttpStatus.BAD_REQUEST);
            }
            user.setName(name);
        }
        if (body.containsKey("publicName")) {
            String publicName = clean(body.get("publicName"));
            if (publicName.length() > PUBLIC_NAME_MAX) {
                throw new AppException("Public name must have at most " + PUBLIC_NAME_MAX + " characters.", HttpStatus.BAD_REQUEST);
            }
            user.setPublicName(publicName.isEmpty() ? null : publicName);
        }
        userRepository.save(user);
        return ResponseEntity.ok(Map.of(
                "name", user.getName() == null ? "" : user.getName(),
                "publicName", user.getPublicName() == null ? "" : user.getPublicName()));
    }

    /**
     * Changes the sign-in email. Needs the password and, when confirmation codes are on, a code sent to the new
     * address (purpose EMAIL_CHANGE), so the new address is proven to belong to the person. Accounts that sign in with
     * Google or Microsoft keep the provider's email. Every other session ends, because tokens carry the email.
     */
    @PostMapping("/email")
    public ResponseEntity<?> changeEmail(Principal principal, @RequestBody Map<String, String> body,
                                         HttpServletRequest request, HttpServletResponse response) {
        UserEntity user = currentUser(principal);
        if (user.getOauthProvider() != null) {
            throw new AppException("This account signs in with " + user.getOauthProvider()
                    + "; its email is managed there.", HttpStatus.BAD_REQUEST);
        }
        String newEmail = body.getOrDefault("newEmail", "").trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(newEmail).matches() || newEmail.length() > ContentLimits.EMAIL) {
            throw new AppException("Enter a valid email address.", HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(body.getOrDefault("password", ""), user.getPassword())) {
            throw new AppException("Password is incorrect.", HttpStatus.UNAUTHORIZED);
        }
        if (newEmail.equalsIgnoreCase(user.getEmail())) {
            throw new AppException("That is already your email.", HttpStatus.BAD_REQUEST);
        }
        if (userRepository.existsByEmail(newEmail)) {
            throw new AppException("That email cannot be used.", HttpStatus.BAD_REQUEST);
        }
        boolean codeChecked = confirmationCodeService.isConfirmationCodeEnabled();
        if (codeChecked) {
            confirmationCodeService.validateConfirmationCode(newEmail, body.get("code"), CodePurpose.EMAIL_CHANGE);
        }

        String oldEmail = user.getEmail();
        user.setEmail(newEmail);
        if (codeChecked) {
            user.setConfirmed(true);
        }
        userRepository.save(user);
        accountDeletionService.moveEmailKeyedRows(oldEmail, newEmail);

        authService.revokeAllSessions(user);
        authCookies.set(request, response, AuthCookies.ACCESS,
                jwtService.generateAccessToken(user.getEmail(), user.getRole()), jwtAccessExpirationMs / 1000);
        authCookies.set(request, response, AuthCookies.REFRESH, authService.createRefreshToken(user), jwtRefreshExpirationMs / 1000);
        return ResponseEntity.ok(Map.of("email", newEmail));
    }

    /**
     * Deletes the account. Password accounts confirm with the password; Google and Microsoft accounts with a code sent
     * to their email (purpose ACCOUNT_DELETION). Staff accounts are removed by another administrator instead.
     */
    @DeleteMapping
    public ResponseEntity<?> deleteAccount(Principal principal, @RequestBody(required = false) Map<String, String> requestBody,
                                           HttpServletRequest request, HttpServletResponse response) {
        Map<String, String> body = requestBody == null ? Map.of() : requestBody;
        UserEntity user = currentUser(principal);
        if (PublicNames.isStaff(user)) {
            throw new AppException("Staff accounts are deleted by another administrator.", HttpStatus.FORBIDDEN);
        }
        if (user.getOauthProvider() == null) {
            if (!passwordEncoder.matches(body.getOrDefault("password", ""), user.getPassword())) {
                throw new AppException("Password is incorrect.", HttpStatus.UNAUTHORIZED);
            }
        } else {
            confirmationCodeService.validateConfirmationCode(user.getEmail(), body.get("code"), CodePurpose.ACCOUNT_DELETION);
        }

        accountDeletionService.delete(user.getId());

        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        authCookies.clear(request, response, AuthCookies.ACCESS);
        authCookies.clear(request, response, AuthCookies.REFRESH);
        authCookies.clearSession(request, response, sessionCookieSameSite);
        return ResponseEntity.ok(Map.of("message", "Account deleted."));
    }

    private UserEntity currentUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new AppException("Unauthorized", HttpStatus.UNAUTHORIZED));
    }

    private static String clean(String value) {
        return value == null ? "" : CONTROL.matcher(value).replaceAll("").trim();
    }
}
