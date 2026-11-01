package com.exam_prep.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Configuration class to enable asynchronous execution.
 * Sets up a dedicated thread pool for non-blocking notification delivery.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Dedicated Executor bean for processing admin notifications in the background.
     */
    @Bean(name = "notificationExecutor")
    public Executor notificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(15);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("NotificationTask-");
        executor.initialize();
        return executor;
    }
}
