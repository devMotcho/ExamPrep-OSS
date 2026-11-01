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
public class RegisterRequest {

    @NotBlank(message = "Name is required.")
    @Size(max = ContentLimits.NAME)
    private String name;

    @NotBlank(message = "Email is required.")
    @Email(message = "Please enter a valid email address.")
    @Size(max = ContentLimits.EMAIL)
    private String email;

    @Size(max = ContentLimits.PHONE)
    private String phone;

    @NotBlank(message = "Password is required.")
    @Size(min = 8, max = ContentLimits.PASSWORD, message = "Password must be between 8 and 72 characters.")
    private String password;

    @NotBlank(message = "Please confirm your password.")
    @Size(max = ContentLimits.PASSWORD)
    private String confirmPassword;

    @Size(max = 10)
    private String code;
}
