package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.exam_prep.api.exception.AppException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Per-user limits on uploads: MAX_UPLOAD_MB per file and MAX_UPLOADS_PER_DAY (a UTC day). A value of 0 turns
 * a limit off. Call this outside any transaction, so an upload that later fails still counts: otherwise
 * repeatedly sending files that fail would never reach the limit.
 */
@Service
@RequiredArgsConstructor
public class UploadLimitService {

    private static final long BYTES_PER_MB = 1024L * 1024L;

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.upload.max-mb:10}")
    private int maxMb;

    @Value("${app.upload.max-per-day:100}")
    private int maxPerDay;

    /** Checks the size first, so a rejected oversized file does not use up the daily allowance. */
    public void enforce(MultipartFile file, UUID userId) {
        if (maxMb > 0 && file.getSize() > maxMb * BYTES_PER_MB) {
            throw new AppException("The file is larger than the " + maxMb + " MB upload limit.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        if (maxPerDay > 0 && !claimDailySlot(userId)) {
            throw new AppException("You have reached the limit of " + maxPerDay + " uploads per day. Please try again tomorrow.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    /** One atomic statement, so concurrent uploads cannot pass the limit together. */
    private boolean claimDailySlot(UUID userId) {
        return jdbcTemplate.update("""
                INSERT INTO user_upload_usage (user_id, usage_date, upload_count) VALUES (?, ?, 1)
                ON CONFLICT (user_id, usage_date) DO UPDATE SET upload_count = user_upload_usage.upload_count + 1
                WHERE user_upload_usage.upload_count < ?
                """, userId, LocalDate.now(ZoneOffset.UTC), maxPerDay) > 0;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    public void deleteOldUsage() {
        jdbcTemplate.update("DELETE FROM user_upload_usage WHERE usage_date < ?", LocalDate.now(ZoneOffset.UTC).minusDays(2));
    }
}
