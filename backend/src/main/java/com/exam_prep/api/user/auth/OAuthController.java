package com.exam_prep.api.user.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.exam_prep.api.config.OAuthProperties;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Exposes the list of OAuth2 providers that are currently enabled at the
 * infrastructure level (via {@code app.oauth.*.enabled} in application.yml /
 * environment variables).
 *
 * <p>The frontend calls this endpoint on page load to conditionally render
 * "Continue with Google" / "Continue with Microsoft" buttons without any
 * hardcoded logic.
 *
 * <p>Note: this endpoint intentionally reflects only the <em>env-level</em>
 * flag. The additional runtime {@code site_config} toggle is enforced by
 * {@link com.exam_prep.api.user.auth.OAuthSuccessHandler} after the provider
 * callback completes, so the button is shown when env is enabled even if the
 * admin hasn't yet toggled it on — guiding the admin to do so.
 */
@RestController
@RequestMapping("/auth/oauth2")
@RequiredArgsConstructor
public class OAuthController {

    private final OAuthProperties oAuthProperties;

    /**
     * Returns the list of OAuth2 provider identifiers that are enabled.
     *
     * <p>Example response when both providers are on:
     * <pre>{@code { "providers": ["google", "microsoft"] }}</pre>
     *
     * @return 200 OK with a JSON object containing a {@code providers} list.
     */
    @GetMapping("/providers")
    public ResponseEntity<Map<String, List<String>>> getEnabledProviders() {
        List<String> enabled = new ArrayList<>();
        if (oAuthProperties.getGoogle().isEnabled()) {
            enabled.add("google");
        }
        if (oAuthProperties.getMicrosoft().isEnabled()) {
            enabled.add("microsoft");
        }
        return ResponseEntity.ok(Map.of("providers", enabled));
    }
}
