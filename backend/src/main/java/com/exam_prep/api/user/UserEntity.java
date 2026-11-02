package com.exam_prep.api.user;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;
import java.time.ZonedDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@DynamicUpdate
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    /** Never serialized: admin endpoints return this entity directly. */
    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role;

    @Column(name = "name")
    private String name;

    /** Shown to other people instead of {@link #name}; null falls back to the first word of the name. */
    @Column(name = "public_name", length = 60)
    private String publicName;

    @Column(name = "phone")
    private String phone;

    @Column(name = "is_confirmed", nullable = false)
    @Builder.Default
    private boolean isConfirmed = true;

    @Column(name = "is_active", nullable = false)
    @JsonProperty("active")
    private boolean isActive;

    @Column(name = "last_login_at")
    private ZonedDateTime lastLoginAt;

    /** OAuth2 provider name, e.g. "google" or "microsoft". Null for local accounts. */
    @Column(name = "oauth_provider")
    private String oauthProvider;

    /** Provider-issued subject identifier (stable unique user ID from the IdP). */
    @Column(name = "oauth_subject")
    private String oauthSubject;

    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
        updatedAt = createdAt;
        isActive = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = ZonedDateTime.now();
    }
}
