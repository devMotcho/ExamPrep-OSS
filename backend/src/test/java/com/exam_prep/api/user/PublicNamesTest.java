package com.exam_prep.api.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.ZonedDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.exam_prep.api.dto.StudyAreaSummaryDto;
import com.exam_prep.api.entity.Visibility;

class PublicNamesTest {

    private final UUID creatorId = UUID.randomUUID();

    @Test
    void showsOnlyTheFirstWordOfTheName() {
        assertEquals("Maria", PublicNames.of(null, "Maria Inês Costa"));
        assertEquals("Maria", PublicNames.of("  ", "  Maria   Costa "));
    }

    @Test
    void prefersTheChosenPublicName() {
        assertEquals("mcosta", PublicNames.of(" mcosta ", "Maria Costa"));
    }

    @Test
    void hasNoNameWhenTheAccountHasNone() {
        assertNull(PublicNames.of(null, null));
        assertNull(PublicNames.of("", " "));
    }

    @Test
    void anonymousVisitorsSeeThePublicNameAndNoId() {
        StudyAreaSummaryDto summary = summary();
        summary.showTo(null);
        assertEquals("Maria", summary.getCreatedBy());
        assertNull(summary.getCreatedById());

        StudyAreaSummaryDto other = summary();
        other.showTo(user(UUID.randomUUID(), "ROLE_USER"));
        assertEquals("Maria", other.getCreatedBy());
        assertNull(other.getCreatedById());
    }

    @Test
    void theCreatorAndStaffGetTheId() {
        StudyAreaSummaryDto mine = summary();
        mine.showTo(user(creatorId, "ROLE_USER"));
        assertEquals(creatorId, mine.getCreatedById());
        assertEquals("Maria", mine.getCreatedBy());

        StudyAreaSummaryDto staff = summary();
        staff.showTo(user(UUID.randomUUID(), "ROLE_ADMIN"));
        assertEquals(creatorId, staff.getCreatedById());
        assertEquals("Maria Costa", staff.getCreatedBy());
    }

    private StudyAreaSummaryDto summary() {
        return new StudyAreaSummaryDto(UUID.randomUUID(), "t", null, "Maria Costa", null, creatorId,
                ZonedDateTime.now(), Visibility.PUBLIC, 0, 0);
    }

    private static UserEntity user(UUID id, String role) {
        return UserEntity.builder().id(id).email("x@example.org").role(role).build();
    }
}
