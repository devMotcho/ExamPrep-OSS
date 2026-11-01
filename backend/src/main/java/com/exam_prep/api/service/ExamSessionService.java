package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.exam_prep.api.dto.*;
import com.exam_prep.api.entity.*;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.*;
import com.exam_prep.api.user.UserEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamSessionService {

    private final ExamSessionRepository examSessionRepository;
    private final StudyAreaRepository studyAreaRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final SessionAnswerRepository sessionAnswerRepository;
    private final UserStudyAreaRepository userStudyAreaRepository;
    private final S3Service s3Service;

    @Transactional
    public ExamSessionDto startSession(UUID studyAreaId, SessionSettings settings, UserEntity user) {
        StudyAreaEntity studyArea = studyAreaRepository.findById(studyAreaId)
                .orElseThrow(() -> new AppException("Study area not found", HttpStatus.NOT_FOUND));

        assertAreaAccess(studyArea, user);

        if (studyArea.getQuestions().isEmpty()) {
            throw new AppException("This study area has no questions yet", HttpStatus.BAD_REQUEST);
        }

        // Check if there is already an active session for this study area
        Optional<ExamSessionEntity> activeSession = examSessionRepository.findFirstByUserAndStudyAreaAndCompletedAtIsNull(user, studyArea);
        if (activeSession.isPresent()) {
            throw new AppException("You already have an active exam in progress for this study area. Please finish it before starting a new one.", HttpStatus.CONFLICT);
        }

        List<QuestionEntity> studyAreaQuestions = new ArrayList<>(studyArea.getQuestions());
        List<UUID> pickedQuestionIds = new ArrayList<>();

        boolean filteredByCounts = settings != null && settings.getChapterQuestionCounts() != null && !settings.getChapterQuestionCounts().isEmpty();
        boolean filteredByChapters = settings != null && settings.getSelectedChapterIds() != null && !settings.getSelectedChapterIds().isEmpty();

        if (filteredByCounts) {
            Map<UUID, List<QuestionEntity>> questionsByChapter = studyAreaQuestions.stream()
                    .filter(q -> q.getChapter() != null)
                    .collect(Collectors.groupingBy(q -> q.getChapter().getId()));

            for (Map.Entry<UUID, Integer> entry : settings.getChapterQuestionCounts().entrySet()) {
                UUID chapterId = entry.getKey();
                int requestedCount = entry.getValue();
                if (requestedCount <= 0) continue;

                List<QuestionEntity> chapterQuestions = questionsByChapter.get(chapterId);
                if (chapterQuestions == null || chapterQuestions.isEmpty()) {
                    throw new AppException("Chapter has no questions", HttpStatus.BAD_REQUEST);
                }

                List<QuestionEntity> shuffledChapterQuestions = new ArrayList<>(chapterQuestions);
                Collections.shuffle(shuffledChapterQuestions);

                int limit = Math.min(requestedCount, shuffledChapterQuestions.size());
                for (int i = 0; i < limit; i++) {
                    pickedQuestionIds.add(shuffledChapterQuestions.get(i).getId());
                }
            }

            if (pickedQuestionIds.isEmpty()) {
                throw new AppException("No questions selected", HttpStatus.BAD_REQUEST);
            }
        } else if (filteredByChapters) {
            List<UUID> selectedIds = settings.getSelectedChapterIds();
            List<QuestionEntity> filteredQuestions = studyAreaQuestions.stream()
                    .filter(q -> q.getChapter() != null && selectedIds.contains(q.getChapter().getId()))
                    .collect(Collectors.toList());

            if (filteredQuestions.isEmpty()) {
                throw new AppException("The selected chapters have no questions", HttpStatus.BAD_REQUEST);
            }

            Collections.shuffle(filteredQuestions);
            for (QuestionEntity q : filteredQuestions) {
                pickedQuestionIds.add(q.getId());
            }
        } else {
            Collections.shuffle(studyAreaQuestions);
            for (QuestionEntity q : studyAreaQuestions) {
                pickedQuestionIds.add(q.getId());
            }
        }

        if (settings == null) {
            settings = SessionSettings.builder()
                    .showAnswerPerQuestion(false)
                    .allowBack(true)
                    .discountFactor(0.0)
                    .passingScore(10.0)
                    .examDurationMinutes(0)
                    .build();
        } else if (settings.getPassingScore() == 0.0) {
            settings.setPassingScore(10.0);
        }
        settings.setSelectedQuestionIds(pickedQuestionIds);

        // Client input alone never makes a simulation: it has to run under simulation conditions too.
        boolean simulation = ExamSessionEntity.KIND_SIMULATION.equals(settings.getPreset())
                && settings.getExamDurationMinutes() > 0
                && !settings.isShowAnswerPerQuestion();
        settings.setPreset(simulation ? ExamSessionEntity.KIND_SIMULATION : null);

        ExamSessionEntity session = ExamSessionEntity.builder()
                .studyArea(studyArea)
                .user(user)
                .settings(settings)
                .answers(new ArrayList<>())
                .sessionKind(simulation ? ExamSessionEntity.KIND_SIMULATION : ExamSessionEntity.KIND_EXAM)
                .build();

        session = examSessionRepository.save(session);
        return getSessionState(session.getId(), user);
    }

    @Transactional
    public ExamSessionDto getSessionState(UUID sessionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        // Ensure user owns this session or is admin
        boolean isOwner = session.getUser().getId().equals(user.getId());
        boolean isAdmin = "ROLE_ADMIN".equals(user.getRole());
        if (!isOwner && !isAdmin) {
            throw new AppException("Access denied to this session", HttpStatus.FORBIDDEN);
        }

        if (session.getCompletedAt() == null && session.getSettings() != null && session.getSettings().getExamDurationMinutes() > 0) {
            ZonedDateTime expiryTime = session.getStartedAt().plusMinutes(session.getSettings().getExamDurationMinutes());
            if (expiryTime.isBefore(ZonedDateTime.now())) {
                return completeSession(sessionId, user);
            }
        }

        List<QuestionEntity> questions = resolveSessionQuestions(session);
        boolean completed = session.getCompletedAt() != null;
        boolean showAnswerPerQuestion = session.getSettings().isShowAnswerPerQuestion();

        // Get answers map for fast lookup
        Map<UUID, SessionAnswerEntity> answersMap = session.getAnswers().stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a));

        List<QuestionDto> questionDtos = new ArrayList<>();
        int firstUnansweredIndex = -1;

        for (int i = 0; i < questions.size(); i++) {
            QuestionEntity q = questions.get(i);
            boolean isAnswered = answersMap.containsKey(q.getId());

            if (!isAnswered && firstUnansweredIndex == -1) {
                firstUnansweredIndex = i;
            }

            // Secure question mapping
            QuestionDto.QuestionDtoBuilder qBuilder = QuestionDto.builder()
                    .id(q.getId())
                    .prompt(q.getPrompt())
                    .imageUrl(s3Service.refreshPresignedUrlIfNeeded(q.getImageUrl()))
                    .chapterId(q.getChapter() != null ? q.getChapter().getId() : null)
                    .options(q.getOptions().stream()
                            .map(o -> OptionDto.builder()
                                    .id(o.getId())
                                    .text(o.getText())
                                    .build())
                            .collect(Collectors.toList()));

            // Expose explanation and correctOptionId ONLY IF completed OR (showAnswerPerQuestion AND answered)
            if (completed || (showAnswerPerQuestion && isAnswered)) {
                qBuilder.explanation(q.getExplanation());
                qBuilder.correctOptionId(q.getCorrectOptionId());
            }

            questionDtos.add(qBuilder.build());
        }

        // If all answered, set current index to last question or length - 1
        if (firstUnansweredIndex == -1) {
            firstUnansweredIndex = questions.size() - 1;
        }

        List<SessionAnswerDto> answerDtos = session.getAnswers().stream()
                .map(a -> {
                    SessionAnswerDto.SessionAnswerDtoBuilder aBuilder = SessionAnswerDto.builder()
                            .id(a.getId())
                            .questionId(a.getQuestion().getId())
                            .selectedOptionId(a.getSelectedOptionId())
                            .answeredAt(a.getAnsweredAt());

                    if (completed || showAnswerPerQuestion) {
                        aBuilder.correct(a.isCorrect());
                        aBuilder.correctOptionId(a.getQuestion().getCorrectOptionId());
                        aBuilder.explanation(a.getQuestion().getExplanation());
                    }

                    return aBuilder.build();
                })
                .collect(Collectors.toList());

        return ExamSessionDto.builder()
                .id(session.getId())
                .studyAreaId(session.getStudyArea().getId())
                .studyAreaTitle(session.getStudyArea().getTitle())
                .startedAt(session.getStartedAt())
                .completedAt(session.getCompletedAt())
                .settings(session.getSettings())
                .answers(answerDtos)
                .finalScore(session.getFinalScore())
                .questions(questionDtos)
                .currentIndex(firstUnansweredIndex)
                .practiceOfSessionId(session.getPracticeOfSessionId())
                .sessionKind(session.getSessionKind())
                .build();
    }

    @Transactional
    public SessionAnswerDto submitAnswer(UUID sessionId, UUID questionId, UUID optionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        if (session.getCompletedAt() != null) {
            throw new AppException("Cannot submit answer to a completed session", HttpStatus.BAD_REQUEST);
        }

        if (session.getSettings() != null && session.getSettings().getExamDurationMinutes() > 0) {
            ZonedDateTime expiryTime = session.getStartedAt().plusMinutes(session.getSettings().getExamDurationMinutes());
            if (expiryTime.isBefore(ZonedDateTime.now())) {
                throw new AppException("Exam time has expired", HttpStatus.BAD_REQUEST);
            }
        }

        // Ensure ownership
        if (!session.getUser().getId().equals(user.getId())) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }

        QuestionEntity question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException("Question not found", HttpStatus.NOT_FOUND));

        if (!question.getStudyArea().getId().equals(session.getStudyArea().getId())) {
            throw new AppException("Question does not belong to this study area", HttpStatus.BAD_REQUEST);
        }

        List<UUID> selectedQuestionIds = session.getSettings() != null ? session.getSettings().getSelectedQuestionIds() : null;
        if (selectedQuestionIds != null && !selectedQuestionIds.isEmpty()) {
            if (!selectedQuestionIds.contains(questionId)) {
                throw new AppException("Question is not part of this practice session", HttpStatus.BAD_REQUEST);
            }
        } else {
            // Fallback for older sessions
            List<UUID> selectedChapterIds = session.getSettings() != null ? session.getSettings().getSelectedChapterIds() : null;
            if (selectedChapterIds != null && !selectedChapterIds.isEmpty()) {
                if (question.getChapter() == null || !selectedChapterIds.contains(question.getChapter().getId())) {
                    throw new AppException("Question is not part of this practice session's chapters", HttpStatus.BAD_REQUEST);
                }
            }
        }

        OptionEntity option = optionRepository.findById(optionId)
                .orElseThrow(() -> new AppException("Option not found", HttpStatus.NOT_FOUND));

        if (!option.getQuestion().getId().equals(questionId)) {
            throw new AppException("Option does not belong to this question", HttpStatus.BAD_REQUEST);
        }

        // Check if answer already exists (we allow overwriting if allowBack=true, or updates)
        SessionAnswerEntity answer = sessionAnswerRepository.findBySessionIdAndQuestionId(sessionId, questionId)
                .orElse(null);

        boolean isCorrect = question.getCorrectOptionId().equals(optionId);

        if (answer == null) {
            answer = SessionAnswerEntity.builder()
                    .session(session)
                    .question(question)
                    .selectedOptionId(optionId)
                    .correct(isCorrect)
                    .build();
        } else {
            // If settings do not allow going back, block edit
            if (!session.getSettings().isAllowBack()) {
                throw new AppException("Going back is not allowed in this session", HttpStatus.BAD_REQUEST);
            }
            answer.setSelectedOptionId(optionId);
            answer.setCorrect(isCorrect);
            answer.setAnsweredAt(ZonedDateTime.now());
        }

        answer = sessionAnswerRepository.save(answer);

        SessionAnswerDto.SessionAnswerDtoBuilder responseBuilder = SessionAnswerDto.builder()
                .id(answer.getId())
                .questionId(questionId)
                .selectedOptionId(optionId)
                .answeredAt(answer.getAnsweredAt());

        // Highlight correct/wrong immediately if showAnswerPerQuestion is true
        if (session.getSettings().isShowAnswerPerQuestion()) {
            responseBuilder.correct(isCorrect);
            responseBuilder.correctOptionId(question.getCorrectOptionId());
            responseBuilder.explanation(question.getExplanation());
        }

        return responseBuilder.build();
    }

    @Transactional
    public ExamSessionDto completeSession(UUID sessionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        if (session.getCompletedAt() != null) {
            return getSessionState(sessionId, user);
        }

        if (!session.getUser().getId().equals(user.getId())) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }

        // Compute score
        List<QuestionEntity> questions = resolveSessionQuestions(session);
        int totalQuestions = questions.size();
        if (totalQuestions == 0) {
            session.setFinalScore(BigDecimal.ZERO);
            session.setCompletedAt(ZonedDateTime.now());
            examSessionRepository.save(session);
            return getSessionState(sessionId, user);
        }

        // Get answers map
        Map<UUID, SessionAnswerEntity> answersMap = session.getAnswers().stream()
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a));

        long correctAnswers = 0;
        long wrongAnswers = 0;

        for (QuestionEntity q : questions) {
            SessionAnswerEntity ans = answersMap.get(q.getId());
            if (ans != null) {
                if (ans.isCorrect()) {
                    correctAnswers++;
                } else {
                    wrongAnswers++;
                }
            }
        }

        double discountFactor = session.getSettings().getDiscountFactor();
        double rawScore;
        if (discountFactor <= 0) {
            rawScore = correctAnswers;
        } else {
            rawScore = correctAnswers - (wrongAnswers * discountFactor);
        }

        double finalScoreVal = (rawScore / totalQuestions) * 20.0;
        finalScoreVal = Math.max(0.0, Math.min(20.0, finalScoreVal));

        BigDecimal finalScore = BigDecimal.valueOf(finalScoreVal).setScale(1, RoundingMode.HALF_UP);

        session.setFinalScore(finalScore);
        session.setCompletedAt(ZonedDateTime.now());
        session = examSessionRepository.save(session);

        return getSessionState(sessionId, user);
    }

    public ExamSessionDto getSessionResult(UUID sessionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        if (session.getCompletedAt() == null) {
            throw new AppException("Session is not completed yet", HttpStatus.BAD_REQUEST);
        }

        return getSessionState(sessionId, user);
    }

    public List<ExamSessionDto> getMySessions(UserEntity user) {
        return examSessionRepository.findByUserIdOrderByStartedAtDesc(user.getId()).stream()
                .map(session -> ExamSessionDto.builder()
                        .id(session.getId())
                        .studyAreaId(session.getStudyArea().getId())
                        .studyAreaTitle(session.getStudyArea().getTitle())
                        .startedAt(session.getStartedAt())
                        .completedAt(session.getCompletedAt())
                        .settings(session.getSettings())
                        .finalScore(session.getFinalScore())
                        .practiceOfSessionId(session.getPracticeOfSessionId())
                        .sessionKind(session.getSessionKind())
                        .build())
                .collect(Collectors.toList());
    }

    /** Starts a session with only the questions the user got wrong or left blank in a completed session. */
    @Transactional
    public ExamSessionDto startWrongAnswersPractice(UUID sourceSessionId, UserEntity user) {
        ExamSessionEntity source = examSessionRepository.findById(sourceSessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        if (!source.getUser().getId().equals(user.getId())) {
            throw new AppException("Access denied to this session", HttpStatus.FORBIDDEN);
        }
        if (source.getCompletedAt() == null) {
            throw new AppException("Session is not completed yet", HttpStatus.BAD_REQUEST);
        }

        StudyAreaEntity studyArea = source.getStudyArea();
        assertAreaAccess(studyArea, user);

        if (examSessionRepository.findFirstByUserAndStudyAreaAndCompletedAtIsNull(user, studyArea).isPresent()) {
            throw new AppException("You already have an active exam in progress for this study area. Please finish it before starting a new one.", HttpStatus.CONFLICT);
        }

        Set<UUID> correctIds = source.getAnswers().stream()
                .filter(SessionAnswerEntity::isCorrect)
                .map(a -> a.getQuestion().getId())
                .collect(Collectors.toSet());

        List<UUID> questionIds = resolveSessionQuestions(source).stream()
                .map(QuestionEntity::getId)
                .filter(id -> !correctIds.contains(id))
                .collect(Collectors.toCollection(ArrayList::new));

        if (questionIds.isEmpty()) {
            throw new AppException("This session has no wrong or unanswered questions to practice", HttpStatus.BAD_REQUEST);
        }

        Collections.shuffle(questionIds);

        ExamSessionEntity session = examSessionRepository.save(ExamSessionEntity.builder()
                .studyArea(studyArea)
                .user(user)
                .settings(learningSettings(questionIds))
                .answers(new ArrayList<>())
                .practiceOfSessionId(source.getId())
                .sessionKind(ExamSessionEntity.KIND_PRACTICE_WRONG)
                .build());

        return getSessionState(session.getId(), user);
    }

    /** Starts a learning session on questions the server has already chosen: the study plan and "practise marked". */
    @Transactional
    public ExamSessionDto startChosenQuestions(StudyAreaEntity studyArea, List<UUID> questionIds, String kind, UserEntity user) {
        assertAreaAccess(studyArea, user);
        if (questionIds.isEmpty()) {
            throw new AppException("No questions to practise", HttpStatus.BAD_REQUEST);
        }
        if (examSessionRepository.findFirstByUserAndStudyAreaAndCompletedAtIsNull(user, studyArea).isPresent()) {
            throw new AppException("You already have an active exam in progress for this study area. Please finish it before starting a new one.", HttpStatus.CONFLICT);
        }

        List<UUID> shuffled = new ArrayList<>(questionIds);
        Collections.shuffle(shuffled);

        ExamSessionEntity session = examSessionRepository.save(ExamSessionEntity.builder()
                .studyArea(studyArea)
                .user(user)
                .settings(learningSettings(shuffled))
                .answers(new ArrayList<>())
                .sessionKind(kind)
                .build());
        return getSessionState(session.getId(), user);
    }

    /** For learning, whatever the source session did: answers and explanations at once, free to go back, nothing at stake. */
    private static SessionSettings learningSettings(List<UUID> questionIds) {
        return SessionSettings.builder()
                .showAnswerPerQuestion(true)
                .allowBack(true)
                .discountFactor(0.0)
                .passingScore(10.0)
                .examDurationMinutes(0)
                .selectedQuestionIds(questionIds)
                .build();
    }

    /** Compares a completed session with the user's previous full attempt in the same study area. */
    @Transactional(readOnly = true)
    public RetentionDtos.SessionComparison getSessionComparison(UUID sessionId, UserEntity user) {
        ExamSessionEntity session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("Session not found", HttpStatus.NOT_FOUND));

        if (!session.getUser().getId().equals(user.getId())) {
            throw new AppException("Access denied to this session", HttpStatus.FORBIDDEN);
        }
        if (session.getCompletedAt() == null) {
            throw new AppException("Session is not completed yet", HttpStatus.BAD_REQUEST);
        }

        boolean practice = session.isLearningDrill();
        ExamSessionEntity previous = practice ? null : examSessionRepository
                .findFirstByUserIdAndStudyAreaIdAndSessionKindNotInAndCompletedAtBeforeOrderByCompletedAtDesc(
                        user.getId(), session.getStudyArea().getId(),
                        List.of(ExamSessionEntity.KIND_PRACTICE_WRONG, ExamSessionEntity.KIND_MARKED), session.getCompletedAt())
                .filter(p -> p.getFinalScore() != null)
                .orElse(null);

        BigDecimal delta = previous != null && session.getFinalScore() != null
                ? session.getFinalScore().subtract(previous.getFinalScore())
                : null;

        Set<UUID> correctIds = session.getAnswers().stream()
                .filter(SessionAnswerEntity::isCorrect)
                .map(a -> a.getQuestion().getId())
                .collect(Collectors.toSet());

        // Chapter with the most missed questions in this session: what to review next.
        Map<ChapterEntity, int[]> perChapter = new HashMap<>();
        for (QuestionEntity q : resolveSessionQuestions(session)) {
            if (q.getChapter() == null) continue;
            int[] counts = perChapter.computeIfAbsent(q.getChapter(), c -> new int[2]);
            counts[1]++;
            if (!correctIds.contains(q.getId())) counts[0]++;
        }
        Map.Entry<ChapterEntity, int[]> weakest = perChapter.entrySet().stream()
                .filter(e -> e.getValue()[0] > 0)
                .max(Comparator.comparingInt(e -> e.getValue()[0]))
                .orElse(null);

        return new RetentionDtos.SessionComparison(
                practice,
                previous != null ? previous.getId() : null,
                previous != null ? previous.getFinalScore() : null,
                previous != null ? previous.getCompletedAt() : null,
                delta,
                examSessionRepository.countByUserIdAndCompletedAtIsNotNull(user.getId()),
                weakest != null ? weakest.getKey().getTitle() : null,
                weakest != null ? weakest.getValue()[0] : 0,
                weakest != null ? weakest.getValue()[1] : 0);
    }

    /** Must be public, or the user must have joined or created the area. */
    public void assertAreaAccess(StudyAreaEntity studyArea, UserEntity user) {
        if (studyArea.getVisibility() == Visibility.PRIVATE) {
            boolean isCreator = studyArea.getCreatedBy().getId().equals(user.getId());
            boolean isJoined = userStudyAreaRepository.existsByUserIdAndStudyAreaId(user.getId(), studyArea.getId());
            boolean isAdmin = "ROLE_ADMIN".equals(user.getRole());
            if (!isCreator && !isJoined && !isAdmin) {
                throw new AppException("Access denied to private study area", HttpStatus.FORBIDDEN);
            }
        }
    }

    public List<QuestionEntity> resolveSessionQuestions(ExamSessionEntity session) {
        List<QuestionEntity> questions = session.getStudyArea().getQuestions();
        List<UUID> selectedQuestionIds = session.getSettings() != null ? session.getSettings().getSelectedQuestionIds() : null;
        if (selectedQuestionIds != null && !selectedQuestionIds.isEmpty()) {
            Map<UUID, QuestionEntity> questionsMap = questions.stream()
                    .collect(Collectors.toMap(QuestionEntity::getId, q -> q));
            return selectedQuestionIds.stream()
                    .map(questionsMap::get)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        }
        // Fallback for older sessions
        List<UUID> selectedChapterIds = session.getSettings() != null ? session.getSettings().getSelectedChapterIds() : null;
        if (selectedChapterIds != null && !selectedChapterIds.isEmpty()) {
            return questions.stream()
                    .filter(q -> q.getChapter() != null && selectedChapterIds.contains(q.getChapter().getId()))
                    .collect(Collectors.toList());
        }
        return questions;
    }
}
