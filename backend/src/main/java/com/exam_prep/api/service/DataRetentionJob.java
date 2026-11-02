package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Removes records once they are no longer needed. Tokens, codes, send counters, visit telemetry and upload counters
 * have their own clean-up next to the code that writes them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataRetentionJob {

    /** Lockouts last at most a day; the record only helps spot repeated attempts. */
    static final int LOGIN_LOCKOUT_DAYS = 30;
    static final int CONTACT_MESSAGE_DAYS = 365;
    /** Longer than the 30-day AI quota window and the monthly spending total. */
    static final int AI_JOB_DAYS = 90;

    static final String DELETE_LOCKOUTS = "DELETE FROM login_lockouts WHERE updated_at < now() - make_interval(days => ?)";
    static final String DELETE_CONTACTS = "DELETE FROM contact_messages WHERE created_at < now() - make_interval(days => ?)";
    static final String DELETE_AI_JOBS = """
            DELETE FROM ai_generation_jobs
            WHERE created_at < now() - make_interval(days => ?) AND status NOT IN ('QUEUED', 'PROCESSING')
            """;

    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 20 3 * * *", zone = "UTC")
    public void run() {
        int lockouts = jdbcTemplate.update(DELETE_LOCKOUTS, LOGIN_LOCKOUT_DAYS);
        int contacts = jdbcTemplate.update(DELETE_CONTACTS, CONTACT_MESSAGE_DAYS);
        int aiJobs = jdbcTemplate.update(DELETE_AI_JOBS, AI_JOB_DAYS);
        log.info("Retention: removed {} login lockouts, {} contact messages, {} AI jobs", lockouts, contacts, aiJobs);
    }
}
