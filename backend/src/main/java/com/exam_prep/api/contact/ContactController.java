package com.exam_prep.api.contact;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.exam_prep.api.exception.AppException;

import java.util.Map;

/**
 * Controller exposing the public endpoint for the contact form.
 * Ensures the service must run behind HTTPS in production.
 */
@RestController
@RequestMapping("/contact")
@RequiredArgsConstructor
@Slf4j
public class ContactController {

    private final ContactService contactService;

    /**
     * Submit a new contact message.
     * Note: In production, this endpoint must run behind HTTPS to ensure
     * secure transmission of user data.
     *
     * @param request the validated ContactRequest DTO
     * @param httpServletRequest the HttpServletRequest to retrieve the client IP address
     * @return a generic success response, or custom validation/rate-limit exception response
     */
    @PostMapping
    public ResponseEntity<?> submitContact(
            @Valid @RequestBody ContactRequest request,
            HttpServletRequest httpServletRequest) {
        
        String ipAddress = getClientIp(httpServletRequest);

        try {
            contactService.processContactSubmission(request, ipAddress);
            return ResponseEntity.ok(Map.of("message", "Thank you! Your message has been received."));
        } catch (AppException e) {
            // Re-throw custom AppExceptions (like 429 Rate Limit) to let GlobalExceptionHandler handle it
            throw e;
        } catch (Exception e) {
            // Catch unexpected exceptions and return a generic message.
            // Log the stack trace only on the server. Never expose it to the client.
            log.error("Unexpected error in contact endpoint", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "An unexpected error occurred. Please try again later."));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        // Tomcat's RemoteIpValve has already applied trusted forwarded headers.
        return request.getRemoteAddr();
    }
}
