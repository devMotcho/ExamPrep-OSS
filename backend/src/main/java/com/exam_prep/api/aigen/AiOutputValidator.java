package com.exam_prep.api.aigen;

import com.exam_prep.api.aigen.AiDtos.GeneratedPayload;
import com.exam_prep.api.aigen.AiDtos.GeneratedQuestion;
import com.exam_prep.api.dto.OptionImportDto;
import com.exam_prep.api.dto.QuestionImportDto;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.service.StudyAreaService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Treats model output as untrusted: parses it and applies the existing import rules before anyone sees it. */
@Component
@RequiredArgsConstructor
public class AiOutputValidator {

    static final int MAX_PROMPT = 3000;
    static final int MAX_EXPLANATION = 6000;
    static final int MAX_OPTION = 1000;
    static final int MAX_CHAPTER = 200;

    private final ObjectMapper objectMapper;

    /** @throws InvalidOutputException when the output breaks any rule; no partial result is kept */
    public List<GeneratedQuestion> parse(String text, int pageCount) {
        GeneratedPayload payload;
        try {
            payload = objectMapper.readValue(text, GeneratedPayload.class);
        } catch (JsonProcessingException e) {
            throw new InvalidOutputException("not valid JSON");
        }
        if (payload == null || payload.questions() == null || payload.questions().size() != AiQuestionPrompt.QUESTION_COUNT) {
            throw new InvalidOutputException("wrong question count");
        }
        List<GeneratedQuestion> clean = new ArrayList<>();
        Set<String> seenPrompts = new HashSet<>();
        for (GeneratedQuestion q : payload.questions()) {
            List<OptionImportDto> options = q.options() == null ? List.of() : q.options().stream()
                    .map(o -> o == null ? new OptionImportDto(null, false) : new OptionImportDto(strip(o.getText()), o.isCorrect()))
                    .toList();
            GeneratedQuestion normalised = new GeneratedQuestion(
                    strip(q.prompt()), strip(q.explanation()),
                    blankToNull(strip(q.chapter())),
                    q.sourcePage(), options);
            checkLimits(normalised);
            if (q.sourcePage() == null || q.sourcePage() < 1 || q.sourcePage() > pageCount) {
                throw new InvalidOutputException("source page out of range");
            }
            if (normalised.explanation() == null || normalised.explanation().isBlank()) {
                throw new InvalidOutputException("missing explanation");
            }
            if (!seenPrompts.add(normalised.prompt().toLowerCase(Locale.ROOT))) {
                throw new InvalidOutputException("duplicate question");
            }
            Set<String> seenOptions = new HashSet<>();
            for (OptionImportDto option : options) {
                if (!seenOptions.add(option.getText().toLowerCase(Locale.ROOT))) {
                    throw new InvalidOutputException("duplicate option");
                }
            }
            clean.add(normalised);
        }
        return clean;
    }

    private void checkLimits(GeneratedQuestion q) {
        try {
            StudyAreaService.validateImportItem(new QuestionImportDto(q.prompt(), q.explanation(), q.chapter(), q.options()));
        } catch (AppException e) {
            throw new InvalidOutputException("import validation: " + e.getMessage());
        }
        if (exceedsLimits(q.prompt(), q.explanation(), q.chapter(), q.options())) {
            throw new InvalidOutputException("field too long");
        }
    }

    /** Length and blank-text limits shared with the approve endpoint, which receives user-edited versions. */
    static boolean exceedsLimits(String prompt, String explanation, String chapter, List<OptionImportDto> options) {
        return prompt == null || prompt.length() > MAX_PROMPT
                || (explanation != null && explanation.length() > MAX_EXPLANATION)
                || (chapter != null && chapter.length() > MAX_CHAPTER)
                || options.stream().anyMatch(o -> o.getText() == null || o.getText().isBlank() || o.getText().length() > MAX_OPTION);
    }

    private static String strip(String value) {
        return value == null ? null : value.replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", "").trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    public static class InvalidOutputException extends RuntimeException {
        InvalidOutputException(String reason) {
            super(reason, null, false, false);
        }
    }
}
