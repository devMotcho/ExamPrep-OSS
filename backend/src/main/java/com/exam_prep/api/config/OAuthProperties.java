package com.exam_prep.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Type-safe configuration properties for the OAuth2 feature toggles.
 * Binds properties prefixed with 'app.oauth' in application.yml.
 *
 * Each provider can be independently toggled via environment variables:
 *   OAUTH_GOOGLE_ENABLED=true
 *   OAUTH_MICROSOFT_ENABLED=true
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "app.oauth")
public class OAuthProperties {

    private Provider google = new Provider();
    private Provider microsoft = new Provider();

    @Data
    public static class Provider {
        /** Whether this OAuth2 provider is enabled at the infrastructure level. */
        private Boolean enabled = false;

        public boolean isEnabled() {
            return Boolean.TRUE.equals(this.enabled);
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = (enabled != null && enabled);
        }
    }
}
