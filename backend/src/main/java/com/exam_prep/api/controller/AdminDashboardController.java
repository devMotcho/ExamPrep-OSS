package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.exam_prep.api.dto.AdminDashboardStatsDto;
import com.exam_prep.api.entity.ContactMessageEntity;
import com.exam_prep.api.repository.ContactMessageRepository;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_DEV')")
public class AdminDashboardController {

    private final UserRepository userRepository;
    private final ContactMessageRepository contactMessageRepository;
    private final com.exam_prep.api.repository.SiteConfigRepository siteConfigRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping("/stats")
    public ResponseEntity<AdminDashboardStatsDto> getDashboardStats() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isDev = auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_DEV".equals(a.getAuthority()));

        long totalUsers = isDev ? userRepository.count() : userRepository.countByRoleNot("ROLE_DEV");
        long activeUsers = isDev ? userRepository.countByIsActiveTrue() : userRepository.countByIsActiveTrueAndRoleNot("ROLE_DEV");
        long totalMessages = contactMessageRepository.count();
        long unreadMessages = contactMessageRepository.countByStatusIsNull();

        Long dbQuerySum = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(query_count), 0) FROM query_telemetry", Long.class);
        long totalQueries = (dbQuerySum != null ? dbQuerySum : 0L) + com.exam_prep.api.config.CustomStatementInspector.queryCounter.get();

        boolean emailChannelActive = siteConfigRepository.findById("email_enabled")
                .map(c -> "true".equalsIgnoreCase(c.getValue()))
                .orElse(false);

        boolean registrationOpen = siteConfigRepository.findById("register_enabled")
                .map(c -> "true".equalsIgnoreCase(c.getValue()))
                .orElse(false);

        long adminCount = userRepository.countByRole("ROLE_ADMIN") + userRepository.countByRole("ROLE_DEV");

        Long deviceCountObj = jdbcTemplate.queryForObject("SELECT COUNT(DISTINCT device_id) FROM device_telemetry", Long.class);
        long totalDevices = deviceCountObj != null ? deviceCountObj : 0L;

        Long authDeviceCountObj = jdbcTemplate.queryForObject("SELECT COUNT(DISTINCT device_id) FROM device_telemetry WHERE is_authenticated = true", Long.class);
        long authenticatedDevices = authDeviceCountObj != null ? authDeviceCountObj : 0L;

        Long visDeviceCountObj = jdbcTemplate.queryForObject("SELECT COUNT(DISTINCT device_id) FROM device_telemetry WHERE is_authenticated = false", Long.class);
        long visitorDevices = visDeviceCountObj != null ? visDeviceCountObj : 0L;

        List<Map<String, Object>> regTrend = new ArrayList<>();
        List<Map<String, Object>> msgTrend = new ArrayList<>();
        List<Map<String, Object>> queriesTrend = new ArrayList<>();

        ZonedDateTime now = ZonedDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd");
        ZonedDateTime sevenDaysAgo = now.minusDays(7).withHour(0).withMinute(0).withSecond(0).withNano(0);
        
        List<UserEntity> recentUsersList = userRepository.findByCreatedAtAfter(sevenDaysAgo);
        List<ContactMessageEntity> recentMessagesList = contactMessageRepository.findByCreatedAtAfter(sevenDaysAgo);

        for (int i = 6; i >= 0; i--) {
            ZonedDateTime day = now.minusDays(i);
            String label = day.format(formatter);
            java.time.LocalDate localDate = day.toLocalDate();

            long regCount = recentUsersList.stream()
                    .filter(u -> isSameDay(u.getCreatedAt(), day))
                    .filter(u -> isDev || !"ROLE_DEV".equals(u.getRole()))
                    .count();

            long msgCount = recentMessagesList.stream()
                    .filter(m -> isSameDay(m.getCreatedAt(), day))
                    .count();

            Long dayQueryCount = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(query_count), 0) FROM query_telemetry WHERE recorded_date = ?",
                Long.class, localDate
            );
            long qCount = (dayQueryCount != null ? dayQueryCount : 0L);

            if (localDate.equals(java.time.LocalDate.now())) {
                qCount += com.exam_prep.api.config.CustomStatementInspector.queryCounter.get();
            }

            long displayCount = qCount;

            regTrend.add(Map.of("name", label, "value", regCount));
            msgTrend.add(Map.of("name", label, "value", msgCount));
            queriesTrend.add(Map.of("name", label, "value", displayCount));
        }

        List<UserEntity> rawRecentUsers = isDev
                ? userRepository.findTop5ByOrderByCreatedAtDesc()
                : userRepository.findTop5ByRoleNotOrderByCreatedAtDesc("ROLE_DEV");

        List<AdminDashboardStatsDto.UserActivity> recentUsers = rawRecentUsers.stream()
                .map(u -> AdminDashboardStatsDto.UserActivity.builder()
                        .id(u.getId())
                        .name(u.getName())
                        .email(u.getEmail())
                        .role(u.getRole().replace("ROLE_", ""))
                        .phone(u.getPhone())
                        .isActive(u.isActive())
                        .lastLoginAt(u.getLastLoginAt() != null ? u.getLastLoginAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null)
                        .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : "N/A")
                        .updatedAt(u.getUpdatedAt() != null ? u.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null)
                        .build())
                .collect(Collectors.toList());

        List<AdminDashboardStatsDto.MessageActivity> recentMessages = contactMessageRepository.findTop5ByStatusIsNullOrderByCreatedAtDesc().stream()
                .map(m -> AdminDashboardStatsDto.MessageActivity.builder()
                        .id(m.getId())
                        .name(m.getName())
                        .email(m.getEmail())
                        .subject(m.getSubject())
                        .message(m.getMessage())
                        .isRead(m.isRead())
                        .createdAt(m.getCreatedAt() != null ? m.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "N/A")
                        .statusId(m.getStatus() != null ? m.getStatus().getId() : null)
                        .statusName(m.getStatus() != null ? m.getStatus().getName() : null)
                        .statusColor(m.getStatus() != null ? m.getStatus().getColor() : null)
                        .sentChannels(m.getSentChannels())
                        .type(m.getType())
                        .ipAddress(m.getIpAddress())
                        .replyMessage(m.getReplyMessage())
                        .build())
                .collect(Collectors.toList());

        double usersGrowth = totalUsers > 0 ? Math.min(100.0, (double) regTrend.stream().mapToLong(m -> (Long) m.get("value")).sum() / totalUsers * 100.0) : 0.0;
        double messagesGrowth = totalMessages > 0 ? Math.min(100.0, (double) msgTrend.stream().mapToLong(m -> (Long) m.get("value")).sum() / totalMessages * 100.0) : 0.0;

        ZonedDateTime thirtyDaysAgo = now.minusDays(30).withHour(0).withMinute(0).withSecond(0).withNano(0);
        ZonedDateTime fourteenDaysAgo = now.minusDays(14).withHour(0).withMinute(0).withSecond(0).withNano(0);
        ZonedDateTime sixtyDaysAgo = now.minusDays(60).withHour(0).withMinute(0).withSecond(0).withNano(0);

        long newUsers7Days = isDev ? userRepository.countByCreatedAtAfter(sevenDaysAgo) : userRepository.countByCreatedAtAfterAndRoleNot(sevenDaysAgo, "ROLE_DEV");
        long newUsersPrevious7Days = isDev ? userRepository.countByCreatedAtBetween(fourteenDaysAgo, sevenDaysAgo) : userRepository.countByCreatedAtBetweenAndRoleNot(fourteenDaysAgo, sevenDaysAgo, "ROLE_DEV");
        long newUsers30Days = isDev ? userRepository.countByCreatedAtAfter(thirtyDaysAgo) : userRepository.countByCreatedAtAfterAndRoleNot(thirtyDaysAgo, "ROLE_DEV");
        long newUsersPrevious30Days = isDev ? userRepository.countByCreatedAtBetween(sixtyDaysAgo, thirtyDaysAgo) : userRepository.countByCreatedAtBetweenAndRoleNot(sixtyDaysAgo, thirtyDaysAgo, "ROLE_DEV");

        double newUsers7DaysGrowth = newUsersPrevious7Days > 0 ? ((double) (newUsers7Days - newUsersPrevious7Days) / newUsersPrevious7Days) * 100.0 : (newUsers7Days > 0 ? 100.0 : 0.0);
        double newUsers30DaysGrowth = newUsersPrevious30Days > 0 ? ((double) (newUsers30Days - newUsersPrevious30Days) / newUsersPrevious30Days) * 100.0 : (newUsers30Days > 0 ? 100.0 : 0.0);

        AdminDashboardStatsDto dto = AdminDashboardStatsDto.builder()
                .totalUsers(totalUsers)
                .newUsers7Days(newUsers7Days)
                .newUsers30Days(newUsers30Days)
                .newUsers7DaysGrowth(oneDecimal(newUsers7DaysGrowth))
                .newUsers30DaysGrowth(oneDecimal(newUsers30DaysGrowth))
                .activeUsers(activeUsers)
                .totalMessages(totalMessages)
                .unreadMessages(unreadMessages)
                .usersGrowthPercentage(oneDecimal(usersGrowth))
                .messagesGrowthPercentage(oneDecimal(messagesGrowth))
                .totalQueries(totalQueries)
                .emailChannelActive(emailChannelActive)
                .registrationOpen(registrationOpen)
                .adminCount(adminCount)
                .totalDevices(totalDevices)
                .authenticatedDevices(authenticatedDevices)
                .visitorDevices(visitorDevices)
                .registrationTrend(regTrend)
                .messagesTrend(msgTrend)
                .queriesTrend(queriesTrend)
                .recentUsers(recentUsers)
                .recentMessages(recentMessages)
                .build();

        return ResponseEntity.ok(dto);
    }

    private boolean isSameDay(ZonedDateTime t1, ZonedDateTime t2) {
        if (t1 == null || t2 == null) return false;
        return t1.getYear() == t2.getYear() && t1.getDayOfYear() == t2.getDayOfYear();
    }

    /** Locale.ROOT because parseDouble only reads a dot: under a locale with a decimal comma this would throw. */
    private static double oneDecimal(double value) {
        return Double.parseDouble(String.format(Locale.ROOT, "%.1f", value));
    }
}
