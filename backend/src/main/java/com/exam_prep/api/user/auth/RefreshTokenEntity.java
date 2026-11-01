package com.exam_prep.api.user.auth;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;
import java.util.UUID;

import com.exam_prep.api.user.UserEntity;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    /** SHA-256 of the token. The token itself is only ever known to the browser. */
    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    /** All tokens descending from one sign-in. Reusing a rotated token ends the whole family. */
    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    /** When this token was exchanged for its successor. */
    @Column(name = "rotated_at")
    private ZonedDateTime rotatedAt;

    @Column(name = "expiry_date", nullable = false)
    private ZonedDateTime expiryDate;

    @Column(nullable = false)
    private boolean revoked;

    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = ZonedDateTime.now();
        revoked = false;
    }
}
