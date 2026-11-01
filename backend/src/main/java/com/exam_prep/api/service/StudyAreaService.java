package com.exam_prep.api.service;

import com.exam_prep.api.dto.*;
import com.exam_prep.api.entity.*;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.*;
import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudyAreaService {

    private final StudyAreaRepository studyAreaRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final UserStudyAreaRepository userStudyAreaRepository;
    private final ChapterRepository chapterRepository;
    private final S3Service s3Service;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    static final int MAX_PAGE_SIZE = 100;
    /** Stands in for "no user" in queries: the id of nobody. */
    private static final UUID NO_USER = new UUID(0, 0);

    /** Study areas one user can own. 0 turns the limit off; administrators have none. */
    @Value("${app.study-areas.max-per-user:100}")
    private int maxAreasPerUser = 100;

    /** Questions accepted from one import file. */
    @Value("${app.study-areas.max-import-questions:500}")
    private int maxImportQuestions = 500;

    @Transactional
    public StudyAreaDto createStudyArea(StudyAreaDto dto, UserEntity user) {
        enforceAreaQuota(user);
        StudyAreaEntity studyArea = StudyAreaEntity.builder()
                .title(RichTextSanitizer.plainText(dto.getTitle()))
                .description(RichTextSanitizer.plainText(dto.getDescription()))
                .visibility(dto.getVisibility() != null ? dto.getVisibility() : Visibility.PUBLIC)
                .createdBy(user)
                .build();
        studyArea = studyAreaRepository.save(studyArea);

        // Auto join creator
        UserStudyAreaEntity join = UserStudyAreaEntity.builder()
                .userId(user.getId())
                .studyAreaId(studyArea.getId())
                .joinedAt(ZonedDateTime.now())
                .build();
        userStudyAreaRepository.save(join);

        return mapToDto(studyArea, user);
    }

    private void enforceAreaQuota(UserEntity user) {
        boolean staff = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (maxAreasPerUser <= 0 || staff) {
            return;
        }
        // Held until the transaction ends, so simultaneous requests cannot pass the limit together.
        userRepository.lockById(user.getId());
        if (studyAreaRepository.countByCreatedById(user.getId()) >= maxAreasPerUser) {
            throw new AppException("You have reached the limit of " + maxAreasPerUser + " study areas.", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    /** Public areas plus the user's own, most popular first. {@code page} starts at 0. */
    @Transactional(readOnly = true)
    public PageResponse<StudyAreaSummaryDto> listVisible(UserEntity user, int page, int size, String search) {
        Page<StudyAreaSummaryDto> result = studyAreaRepository.findVisibleSummaries(
                user == null ? NO_USER : user.getId(), toLikePattern(search),
                PageRequest.of(Math.max(page, 0), clampPageSize(size)));
        markStarred(result.getContent(), user);
        return PageResponse.of(result);
    }

    @Transactional(readOnly = true)
    public List<StudyAreaSummaryDto> listUserJoinedOrCreated(UserEntity user) {
        List<StudyAreaSummaryDto> result = studyAreaRepository.findJoinedOrCreatedSummaries(user.getId());
        markStarred(result, user);
        return result;
    }

    static int clampPageSize(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }

    private static String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return "";
        }
        String trimmed = search.trim();
        String limited = trimmed.length() > ContentLimits.TITLE ? trimmed.substring(0, ContentLimits.TITLE) : trimmed;
        return "%" + limited.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private void markStarred(List<StudyAreaSummaryDto> summaries, UserEntity user) {
        if (user == null || summaries.isEmpty()) {
            return;
        }
        Set<UUID> starred = userStudyAreaRepository.findStudyAreaIdsByUserId(user.getId());
        summaries.forEach(summary -> summary.setStarred(starred.contains(summary.getId())));
    }

    public StudyAreaDto getStudyAreaDetail(UUID id, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(id)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        if (studyArea.getVisibility() == Visibility.PRIVATE) {
            if (user == null) {
                throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
            }
            boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
            boolean isJoined = userStudyAreaRepository.existsByUserIdAndStudyAreaId(user.getId(), studyArea.getId());
            boolean isAdmin = "ROLE_ADMIN".equals(user.getRole());
            if (!isCreator && !isJoined && !isAdmin) {
                throw new AppException("Access denied to private study area", HttpStatus.FORBIDDEN);
            }
        }

        return mapToDto(studyArea, user);
    }

    @Transactional
    public void joinStudyArea(UUID id, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(id)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        if (studyArea.getVisibility() == Visibility.PRIVATE) {
            boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
            boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
            if (!isCreator && !isAdmin) {
                throw new AppException("Cannot star a private study area", HttpStatus.FORBIDDEN);
            }
        }

        boolean alreadyJoined = userStudyAreaRepository.existsByUserIdAndStudyAreaId(user.getId(), studyArea.getId());
        if (alreadyJoined) {
            return;
        }

        UserStudyAreaEntity join = UserStudyAreaEntity.builder()
                .userId(user.getId())
                .studyAreaId(studyArea.getId())
                .joinedAt(ZonedDateTime.now())
                .build();
        userStudyAreaRepository.save(join);
    }

    @Transactional
    public void unstarStudyArea(UUID id, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(id)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        userStudyAreaRepository.deleteByUserIdAndStudyAreaId(user.getId(), studyArea.getId());
    }

    @Transactional
    public QuestionDto addQuestion(UUID studyAreaId, QuestionDto questionDto, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        // Permission check: creator or admin
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can add questions", HttpStatus.FORBIDDEN);
        }

        validateQuestionDto(questionDto);

        ChapterEntity chapter = null;
        if (questionDto.getChapterId() != null) {
            chapter = chapterRepository.findById(questionDto.getChapterId())
                    .orElseThrow(() -> new AppException("Chapter not found", HttpStatus.NOT_FOUND));
            if (!chapter.getStudyArea().getId().equals(studyArea.getId())) {
                throw new AppException("Chapter does not belong to this study area", HttpStatus.BAD_REQUEST);
            }
        }

        QuestionEntity question = QuestionEntity.builder()
                .studyArea(studyArea)
                .prompt(RichTextSanitizer.richText(questionDto.getPrompt()))
                .imageUrl(questionDto.getImageUrl())
                .explanation(RichTextSanitizer.richText(questionDto.getExplanation()))
                .chapter(chapter)
                .createdBy(user)
                .options(new ArrayList<>())
                .build();

        question = questionRepository.save(question);

        // Add options
        UUID correctOptionId = null;
        for (OptionDto optDto : questionDto.getOptions()) {
            OptionEntity opt = OptionEntity.builder()
                    .question(question)
                    .text(RichTextSanitizer.plainText(optDto.getText()))
                    .build();
            opt = optionRepository.save(opt);
            question.getOptions().add(opt);
        }

        // Let's determine correct option:
        int correctIndex = -1;
        for (int i = 0; i < questionDto.getOptions().size(); i++) {
            OptionDto optDto = questionDto.getOptions().get(i);
            boolean isCorrect = false;
            if (questionDto.getCorrectOptionId() != null && questionDto.getCorrectOptionId().equals(optDto.getId())) {
                isCorrect = true;
            } else if (Boolean.TRUE.equals(optDto.getCorrect())) {
                isCorrect = true;
            }
            if (isCorrect) {
                correctIndex = i;
            }
        }

        if (correctIndex == -1) {
            throw new AppException("Exactly one correct option is required", HttpStatus.BAD_REQUEST);
        }

        correctOptionId = question.getOptions().get(correctIndex).getId();
        question.setCorrectOptionId(correctOptionId);
        question = questionRepository.save(question);

        return mapQuestionToDto(question);
    }

    @Transactional
    public QuestionDto editQuestion(UUID id, QuestionDto questionDto, UserEntity user) {
        QuestionEntity question = questionRepository.findById(id)
                .orElseThrow(() -> new AppException("Question not found", HttpStatus.NOT_FOUND));

        // Permission check: creator of study area or admin
        StudyAreaEntity studyArea = question.getStudyArea();
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can edit questions", HttpStatus.FORBIDDEN);
        }
        validateQuestionDto(questionDto);

        ChapterEntity chapter = null;
        if (questionDto.getChapterId() != null) {
            chapter = chapterRepository.findById(questionDto.getChapterId())
                    .orElseThrow(() -> new AppException("Chapter not found", HttpStatus.NOT_FOUND));
            if (!chapter.getStudyArea().getId().equals(studyArea.getId())) {
                throw new AppException("Chapter does not belong to this study area", HttpStatus.BAD_REQUEST);
            }
        }

        question.setPrompt(RichTextSanitizer.richText(questionDto.getPrompt()));
        question.setImageUrl(questionDto.getImageUrl());
        question.setExplanation(RichTextSanitizer.richText(questionDto.getExplanation()));
        question.setChapter(chapter);

        // Remove old options from repository
        optionRepository.deleteAll(question.getOptions());
        question.getOptions().clear();
        question = questionRepository.saveAndFlush(question);

        // Add new options
        int correctIndex = -1;
        for (int i = 0; i < questionDto.getOptions().size(); i++) {
            OptionDto optDto = questionDto.getOptions().get(i);
            OptionEntity opt = OptionEntity.builder()
                    .question(question)
                    .text(RichTextSanitizer.plainText(optDto.getText()))
                    .build();
            opt = optionRepository.save(opt);
            question.getOptions().add(opt);

            boolean isCorrect = false;
            if (questionDto.getCorrectOptionId() != null && questionDto.getCorrectOptionId().equals(optDto.getId())) {
                isCorrect = true;
            } else if (Boolean.TRUE.equals(optDto.getCorrect())) {
                isCorrect = true;
            }
            if (isCorrect) {
                correctIndex = i;
            }
        }

        if (correctIndex == -1) {
            throw new AppException("Exactly one correct option is required", HttpStatus.BAD_REQUEST);
        }

        UUID correctOptionId = question.getOptions().get(correctIndex).getId();
        question.setCorrectOptionId(correctOptionId);
        question = questionRepository.save(question);

        return mapQuestionToDto(question);
    }

    /** Stored and displayed S3 URLs differ only in their signature, so the query string is ignored. */
    @Transactional
    public void deleteQuestion(UUID id, UserEntity user) {
        QuestionEntity question = questionRepository.findById(id)
                .orElseThrow(() -> new AppException("Question not found", HttpStatus.NOT_FOUND));

        StudyAreaEntity studyArea = question.getStudyArea();
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can delete questions", HttpStatus.FORBIDDEN);
        }

        questionRepository.delete(question);
    }

    @Transactional
    public void deleteStudyArea(UUID id, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(id)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        // Only admin or dev can force-delete any study area from backoffice
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        if (!isAdmin && !isCreator) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }

        studyAreaRepository.delete(studyArea);
    }

    @Transactional
    public StudyAreaDto updateStudyArea(UUID id, StudyAreaDto dto, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(id)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can edit its details", HttpStatus.FORBIDDEN);
        }

        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new AppException("Title is required", HttpStatus.BAD_REQUEST);
        }

        studyArea.setTitle(RichTextSanitizer.plainText(dto.getTitle().trim()));
        studyArea.setDescription(dto.getDescription() != null ? RichTextSanitizer.plainText(dto.getDescription().trim()) : null);
        if (dto.getVisibility() != null) {
            studyArea.setVisibility(dto.getVisibility());
        }

        studyArea = studyAreaRepository.save(studyArea);
        return mapToDto(studyArea, user);
    }

    @Transactional(readOnly = true)
    public List<StudyAreaSummaryDto> listAllForAdmin(UserEntity user) {
        if (!"ROLE_ADMIN".equals(user.getRole()) && !"ROLE_DEV".equals(user.getRole())) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }
        List<StudyAreaSummaryDto> result = studyAreaRepository.findAllSummaries();
        markStarred(result, user);
        return result;
    }

    @Transactional
    public List<QuestionDto> bulkImport(UUID studyAreaId, MultipartFile file, UserEntity user) {
        requireImportAccess(studyAreaId, user);
        try {
            List<QuestionImportDto> imports = objectMapper.readValue(
                    file.getInputStream(),
                    new TypeReference<List<QuestionImportDto>>() {}
            );
            return importQuestions(studyAreaId, imports, user);
        } catch (IOException e) {
            throw new AppException("Failed to read JSON file", HttpStatus.BAD_REQUEST);
        }
    }

    private StudyAreaEntity requireImportAccess(UUID studyAreaId, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator can import questions", HttpStatus.FORBIDDEN);
        }
        return studyArea;
    }

    /** The shared import rules for one question: prompt, 2-6 options and exactly one correct. */
    public static void validateImportItem(QuestionImportDto item) {
        if (item.getPrompt() == null || item.getPrompt().isBlank()) {
            throw new AppException("Prompt is required", HttpStatus.BAD_REQUEST);
        }
        if (item.getOptions() == null || item.getOptions().size() < 2 || item.getOptions().size() > 6) {
            throw new AppException("Each question must have between 2 and 6 options", HttpStatus.BAD_REQUEST);
        }
        boolean tooLong = item.getPrompt().length() > ContentLimits.RICH_TEXT
                || (item.getExplanation() != null && item.getExplanation().length() > ContentLimits.RICH_TEXT)
                || (item.getChapter() != null && item.getChapter().length() > ContentLimits.TITLE);
        boolean badOption = item.getOptions().stream()
                .anyMatch(o -> o == null || o.getText() == null || o.getText().isBlank() || o.getText().length() > ContentLimits.OPTION);
        if (tooLong || badOption) {
            throw new AppException("A question has an empty or too long field", HttpStatus.BAD_REQUEST);
        }
        long correctCount = item.getOptions().stream().filter(OptionImportDto::isCorrect).count();
        if (correctCount != 1) {
            throw new AppException("Each question must have exactly one correct option", HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional
    public List<QuestionDto> importQuestions(UUID studyAreaId, List<QuestionImportDto> imports, UserEntity user) {
        StudyAreaEntity studyArea = requireImportAccess(studyAreaId, user);
        if (imports.size() > maxImportQuestions) {
            throw new AppException("A file can import at most " + maxImportQuestions + " questions.", HttpStatus.PAYLOAD_TOO_LARGE);
        }

            java.util.Map<String, ChapterEntity> chapterCache = new java.util.HashMap<>();
            chapterRepository.findByStudyAreaIdOrderByCreatedAtAsc(studyAreaId)
                    .forEach(c -> chapterCache.put(c.getTitle().toLowerCase(), c));

            List<QuestionDto> importedQuestions = new ArrayList<>();
            for (QuestionImportDto item : imports) {
                validateImportItem(item);

                UUID resolvedChapterId = null;
                if (item.getChapter() != null && !item.getChapter().trim().isEmpty()) {
                    String chapterTitle = item.getChapter().trim();
                    String cacheKey = chapterTitle.toLowerCase();
                    ChapterEntity chapter = chapterCache.get(cacheKey);
                    if (chapter == null) {
                        chapter = ChapterEntity.builder()
                                .studyArea(studyArea)
                                .title(RichTextSanitizer.plainText(chapterTitle))
                                .build();
                        chapter = chapterRepository.saveAndFlush(chapter);
                        chapterCache.put(cacheKey, chapter);
                    }
                    resolvedChapterId = chapter.getId();
                }

                // Map to QuestionDto
                List<OptionDto> options = item.getOptions().stream()
                        .map(o -> OptionDto.builder()
                                .text(o.getText())
                                .correct(o.isCorrect())
                                .build())
                        .collect(Collectors.toList());

                QuestionDto qDto = QuestionDto.builder()
                        .prompt(item.getPrompt())
                        .explanation(item.getExplanation())
                        .chapterId(resolvedChapterId)
                        .options(options)
                        .build();

                importedQuestions.add(addQuestion(studyAreaId, qDto, user));
            }
            return importedQuestions;
    }

    private void validateQuestionDto(QuestionDto dto) {
        if (dto.getPrompt() == null || dto.getPrompt().isBlank()) {
            throw new AppException("Prompt is required", HttpStatus.BAD_REQUEST);
        }
        if (dto.getOptions() == null || dto.getOptions().size() < 2 || dto.getOptions().size() > 6) {
            throw new AppException("Questions must have between 2 and 6 options", HttpStatus.BAD_REQUEST);
        }
    }

    public StudyAreaDto mapToDto(StudyAreaEntity entity, UserEntity user) {
        boolean starred = false;
        if (user != null) {
            starred = userStudyAreaRepository.existsByUserIdAndStudyAreaId(user.getId(), entity.getId());
        }
        long starCount = userStudyAreaRepository.countByStudyAreaId(entity.getId());

        boolean isCreatorOrAdmin = false;
        if (user != null) {
            isCreatorOrAdmin = entity.getCreatedBy().getId().equals(user.getId())
                    || "ROLE_ADMIN".equals(user.getRole())
                    || "ROLE_DEV".equals(user.getRole());
        }

        final boolean revealAnswers = isCreatorOrAdmin;
        List<QuestionDto> qDtos = entity.getQuestions().stream()
                .map(q -> {
                    List<OptionDto> options = q.getOptions().stream()
                            .map(o -> OptionDto.builder()
                                    .id(o.getId())
                                    .text(o.getText())
                                    .build())
                            .collect(Collectors.toList());

                    QuestionDto.QuestionDtoBuilder builder = QuestionDto.builder()
                            .id(q.getId())
                            .prompt(q.getPrompt())
                            .imageUrl(s3Service.refreshPresignedUrlIfNeeded(q.getImageUrl()))
                            .chapterId(q.getChapter() != null ? q.getChapter().getId() : null)
                            .orderIndex(q.getOrderIndex() != null ? q.getOrderIndex() : 0)
                            .options(options);

                    if (revealAnswers) {
                        builder.correctOptionId(q.getCorrectOptionId())
                               .explanation(q.getExplanation());
                    }

                    return builder.build();
                })
                .collect(Collectors.toList());

        List<ChapterDto> cDtos = entity.getChapters().stream()
                .map(c -> ChapterDto.builder()
                        .id(c.getId())
                        .title(c.getTitle())
                        .studyAreaId(entity.getId())
                        .orderIndex(c.getOrderIndex() != null ? c.getOrderIndex() : 0)
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return StudyAreaDto.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .createdBy(entity.getCreatedBy().getName() == null || entity.getCreatedBy().getName().isBlank() ? null : entity.getCreatedBy().getName())
                .createdById(entity.getCreatedBy().getId())
                .createdAt(entity.getCreatedAt())
                .visibility(entity.getVisibility())
                .questionCount(entity.getQuestions().size())
                .starred(starred)
                .starCount(starCount)
                .questions(qDtos)
                .chapters(cDtos)
                .build();
    }

    public QuestionDto mapQuestionToDto(QuestionEntity entity) {
        List<OptionDto> options = entity.getOptions().stream()
                .map(o -> OptionDto.builder()
                        .id(o.getId())
                        .text(o.getText())
                        .build())
                .collect(Collectors.toList());

        return QuestionDto.builder()
                .id(entity.getId())
                .prompt(entity.getPrompt())
                .imageUrl(s3Service.refreshPresignedUrlIfNeeded(entity.getImageUrl()))
                .explanation(entity.getExplanation())
                .correctOptionId(entity.getCorrectOptionId())
                .chapterId(entity.getChapter() != null ? entity.getChapter().getId() : null)
                .orderIndex(entity.getOrderIndex() != null ? entity.getOrderIndex() : 0)
                .options(options)
                .build();
    }

    @Transactional
    public ChapterDto createChapter(UUID studyAreaId, ChapterDto chapterDto, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can add chapters", HttpStatus.FORBIDDEN);
        }
        if (chapterDto.getTitle() == null || chapterDto.getTitle().isBlank()) {
            throw new AppException("Chapter title is required", HttpStatus.BAD_REQUEST);
        }

        ChapterEntity chapter = ChapterEntity.builder()
                .studyArea(studyArea)
                .title(RichTextSanitizer.plainText(chapterDto.getTitle().trim()))
                .build();

        chapter = chapterRepository.save(chapter);
        return ChapterDto.builder()
                .id(chapter.getId())
                .title(chapter.getTitle())
                .studyAreaId(studyArea.getId())
                .createdAt(chapter.getCreatedAt())
                .build();
    }

    @Transactional
    public ChapterDto editChapter(UUID chapterId, ChapterDto chapterDto, UserEntity user) {
        ChapterEntity chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new AppException("Chapter not found", HttpStatus.NOT_FOUND));

        StudyAreaEntity studyArea = chapter.getStudyArea();
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can edit chapters", HttpStatus.FORBIDDEN);
        }
        if (chapterDto.getTitle() == null || chapterDto.getTitle().isBlank()) {
            throw new AppException("Chapter title is required", HttpStatus.BAD_REQUEST);
        }

        chapter.setTitle(RichTextSanitizer.plainText(chapterDto.getTitle().trim()));
        chapter = chapterRepository.save(chapter);

        return ChapterDto.builder()
                .id(chapter.getId())
                .title(chapter.getTitle())
                .studyAreaId(studyArea.getId())
                .createdAt(chapter.getCreatedAt())
                .build();
    }

    @Transactional
    public void reorderChapters(UUID studyAreaId, List<UUID> chapterIds, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator can reorder chapters", HttpStatus.FORBIDDEN);
        }

        List<ChapterEntity> chapters = chapterRepository.findByStudyAreaIdOrderByCreatedAtAsc(studyAreaId);
        java.util.Map<UUID, ChapterEntity> chapterMap = chapters.stream().collect(Collectors.toMap(ChapterEntity::getId, c -> c));

        int orderIndex = 0;
        for (UUID chapterId : chapterIds) {
            ChapterEntity chapter = chapterMap.get(chapterId);
            if (chapter != null) {
                chapter.setOrderIndex(orderIndex++);
                chapterRepository.save(chapter);
            }
        }
    }

    @Transactional
    public void reorderQuestions(UUID studyAreaId, List<com.exam_prep.api.dto.QuestionOrderDto> request, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator can reorder questions", HttpStatus.FORBIDDEN);
        }

        List<QuestionEntity> questions = studyArea.getQuestions();
        java.util.Map<UUID, QuestionEntity> questionMap = questions.stream().collect(Collectors.toMap(QuestionEntity::getId, q -> q));

        java.util.Map<UUID, ChapterEntity> chapterCache = new java.util.HashMap<>();

        for (com.exam_prep.api.dto.QuestionOrderDto dto : request) {
            QuestionEntity question = questionMap.get(dto.getId());
            if (question != null) {
                question.setOrderIndex(dto.getOrderIndex());
                if (dto.getChapterId() != null) {
                    ChapterEntity chapter = chapterCache.computeIfAbsent(dto.getChapterId(), id -> 
                            chapterRepository.findById(id).orElse(null));
                    if (chapter != null && chapter.getStudyArea().getId().equals(studyAreaId)) {
                        question.setChapter(chapter);
                    } else {
                        question.setChapter(null);
                    }
                } else {
                    question.setChapter(null);
                }
                questionRepository.save(question);
            }
        }
    }

    @Transactional
    public void deleteChapter(UUID chapterId, UserEntity user) {
        ChapterEntity chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new AppException("Chapter not found", HttpStatus.NOT_FOUND));

        StudyAreaEntity studyArea = chapter.getStudyArea();
        boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole()) || "ROLE_DEV".equals(user.getRole());
        if (!isCreator && !isAdmin) {
            throw new AppException("Only the creator of the study area can delete chapters", HttpStatus.FORBIDDEN);
        }

        // Questions stay, without a chapter.
        chapterRepository.delete(chapter);
    }

    @Transactional(readOnly = true)
    public List<ChapterDto> listChapters(UUID studyAreaId) {
        return chapterRepository.findByStudyAreaIdOrderByCreatedAtAsc(studyAreaId).stream()
                .map(c -> ChapterDto.builder()
                        .id(c.getId())
                        .title(c.getTitle())
                        .studyAreaId(studyAreaId)
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
