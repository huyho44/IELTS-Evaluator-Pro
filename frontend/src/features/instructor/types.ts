export type ReviewStatus = 'PENDING' | 'CLAIMED' | 'CONFIRMED' | 'CANCELLED';
export type ResponseMode = 'OBJECTIVE' | 'WRITING' | 'SPEAKING';
export type SkillArea = 'READING' | 'LISTENING' | 'WRITING' | 'SPEAKING';
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
export type AssignmentMode = 'PRACTICE' | 'GRADED';
export type ReleaseMode = 'IMMEDIATE' | 'AFTER_DUE_DATE' | 'SCHEDULED' | 'MANUAL';
export type RubricTaskType = 'WRITING_TASK_1' | 'WRITING_TASK_2' | 'SPEAKING';
export type ObservationOutcome = 'MET' | 'PARTIAL' | 'NOT_MET' | 'NOT_OBSERVED';
export type DecimalJson = string | number;

export type ReviewCase = {
  id: string;
  revisionId: string;
  targetRunId: string | null;
  assigneeId: string | null;
  status: ReviewStatus;
  reasonCode: string;
  priority: number;
  lockVersion: number;
  createdAt: string;
  claimedAt: string | null;
};

export type AvailableSkill = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type RubricCriterion = {
  id: string;
  code: string;
  name: string;
  definition: string;
  weight: DecimalJson;
  maxScore: DecimalJson;
};

export type ReviewRubric = {
  id: string;
  rubricCode: string;
  versionNo: number;
  taskType: string;
  publishedAt: string | null;
  rubricCriterions: RubricCriterion[];
};

export type AcceptedAssessment = {
  id: string;
  resultId: string;
  revisionId: string;
  resultKind: 'TEACHER' | 'ANSWER_KEY';
  acceptedAt: string;
  publishedAt: string | null;
  releaseAfter: string | null;
  isCurrent: boolean;
  supersedesId: string | null;
};

export type AssessmentResult = {
  id: string;
  revisionId: string;
  kind: 'AI' | 'TEACHER' | 'ANSWER_KEY';
  rubricVersionId: string | null;
  overallScore: DecimalJson | null;
  scoreScale: 'BAND' | 'RAW';
  summary: string | null;
  createdAt: string;
};

export type ReviewAssessment = AssessmentResult & {
  criterionScores: {
    id: string;
    criterionId: string;
    score: DecimalJson;
    explanation: string | null;
    criterion: { code: string; name: string };
  }[];
  findings: {
    id: string;
    criterionScoreId: string | null;
    skillId: string | null;
    findingKind: string;
    explanation: string;
    findingAnchors: {
      paragraphId: string;
      exactQuote: string;
      startOffset: number;
      endOffset: number;
    }[];
  }[];
  aiResult: {
    gradingRunId: string;
    qualityStatus: 'PASSED' | 'FLAGGED';
    validationJson?: unknown;
  } | null;
  teacherResult: { decisionId: string } | null;
  skillObservations: {
    id: string;
    skillId: string;
    outcome: ObservationOutcome;
    rationale: string;
  }[];
  acceptedAssessment: AcceptedAssessment | null;
};

export type ReviewDecision = {
  id: string;
  reviewCaseId: string;
  revisionId: string;
  teacherId: string;
  decisionNo: number;
  supersedesId: string | null;
  reason: string;
  decidedAt: string;
};

export type ReviewQueueItem = ReviewCase & {
  revision: {
    id: string;
    responseMode: ResponseMode;
    submittedAt: string;
    attempt: {
      learner: { id: string; displayName: string };
      assignmentVersion: { assignment: { title: string } };
    };
  };
};

export type ReviewDetail = ReviewCase & {
  availableSkills: AvailableSkill[];
  targetRun: {
    id: string;
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    errorCode: string | null;
    completedAt: string | null;
  } | null;
  revision: {
    id: string;
    responseMode: ResponseMode;
    writingText: string | null;
    audioAssetId: string | null;
    submittedAt: string;
    revisionParagraphs: {
      id: string;
      paragraphNo: number;
      text: string;
      startOffset: number;
      endOffset: number;
    }[];
    assessmentResults: ReviewAssessment[];
    attempt: {
      learner: { id: string; displayName: string };
      assignmentVersion: {
        id: string;
        mode: AssignmentMode;
        dueAt: string | null;
        releasePolicyJson: { releaseMode?: string; releaseAt?: string } | null;
        assignment: { id: string; title: string; courseId: string };
        activityVersion: {
          id: string;
          versionNo: number;
          promptText: string;
          instructions: string;
        };
        rubricVersion: ReviewRubric | null;
      };
    };
  };
  reviewDecisions: ReviewDecision[];
};

export type ConfirmReviewPayload = {
  lockVersion: number;
  reason: string;
  summary: string;
  criteria: { code: string; score: number; explanation: string }[];
  findings?: {
    code: string;
    skillId?: string;
    kind: 'LOCAL' | 'GLOBAL';
    explanation: string;
    anchors: { paragraphId: string; exactQuote: string }[];
  }[];
  observations?: {
    skillId: string;
    outcome: ObservationOutcome;
    rationale: string;
  }[];
};

