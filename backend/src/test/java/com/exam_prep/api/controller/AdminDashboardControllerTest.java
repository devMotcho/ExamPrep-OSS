package com.exam_prep.api.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.exam_prep.api.dto.AdminDashboardStatsDto;
import com.exam_prep.api.repository.ContactMessageRepository;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.user.UserRepository;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AdminDashboardControllerTest {

    private final Locale original = Locale.getDefault();

    @AfterEach
    void restoreLocale() {
        Locale.setDefault(original);
    }

    @Test
    void growthIsReadableUnderALocaleWithADecimalComma() {
        Locale.setDefault(Locale.forLanguageTag("pt-PT"));

        UserRepository users = mock(UserRepository.class);
        when(users.countByCreatedAtAfterAndRoleNot(any(), anyString())).thenReturn(5L);
        when(users.countByCreatedAtBetweenAndRoleNot(any(), any(), anyString())).thenReturn(4L);
        AdminDashboardController controller = new AdminDashboardController(users,
                mock(ContactMessageRepository.class), mock(SiteConfigRepository.class), mock(JdbcTemplate.class));

        AdminDashboardStatsDto stats = controller.getDashboardStats().getBody();

        assertEquals(25.0, stats.getNewUsers7DaysGrowth());
        assertEquals(25.0, stats.getNewUsers30DaysGrowth());
    }
}
