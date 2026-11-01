package com.exam_prep.api.user.auth;

import com.exam_prep.api.dto.ContentLimits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthRequest {
    @NotBlank(message = "Email is required.")
    @Email(message = "Please enter a valid email address.")
    @Size(max = ContentLimits.EMAIL)
    private String email;

    @NotBlank(message = "Password is required.")
    @Size(max = ContentLimits.PASSWORD)
    private String password;
}