export type ConfirmResponse = {
  decision: ReviewDecision;
  assessment: AssessmentResult;
  acceptedAssessment: AcceptedAssessment;
};

export type CriterionInput = {
  code: string;
  name: string;
  maxScore: number;
  score: string;
  explanation: string;
};

export type FindingInput = {
  id: string;
  approved: boolean;
  code: string;
  kind: 'LOCAL' | 'GLOBAL' | '';
  explanation: string;
  skillId: string;
  anchors: { paragraphId: string; exactQuote: string }[];
};

export type ObservationInput = {
  id: string;
  approved: boolean;
  skillId: string;
  outcome: ObservationOutcome;
  rationale: string;
};

export type ReviewFormState = {
  reason: string;
  summary: string;
  criteria: CriterionInput[];
  findings: FindingInput[];
  observations: ObservationInput[];
};

// ============================================================================
// Course Authoring & Grading Configuration Types
// ============================================================================

export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  status: PublicationStatus;
  enrollmentOpen: boolean;
  createdAt: string;
  completionPolicyJson: Record<string, unknown>;
  creator?: { id: string; displayName: string };
  _count?: {
    learningItems: number;
    enrollments: number;
  };
};

export type CourseSection = {
  id: string;
  courseId: string;
  title: string;
  position: number;
};

export type CourseLearningItem = {
  id: string;
  sectionId: string | null;
  title: string;
  kind: 'LESSON' | 'PRACTICE';
  position: number;
  lesson: { summary: string | null } | null;
  practiceActivity: {
    skillArea: SkillArea;
    responseMode: ResponseMode;
  } | null;
};

export type CourseDetail = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  status: PublicationStatus;
  enrollmentOpen: boolean;
  completionPolicyJson: Record<string, unknown>;
  createdAt: string;
  creator: { id: string; displayName: string };
  sections: CourseSection[];
  learningItems: CourseLearningItem[];
};

export type CreateCoursePayload = {
  title: string;
  description: string;
  completionPolicyJson: Record<string, unknown>;
};

export type UpdateCoursePayload = {
  title?: string;
  description?: string;
  enrollmentOpen?: boolean;
  status?: PublicationStatus;
};

export type CreateSectionPayload = {
  title: string;
  position: number;
};

export type CreateLessonPayload = {
  title: string;
  contentText: string;
  position: number;
  sectionId?: string | null;
  summary?: string | null;
};

export type CreateActivityPayload = {
  title: string;
  skillArea: 'WRITING' | 'SPEAKING';
  promptText: string;
  instructions: string;
  position: number;
  difficulty: number;
  expectedMinutes: number;
  skillIds: string[];
};

export type CreatedActivityVersion = {
  id: string;
  activityId: string;
  versionNo: number;
  promptText: string;
  instructions: string;
  difficulty: number;
  expectedMinutes: number;
  publishedAt: string | null;
};

export type CreatedActivityResponse = {
  id: string;
  courseId: string;
  chapterId: string | null;
  kind: 'PRACTICE';
  title: string;
  status: PublicationStatus;
  position: number;
  practiceActivity: {
    id: string;
    skillArea: 'WRITING' | 'SPEAKING';
    responseMode: 'WRITING' | 'SPEAKING';
    activityVersions: CreatedActivityVersion[];
  };
};

export type CreateRubricPayload = {
  rubricCode: string;
  versionNo: number;
  title: string;
  taskType: RubricTaskType;
  criteria: {
    code: string;
    name: string;
    definition: string;
  }[];
};

export type CreatedRubricResponse = ReviewRubric & {
  title: string;
  sourceUrl?: string | null;
};

export type CreateGradingConfigPayload = {
  rubricVersionId: string;
  modelId: string;
  promptCode: string;
  promptVersionNo: number;
  instructions: string;
  outputSchemaJson: Record<string, unknown>;
  settingsJson?: Record<string, unknown>;
};

export type CreateAssignmentPayload = {
  activityVersionId: string;
  title: string;
  mode: AssignmentMode;
  rubricVersionId?: string | null;
  maxAttempts?: number;
  maxRevisions?: number;
  opensAt?: string | null;
  dueAt?: string | null;
  timeLimitSeconds?: number | null;
  allowLate?: boolean;
  releasePolicyJson: {
    releaseMode: ReleaseMode;
    releaseAt?: string;
  };
};

export type CreatedAssignmentVersionResponse = {
  id: string;
  assignmentId: string;
  activityId: string;
  activityVersionId: string;
  rubricVersionId: string | null;
  versionNo: number;
  mode: AssignmentMode;
  opensAt: string | null;
  dueAt: string | null;
  timeLimitSeconds: number | null;
  maxAttempts: number;
  maxRevisions: number;
  allowLate: boolean;
  releasePolicyJson: Record<string, unknown>;
  publishedAt: string | null;
};