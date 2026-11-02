package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.dto.ContentLimits;
import com.exam_prep.api.dto.OptionImportDto;
import com.exam_prep.api.dto.QuestionImportDto;
import com.exam_prep.api.dto.StudyAreaDto;
import com.exam_prep.api.dto.StudyAreaSummaryDto;
import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.entity.Visibility;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.ChapterRepository;
import com.exam_prep.api.repository.OptionRepository;
import com.exam_prep.api.repository.QuestionRepository;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.repository.UserStudyAreaRepository;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import java.time.ZonedDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class StudyAreaServiceLimitsTest {

    private final StudyAreaRepository areas = mock(StudyAreaRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final StudyAreaService service = new StudyAreaService(areas, mock(QuestionRepository.class), mock(OptionRepository.class),
            mock(UserStudyAreaRepository.class), mock(ChapterRepository.class), mock(S3Service.class), users);
    private final UserEntity user = UserEntity.builder().id(UUID.randomUUID()).role("ROLE_USER").name("A").build();

    private static QuestionImportDto question() {
        return QuestionImportDto.builder().prompt("p")
                .options(List.of(new OptionImportDto("a", true), new OptionImportDto("b", false))).build();
    }

    @Test
    void creatingPastTheQuotaIsRefused() {
        ReflectionTestUtils.setField(service, "maxAreasPerUser", 2);
        when(users.lockById(user.getId())).thenReturn(Optional.of(user));
        when(areas.countByCreatedById(user.getId())).thenReturn(2L);

        AppException e = assertThrows(AppException.class, () -> service.createStudyArea(StudyAreaDto.builder().title("t").build(), user));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
        verify(areas, never()).save(any());
    }

    @Test
    void aZeroQuotaIsOff() {
        ReflectionTestUtils.setField(service, "maxAreasPerUser", 0);
        when(areas.save(any())).thenAnswer(i -> {
            StudyAreaEntity entity = i.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });
        service.createStudyArea(StudyAreaDto.builder().title("t").visibility(Visibility.PUBLIC).build(), user);
        verify(users, never()).lockById(any());
    }

    @Test
    void importsAreCapped() {
        ReflectionTestUtils.setField(service, "maxImportQuestions", 1);
        UUID id = UUID.randomUUID();
        when(areas.findById(id)).thenReturn(Optional.of(StudyAreaEntity.builder().id(id).createdBy(user).build()));

        AppException e = assertThrows(AppException.class,
                () -> service.importQuestions(id, Collections.nCopies(2, question()), user));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, e.getStatus());
    }

    @Test
    void importedTextHasTheSameLimitsAsTheEditor() {
        QuestionImportDto tooLong = question();
        tooLong.setPrompt("x".repeat(ContentLimits.RICH_TEXT + 1));
        assertThrows(AppException.class, () -> StudyAreaService.validateImportItem(tooLong));

        QuestionImportDto noText = QuestionImportDto.builder().prompt("p")
                .options(List.of(new OptionImportDto(null, true), new OptionImportDto("b", false))).build();
        assertThrows(AppException.class, () -> StudyAreaService.validateImportItem(noText));
    }

    @Test
    void aSummaryNeverShowsAnEmailInPlaceOfAName() {
        StudyAreaSummaryDto summary = new StudyAreaSummaryDto(UUID.randomUUID(), "t", null, "  ", null, UUID.randomUUID(),
                ZonedDateTime.now(), Visibility.PUBLIC, 0, 0);
        assertNull(summary.getCreatedBy());

        UserEntity noName = UserEntity.builder().id(UUID.randomUUID()).email("a@example.com").role("ROLE_USER").build();
        StudyAreaEntity entity = StudyAreaEntity.builder().id(UUID.randomUUID()).title("t").createdBy(noName)
                .visibility(Visibility.PUBLIC).build();
        assertNull(service.mapToDto(entity, null).getCreatedBy());
    }

    @Test
    void pageSizeIsCapped() {
        assertEquals(StudyAreaService.MAX_PAGE_SIZE, StudyAreaService.clampPageSize(10_000));
        assertEquals(1, StudyAreaService.clampPageSize(0));
    }

    @Test
    void imageAddressesMustBeHttpsOrOurOwn() {
        S3Service s3 = mock(S3Service.class);
        StudyAreaService withS3 = new StudyAreaService(areas, mock(QuestionRepository.class), mock(OptionRepository.class),
                mock(UserStudyAreaRepository.class), mock(ChapterRepository.class), s3, users);
        when(s3.isOwnObjectUrl("http://minio:9000/bucket/gallery/x.png")).thenReturn(true);

        assertEquals("https://e.test/a.png", ReflectionTestUtils.invokeMethod(withS3, "requireSafeImageUrl", "https://e.test/a.png"));
        assertEquals("http://minio:9000/bucket/gallery/x.png", ReflectionTestUtils.invokeMethod(withS3, "requireSafeImageUrl", "http://minio:9000/bucket/gallery/x.png"));
        assertNull(ReflectionTestUtils.invokeMethod(withS3, "requireSafeImageUrl", " "));
        for (String bad : List.of("http://e.test/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "//e.test/a.png", "https://u:p@e.test/a.png")) {
            assertThrows(AppException.class, () -> ReflectionTestUtils.invokeMethod(withS3, "requireSafeImageUrl", bad), bad);
        }
    }
}
