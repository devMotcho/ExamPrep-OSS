package com.exam_prep.api.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.config.CustomStatementInspector;

import java.time.LocalDate;

@Service
public class QueryTelemetryService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Scheduled(fixedDelay = 5000) // sync every 5 seconds
    @Transactional
    public void syncQueriesToDatabase() {
        long pendingQueries = CustomStatementInspector.queryCounter.getAndSet(0);
        if (pendingQueries > 0) {
            LocalDate today = LocalDate.now();
            try {
                jdbcTemplate.update(
                    "INSERT INTO query_telemetry (recorded_date, query_count) VALUES (?, ?) " +
                    "ON CONFLICT (recorded_date) DO UPDATE SET query_count = query_telemetry.query_count + EXCLUDED.query_count",
                    today, pendingQueries
                );
            } catch (Exception e) {
                // If it fails, restore the count so we don't lose telemetry data
                CustomStatementInspector.queryCounter.addAndGet(pendingQueries);
                System.err.println("Failed to sync query telemetry: " + e.getMessage());
            }
        }
    }
}
