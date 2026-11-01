package com.exam_prep.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class AdminDashboardStatsDto {
    private long totalUsers;
    private long newUsers7Days;
    private long newUsers30Days;
    private double newUsers7DaysGrowth;
    private double newUsers30DaysGrowth;
    private long activeUsers;
    private long totalMessages;
    private long unreadMessages;
    
    private double usersGrowthPercentage;
    private double messagesGrowthPercentage;
    
    private long totalQueries;
    private boolean emailChannelActive;
    private boolean registrationOpen;
    private long adminCount;
    private long totalDevices;
    private long authenticatedDevices;
    private long visitorDevices;
    
    private List<Map<String, Object>> registrationTrend;
    private List<Map<String, Object>> messagesTrend;
    private List<Map<String, Object>> queriesTrend;
    
    private List<UserActivity> recentUsers;
    private List<MessageActivity> recentMessages;

    @Data
    @Builder
    public static class UserActivity {
        private java.util.UUID id;
        private String name;
        private String email;
        private String role;
        private String phone;
        private boolean isActive;
        private String lastLoginAt;
        private String createdAt;
        private String updatedAt;
    }

    @Data
    @Builder
    public static class MessageActivity {
        private java.util.UUID id;
        private String name;
        private String email;
        private String subject;
        private String message;
        private String createdAt;
        
        @JsonProperty("isRead")
        private boolean isRead;
        
        private String statusName;
        private String statusColor;
        private java.util.UUID statusId;
        private String sentChannels;
        private String type;
        private String ipAddress;
        private String replyMessage;
    }
}
