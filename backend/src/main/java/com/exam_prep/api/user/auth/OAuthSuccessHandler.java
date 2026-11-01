package com.exam_prep.api.user.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.user.UserEntity;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Handles successful OAuth2 authentication.
 *
 * <p>After Spring Security validates the provider's token, this handler:
 * <ol>
 *   <li>Checks the runtime {@code site_config} toggle for the provider.</li>
 *   <li>Finds or creates the local {@link UserEntity} via {@link AuthService#findOrCreateOAuthUser}.</li>
 *   <li>Redirects the browser to the frontend with tokens encoded in the <strong>URL hash fragment</strong>
 *       (e.g. {@code /dashboard#access_token=...&refresh_token=...}).</li>
 * </ol>
 *
 * <h2>Why hash fragments instead of cookies?</h2>
 * <p>When the frontend and backend are on different registrable domains,
 * the browser's Public Suffix List treats them as cross-site. Any cookie set by the backend during
 * the OAuth callback redirect is partitioned to the backend domain and invisible to the frontend —
 * regardless of {@code SameSite=None}, {@code Secure}, or {@code Partitioned} attributes.
 *
 * <p>Hash fragments are <em>never sent to any server</em>. They are only accessible by JavaScript
 * running on the redirected page, making them safe for token handoff across domain boundaries.
 * The frontend reads the fragment, stores the tokens in {@code localStorage}, cleans the URL,
 * and injects the access token as an {@code Authorization: Bearer} header on all API requests.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final JwtService jwtService;
    private final SiteConfigRepository siteConfigRepository;

    @Value("${app.jwt.access-expiration-ms}")
    private long jwtAccessExpirationMs;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            response.sendRedirect(frontendUrl + "/login?oauth_error=true");
            return;
        }

        String registrationId = oauthToken.getAuthorizedClientRegistrationId(); // "google" or "microsoft"
        OAuth2User oauthUser = oauthToken.getPrincipal();

        // --- Runtime site_config toggle check ---
        String configKey = "oauth_" + registrationId + "_enabled";
        boolean providerEnabled = siteConfigRepository.findById(configKey)
                .map(c -> "true".equalsIgnoreCase(c.getValue()))
                .orElse(false);

        if (!providerEnabled) {
            log.warn("OAuth2 login attempted for disabled provider '{}' — blocking.", registrationId);
            response.sendRedirect(frontendUrl + "/login?oauth_error=provider_disabled");
            return;
        }

        // --- Extract user attributes (Google and Microsoft use different attribute names) ---
        String email = getAttribute(oauthUser, "email");
        String name  = getAttribute(oauthUser, "name");
        String sub   = getAttribute(oauthUser, "sub");

        if (email == null || sub == null) {
            log.error("OAuth2 response from '{}' missing required attributes (email={}, sub={})", registrationId, email, sub);
            response.sendRedirect(frontendUrl + "/login?oauth_error=missing_attributes");
            return;
        }

        try {
            UserEntity user = authService.findOrCreateOAuthUser(email, name, registrationId, sub,
                    "true".equalsIgnoreCase(getAttribute(oauthUser, "email_verified")));

            String accessToken  = jwtService.generateAccessToken(user.getEmail(), user.getRole());
            String refreshToken = authService.createRefreshToken(user);
            long expiresIn = jwtAccessExpirationMs / 1000;

            // Encode tokens into the URL hash fragment.
            // Hash fragments are NEVER sent to any server — they are only readable by
            // client-side JavaScript on the redirected page. This bypasses all cross-site
            // cookie restrictions without any security trade-off.
            String fragment = "access_token=" + URLEncoder.encode(accessToken, StandardCharsets.UTF_8)
                    + "&refresh_token=" + URLEncoder.encode(refreshToken, StandardCharsets.UTF_8)
                    + "&expires_in=" + expiresIn;

            log.info("OAuth2 login success for user '{}' via provider '{}' — redirecting with token fragment", email, registrationId);
            response.sendRedirect(frontendUrl + "/dashboard#" + fragment);

        } catch (AppException ex) {
            log.warn("OAuth2 login rejected for '{}' via '{}': {}", email, registrationId, ex.getMessage());
            response.sendRedirect(frontendUrl + "/login?oauth_error=" + ex.getStatus().value());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String getAttribute(OAuth2User user, String key) {
        Object value = user.getAttributes().get(key);
        return value != null ? value.toString() : null;
    }
}
