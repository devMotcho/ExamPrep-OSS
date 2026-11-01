package com.exam_prep.api.config;

/**
 * Well-known keys stored in {@code SiteConfigEntity}, used to configure
 * outbound email behavior (sender identity + optional dynamic SMTP override).
 */
public enum SiteConfigKey {

    EMAIL_ENABLED("email_enabled"),
    EMAIL_SENDER_NAME("email_sender_name"),
    SMTP_HOST("smtp_host"),
    SMTP_PORT("smtp_port"),
    SMTP_USERNAME("smtp_username"),
    SMTP_PASSWORD("smtp_password");

    private final String key;

    SiteConfigKey(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}