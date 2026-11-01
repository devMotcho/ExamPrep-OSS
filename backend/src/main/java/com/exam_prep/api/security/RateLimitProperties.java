package com.exam_prep.api.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.rate-limit")
@Getter
@Setter
public class RateLimitProperties {

    private int loginLimit = 5;
    private int registerLimit = 3;
    private int contactLimit = 3;
    private int telemetryLimit = 30;
    private int defaultLimit = 120;
    /** All requests from one client per minute, on top of the limit of each route. */
    private int totalLimit = 600;
}
