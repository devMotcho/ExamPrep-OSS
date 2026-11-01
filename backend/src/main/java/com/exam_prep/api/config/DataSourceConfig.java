package com.exam_prep.api.config;

import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

/**
 * Normalises the datasource URL so that a hosting platform's DATABASE_URL
 * (postgresql://...) is accepted alongside the standard jdbc:postgresql:// form.
 */
@Configuration
public class DataSourceConfig {

    /**
     * Override the default DataSourceProperties so we can fix the URL before
     * HikariCP uses it.
     */
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties() {
            @Override
            public String getUrl() {
                String url = super.getUrl();
                if (url != null && url.startsWith("postgresql://")) {
                    return "jdbc:" + url;
                }
                return url;
            }
        };
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        return properties
                .initializeDataSourceBuilder()
                .build();
    }
}
