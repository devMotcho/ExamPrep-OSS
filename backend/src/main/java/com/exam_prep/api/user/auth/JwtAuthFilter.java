package com.exam_prep.api.user.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.exam_prep.api.user.UserRepository;

import java.io.IOException;
import java.util.Collections;

/**
 * Extracts the JWT access token from either:
 * <ol>
 *   <li>The {@code access_token} httpOnly cookie — used by the standard email/password login path.</li>
 *   <li>The {@code Authorization: Bearer <token>} request header — used by the OAuth2 login path
 *       where the frontend stores the token in {@code localStorage} and injects it on every request,
 *       because cross-site httpOnly cookies cannot work when the frontend and backend are on different
 *       registrable domains.</li>
 * </ol>
 * The cookie is checked first so the standard path retains its existing behaviour unchanged.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractFromCookie(request);

        if (token == null) {
            token = extractFromBearerHeader(request);
        }

        if (token != null && jwtService.validateToken(token)) {
            String username = jwtService.extractUsername(token);
            String role     = jwtService.extractRole(token);

            if (username != null && role != null) {
                var userOpt = userRepository.findByEmail(username);
                if (userOpt.isPresent() && userOpt.get().isActive()) {
                    var authority = new SimpleGrantedAuthority(userOpt.get().getRole());
                    var auth = new UsernamePasswordAuthenticationToken(
                            username, null, Collections.singletonList(authority));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else {
                    SecurityContextHolder.clearContext();
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if ("access_token".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String extractFromBearerHeader(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
