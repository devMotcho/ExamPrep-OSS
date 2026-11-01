package com.exam_prep.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Isolates the {@link PasswordEncoder} bean in its own configuration class.
 *
 * <p>This is necessary to avoid a circular Spring bean dependency:
 * {@code SecurityConfig} → {@code OAuthSuccessHandler} → {@code AuthService}
 * → {@code PasswordEncoder} → {@code SecurityConfig} (which was still being
 * constructed). Moving the bean here breaks that cycle completely.
 */
@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
