package com.exam_prep.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "site_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteConfigEntity {

    @Id
    @Column(name = "config_key")
    private String key;

    @Column(name = "config_value", nullable = false)
    private String value;

    @Column(name = "config_type", nullable = false)
    private String type;

    @Column(nullable = false)
    private String label;

    @Column(name = "config_group", nullable = false)
    private String group;

    @Column(name = "default_value")
    private String defaultValue;

    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = ZonedDateTime.now();
    }
}
