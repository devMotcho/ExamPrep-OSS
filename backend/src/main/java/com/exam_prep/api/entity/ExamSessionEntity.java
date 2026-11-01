package com.exam_prep.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.exam_prep.api.user.UserEntity;

@Entity
@Table(name = "exam_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamSessionEntity {

    public static final String KIND_EXAM = "EXAM";
    public static final String KIND_SIMULATION = "SIMULATION";
    public static final String KIND_PLAN = "PLAN";
    public static final String KIND_PRACTICE_WRONG = "PRACTICE_WRONG";
    public static final String KIND_MARKED = "MARKED";

    /** Repeating known questions with the answers on show: useful for learning, not evidence of readiness. */
    public boolean isLearningDrill() {
        return KIND_PRACTICE_WRONG.equals(sessionKind) || KIND_MARKED.equals(sessionKind);
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_area_id", nullable = false)
    private StudyAreaEntity studyArea;

    @Column(name = "started_at", nullable = false, updatable = false)
    private ZonedDateTime startedAt;

    @Column(name = "completed_at")
    private ZonedDateTime completedAt;

    @Column(nullable = false, columnDefinition = "TEXT")
    @Convert(converter = SessionSettingsConverter.class)
    private SessionSettings settings;

    @Builder.Default
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SessionAnswerEntity> answers = new ArrayList<>();

    @Column(name = "final_score")
    private BigDecimal finalScore;

    /** Source session when this is a "practice my wrong answers" session; null for regular exams. */
    @Column(name = "practice_of_session_id")
    private UUID practiceOfSessionId;

    /** See {@link ExamSessionEntity#KIND_SIMULATION} and friends. Only PRACTICE_WRONG and MARKED stay out of the score trend. */
    @Builder.Default
    @Column(name = "session_kind", nullable = false)
    private String sessionKind = KIND_EXAM;

    @PrePersist
    protected void onCreate() {
        startedAt = ZonedDateTime.now();
    }
}
