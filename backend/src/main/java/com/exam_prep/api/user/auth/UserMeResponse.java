package com.exam_prep.api.user.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class UserMeResponse {
    private UUID id;
    private String email;
    private String name;
    private String role;
    @JsonProperty("isActive")
    private boolean isActive;

    @JsonProperty("isConfirmed")
    private boolean isConfirmed;
}
