package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.exam_prep.api.dto.RetentionDtos;
import com.exam_prep.api.service.ReminderService;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_DEV')")
public class AdminReminderController {

    private final ReminderService reminderService;

    /** Runs the reminder job now. Safe to repeat: each user gets at most one reminder per day. */
    @PostMapping("/reminders/run")
    public ResponseEntity<RetentionDtos.ReminderRunResult> runReminders() {
        return ResponseEntity.ok(reminderService.run());
    }
}
