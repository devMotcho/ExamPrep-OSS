package com.exam_prep.api.study;

import com.exam_prep.api.entity.StudyAreaEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.StudyAreaRepository;
import com.exam_prep.api.service.ExamSessionService;
import com.exam_prep.api.user.UserEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Saved exam setups, per user and study area. */
@Service
@RequiredArgsConstructor
public class ExamSetupService {

    private static final int MAX_SETUPS_PER_AREA = 10;
    private static final int MAX_NAME_LENGTH = 60;

    private final JdbcTemplate jdbcTemplate;
    private final StudyAreaRepository studyAreaRepository;
    private final ExamSessionService examSessionService;
    private final ObjectMapper objectMapper;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SetupSettings(boolean showAnswerPerQuestion, boolean allowBack, double discountFactor,
                                double passingScore, int examDurationMinutes,
                                Map<UUID, Integer> chapterQuestionCounts) {}

    public record SetupRequest(String name, String preset, boolean isDefault, SetupSettings settings) {}

    public record Setup(UUID id, String name, String preset, boolean isDefault, SetupSettings settings) {}

    public List<Setup> listSetups(UUID studyAreaId, UserEntity user) {
        return jdbcTemplate.query("""
                SELECT id, name, preset, is_default, settings::text AS settings FROM user_exam_setups
                WHERE user_id = ? AND study_area_id = ?
                ORDER BY created_at
                """, (rs, n) -> new Setup(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("preset"),
                rs.getBoolean("is_default"), readSettings(rs.getString("settings"))), user.getId(), studyAreaId);
    }

    @Transactional
    public Setup createSetup(UUID studyAreaId, SetupRequest request, UserEntity user) {
        StudyAreaEntity area = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));
        examSessionService.assertAreaAccess(area, user);

        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new AppException("The setup name must have between 1 and " + MAX_NAME_LENGTH + " characters", HttpStatus.BAD_REQUEST);
        }
        if (!"TRAINING".equals(request.preset()) && !"SIMULATION".equals(request.preset())) {
            throw new AppException("Unknown setup type", HttpStatus.BAD_REQUEST);
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_exam_setups WHERE user_id = ? AND study_area_id = ?", Integer.class, user.getId(), studyAreaId);
        if (count != null && count >= MAX_SETUPS_PER_AREA) {
            throw new AppException("You can save up to " + MAX_SETUPS_PER_AREA + " setups per study area", HttpStatus.CONFLICT);
        }

        SetupSettings settings = sanitize(request.settings());
        if (request.isDefault()) {
            clearDefault(user.getId(), studyAreaId);
        }
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO user_exam_setups (id, user_id, study_area_id, name, preset, settings, is_default)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
                """, id, user.getId(), studyAreaId, name, request.preset(), writeSettings(settings), request.isDefault());
        return new Setup(id, name, request.preset(), request.isDefault(), settings);
    }

    @Transactional
    public void setDefault(UUID setupId, boolean isDefault, UserEntity user) {
        List<UUID> areas = jdbcTemplate.queryForList(
                "SELECT study_area_id FROM user_exam_setups WHERE id = ? AND user_id = ?", UUID.class, setupId, user.getId());
        if (areas.isEmpty()) {
            throw new AppException("Setup not found", HttpStatus.NOT_FOUND);
        }
        if (isDefault) {
            clearDefault(user.getId(), areas.get(0));
        }
        jdbcTemplate.update("UPDATE user_exam_setups SET is_default = ? WHERE id = ?", isDefault, setupId);
    }

    public void deleteSetup(UUID setupId, UserEntity user) {
        int deleted = jdbcTemplate.update("DELETE FROM user_exam_setups WHERE id = ? AND user_id = ?", setupId, user.getId());
        if (deleted == 0) {
            throw new AppException("Setup not found", HttpStatus.NOT_FOUND);
        }
    }

    private void clearDefault(UUID userId, UUID studyAreaId) {
        jdbcTemplate.update("UPDATE user_exam_setups SET is_default = FALSE WHERE user_id = ? AND study_area_id = ? AND is_default", userId, studyAreaId);
    }

    /** The same ranges the exam setup screen offers. Anything outside them is a client error. */
    private static SetupSettings sanitize(SetupSettings s) {
        if (s == null) {
            throw new AppException("The setup has no settings", HttpStatus.BAD_REQUEST);
        }
        boolean valid = s.discountFactor() >= 0 && s.discountFactor() <= 1
                && s.passingScore() >= 1 && s.passingScore() <= 20
                && s.examDurationMinutes() >= 0 && s.examDurationMinutes() <= 600;
        if (!valid) {
            throw new AppException("The setup has invalid values", HttpStatus.BAD_REQUEST);
        }
        Map<UUID, Integer> counts = new LinkedHashMap<>();
        if (s.chapterQuestionCounts() != null) {
            s.chapterQuestionCounts().forEach((chapter, questions) -> {
                if (chapter != null && questions != null && questions > 0) {
                    counts.put(chapter, questions);
                }
            });
        }
        return new SetupSettings(s.showAnswerPerQuestion(), s.allowBack(), s.discountFactor(), s.passingScore(),
                s.examDurationMinutes(), counts);
    }

    private String writeSettings(SetupSettings settings) {
        try {
            return objectMapper.writeValueAsString(settings);
        } catch (JsonProcessingException e) {
            throw new AppException("Could not save the setup", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private SetupSettings readSettings(String json) {
        try {
            return objectMapper.readValue(json, SetupSettings.class);
        } catch (JsonProcessingException e) {
            throw new AppException("Could not read the setup", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
