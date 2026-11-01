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

/**
 * Handles successful OAuth2 authentication.
 *
 * <p>After Spring Security validates the provider's token, this handler checks the runtime
 * {@code site_config} toggle for the provider, finds or creates the local {@link UserEntity}, and redirects the
 * browser to the web app with a single-use code in the query string. No tokens travel in the URL: the app posts the
 * code to {@code /auth/oauth2/exchange}, which answers with HttpOnly cookies. See {@link OAuthExchangeService}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final OAuthExchangeService exchangeService;
    private final AuthCookies authCookies;
    private final SiteConfigRepository siteConfigRepository;

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
            log.error("OAuth2 response from '{}' is missing the email or subject attribute", registrationId);
            response.sendRedirect(frontendUrl + "/login?oauth_error=missing_attributes");
            return;
        }

        try {
            UserEntity user = authService.findOrCreateOAuthUser(email, name, registrationId, sub,
                    "true".equalsIgnoreCase(getAttribute(oauthUser, "email_verified")));

            OAuthExchangeService.Issued issued = exchangeService.issue(user.getId());
            authCookies.set(request, response, AuthCookies.OAUTH_BINDING, issued.binding(), OAuthExchangeService.LIFETIME.toSeconds());

            log.info("OAuth2 sign-in for user {} via '{}'", user.getId(), registrationId);
            response.sendRedirect(frontendUrl + "/dashboard?oauth_code=" + issued.code());

        } catch (AppException ex) {
            log.warn("OAuth2 sign-in rejected via '{}': {}", registrationId, ex.getStatus().value());
            response.sendRedirect(frontendUrl + "/login?oauth_error=" + ex.getStatus().value());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String getAttribute(OAuth2User user, String key) {
        Object value = user.getAttributes().get(key);
        return value != null ? value.toString() : null;
    }
}
