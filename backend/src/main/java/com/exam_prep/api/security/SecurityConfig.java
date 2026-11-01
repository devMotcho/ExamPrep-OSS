package com.exam_prep.api.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.exam_prep.api.config.OAuthProperties;
import com.exam_prep.api.user.auth.JwtAuthFilter;
import com.exam_prep.api.user.auth.OAuthFailureHandler;
import com.exam_prep.api.user.auth.OAuthSuccessHandler;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private static final String OAUTH_NOT_CONFIGURED = "not-configured";

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;
    private final OAuthProperties oAuthProperties;
    private final OAuthSuccessHandler oAuthSuccessHandler;
    private final OAuthFailureHandler oAuthFailureHandler;

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String googleClientId;

    @Value("${spring.security.oauth2.client.registration.microsoft.client-id}")
    private String microsoftClientId;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // nginx sends this header, and only when the operator opts in (see docs/self-hosting.md).
            .headers(headers -> headers.httpStrictTransportSecurity(hsts -> hsts.disable()))
            // CSRF disabled per requirements (managed by httpOnly cookies & SameSite)
            .csrf(AbstractHttpConfigurer::disable)
            // Prevent Spring Security from saving/restoring SecurityContext from HttpSession
            .securityContext(context -> context.securityContextRepository(new RequestAttributeSecurityContextRepository()))
            // OAuth2 flows need a short-lived session to carry the authorization state
            // between the /authorize redirect and the /callback. Stateless is kept for
            // all API requests; only the OAuth handshake uses session storage.
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers("/contact").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/config/public").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/gallery").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/study-areas").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/study-areas/{id}").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/blog/posts", "/api/blog/posts/{locale}/{slug}", "/api/blog/media/{id}").permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setContentType("application/json");
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"" + authException.getMessage() + "\"}");
                })
            )
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        // Conditionally enable OAuth2 login when at least one provider is configured
        boolean anyOauthEnabled = isUsable("Google", oAuthProperties.getGoogle().isEnabled(), googleClientId)
                | isUsable("Microsoft", oAuthProperties.getMicrosoft().isEnabled(), microsoftClientId);

        if (anyOauthEnabled) {
            http.oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(e -> e.baseUri("/auth/oauth2/authorize"))
                .redirectionEndpoint(e -> e.baseUri("/auth/oauth2/callback/*"))
                .successHandler(oAuthSuccessHandler)
                .failureHandler(oAuthFailureHandler)
            );
        }

        return http.build();
    }

    private static boolean isUsable(String provider, boolean enabled, String clientId) {
        if (enabled && OAUTH_NOT_CONFIGURED.equals(clientId)) {
            log.warn("{} sign-in is enabled but has no client id: it stays off until one is set.", provider);
            return false;
        }
        return enabled;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-Requested-With", "X-Retry"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
