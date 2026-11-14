import { useCallback, useEffect, useMemo, useState } from 'react';
import { instructorApi } from '../services/instructorApi';
import type {
  AssignmentMode,
  AvailableSkill,
  CourseDetail,
  CourseSummary,
  PublicationStatus,
  ReleaseMode,
  RubricTaskType,
} from '../types';

type AuthoringTab = 'curriculum' | 'activities' | 'assignments' | 'rubrics';

type SavedActivityRef = {
  courseId: string;
  itemId: string;
  title: string;
  skillArea: 'WRITING' | 'SPEAKING';
  activityVersionId: string;
  versionNo: number;
};

type SavedRubricRef = {
  id: string;
  rubricCode: string;
  versionNo: number;
  title: string;
  taskType: RubricTaskType;
};

type SavedAssignmentRef = {
  courseId: string;
  assignmentId: string;
  versionId: string;
  versionNo: number;
  title: string;
  mode: AssignmentMode;
  activityVersionId: string;
  rubricVersionId: string | null;
};

const STORAGE_KEYS = {
  draftCourses: 'ielts_instructor_draft_courses_v1',
  activities: 'ielts_instructor_activities_v1',
  rubrics: 'ielts_instructor_rubrics_v1',
  assignments: 'ielts_instructor_assignments_v1',
};

const DEFAULT_CRITERIA_BY_TASK: Record<
  RubricTaskType,
  { code: string; name: string; definition: string }[]
> = {
  WRITING_TASK_1: [
    {
      code: 'TA',
      name: 'Task Achievement',
      definition:
        'Addresses all requirements of the task, presents a clear overview, and highlights key features accurately.',
    },
    {
      code: 'CC',
      name: 'Coherence and Cohesion',
      definition:
        'Organizes information logically with clear progression and appropriate use of cohesive devices and paragraphing.',
    },
    {
      code: 'LR',
      name: 'Lexical Resource',
      definition:
        'Uses a sufficient range of vocabulary flexibly and accurately with appropriate collocation and spelling.',
    },
    {
      code: 'GRA',
      name: 'Grammatical Range and Accuracy',
      definition:
        'Uses a variety of complex structures with frequent error-free sentences and accurate punctuation.',
    },
  ],
  WRITING_TASK_2: [
    {
      code: 'TR',
      name: 'Task Response',
      definition:
        'Addresses all parts of the prompt, presents a clear position throughout, and develops well-supported arguments.',
    },
    {
      code: 'CC',
      name: 'Coherence and Cohesion',
      definition:
        'Sequences ideas logically with clear central topics in each paragraph and natural cohesive linking.',
    },
    {
      code: 'LR',
      name: 'Lexical Resource',
      definition:
        'Uses a wide range of academic vocabulary naturally and precisely with minimal word-choice errors.',
    },
    {
      code: 'GRA',
      name: 'Grammatical Range and Accuracy',
      definition:
        'Uses a wide range of grammatical structures accurately and controls punctuation consistently.',
    },
  ],
  SPEAKING: [
    {
      code: 'FC',
      name: 'Fluency and Coherence',
      definition:
        'Speaks at length without noticeable effort or loss of coherence, using discourse markers naturally.',
    },
    {
      code: 'LR',
      name: 'Lexical Resource',
      definition:
        'Uses vocabulary flexibly to discuss a variety of topics, including idiomatic language and paraphrase.',
    },
    {
      code: 'GRA',
      name: 'Grammatical Range and Accuracy',
      definition:
        'Produces a mix of simple and complex structures with flexibility and high grammatical accuracy.',
    },
    {
      code: 'PR',
      name: 'Pronunciation',
      definition:
        'Uses a full range of pronunciation features with precision and is effortless to understand throughout.',
    },
  ],
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (e?.message) return e.message;
  return fallback;
}

export default function CourseAuthoringPage() {
  // Course lists & selection
  const [publishedCourses, setPublishedCourses] = useState<CourseSummary[]>([]);
  const [localDraftCourses, setLocalDraftCourses] = useState<CourseSummary[]>(() =>
    loadJson<CourseSummary[]>(STORAGE_KEYS.draftCourses, []),
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Persisted authoring artifacts for quick selection across reloads
  const [savedActivities, setSavedActivities] = useState<SavedActivityRef[]>(() =>
    loadJson<SavedActivityRef[]>(STORAGE_KEYS.activities, []),
  );
  const [savedRubrics, setSavedRubrics] = useState<SavedRubricRef[]>(() =>
    loadJson<SavedRubricRef[]>(STORAGE_KEYS.rubrics, []),
  );
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignmentRef[]>(() =>
    loadJson<SavedAssignmentRef[]>(STORAGE_KEYS.assignments, []),
  );

  // Discovered published skills from open review cases
  const [discoveredSkills, setDiscoveredSkills] = useState<AvailableSkill[]>([]);

  // Active tab & feedback banner
  const [activeTab, setActiveTab] = useState<AuthoringTab>('curriculum');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Create Course modal state
  const [showNewCourse, setShowNewCourse] = useState<boolean>(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCoursePolicy, setNewCoursePolicy] = useState('{"requiredLessonsPercent":100}');

  // Edit Course state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Chapter (Section) form state
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionPosition, setSectionPosition] = useState('1');

  // Lesson form state
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSectionId, setLessonSectionId] = useState('');
  const [lessonPosition, setLessonPosition] = useState('1');
  const [lessonSummary, setLessonSummary] = useState('');
  const [lessonContent, setLessonContent] = useState('');

  // Activity form state
  const [actTitle, setActTitle] = useState('');
  const [actSkillArea, setActSkillArea] = useState<'WRITING' | 'SPEAKING'>('WRITING');
  const [actPosition, setActPosition] = useState('1');
  const [actDifficulty, setActDifficulty] = useState('3');
  const [actMinutes, setActMinutes] = useState('40');
  const [actPrompt, setActPrompt] = useState('');
  const [actInstructions, setActInstructions] = useState(
    'Write at least 250 words. Organize your response into clear paragraphs.',
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [manualSkillInput, setManualSkillInput] = useState('');

  // Assignment & Version form state
  const [targetAssignmentId, setTargetAssignmentId] = useState(''); // empty = new assignment
  const [asgTitle, setAsgTitle] = useState('');
  const [asgActivityVersionId, setAsgActivityVersionId] = useState('');
  const [asgRubricVersionId, setAsgRubricVersionId] = useState('');
  const [asgMode, setAsgMode] = useState<AssignmentMode>('GRADED');
  const [asgMaxAttempts, setAsgMaxAttempts] = useState('1');
  const [asgMaxRevisions, setAsgMaxRevisions] = useState('1');
  const [asgTimeLimitMin, setAsgTimeLimitMin] = useState('40');
  const [asgOpensAt, setAsgOpensAt] = useState('');
  const [asgDueAt, setAsgDueAt] = useState('');
  const [asgAllowLate, setAsgAllowLate] = useState(false);
  const [asgReleaseMode, setAsgReleaseMode] = useState<ReleaseMode>('IMMEDIATE');
  const [asgReleaseAt, setAsgReleaseAt] = useState('');

  // Rubric form state
  const [rubricCode, setRubricCode] = useState('IELTS_WRITING_T2');
  const [rubricVersionNo, setRubricVersionNo] = useState('1');
  const [rubricTitle, setRubricTitle] = useState('IELTS Writing Task 2 Band Descriptors');
  const [rubricTaskType, setRubricTaskType] = useState<RubricTaskType>('WRITING_TASK_2');
  const [rubricCriteria, setRubricCriteria] = useState(
    DEFAULT_CRITERIA_BY_TASK.WRITING_TASK_2,
  );

  // Admin AI Config toggle
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [cfgRubricId, setCfgRubricId] = useState('');
  const [cfgModelId, setCfgModelId] = useState('gpt-4o-mini');
  const [cfgPromptCode, setCfgPromptCode] = useState('WRITING_T2_PROMPT');
  const [cfgPromptVersion, setCfgPromptVersion] = useState('1');
  const [cfgInstructions, setCfgInstructions] = useState(
    'Evaluate the IELTS essay strictly against the 4 rubric criteria and return valid JSON.',
  );
  const [cfgSchema, setCfgSchema] = useState(
    '{"type":"object","required":["summary","criteria"]}',
  );

  const allCourses = useMemo(() => {
    const map = new Map<string, CourseSummary>();
    for (const c of localDraftCourses) map.set(c.id, c);
    for (const c of publishedCourses) map.set(c.id, c);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [localDraftCourses, publishedCourses]);

  const loadCoursesAndSkills = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const courses = await instructorApi.getPublishedCourses();
      setPublishedCourses(courses);

      // Remove any local draft that is now returned by GET /courses
      const publishedIds = new Set(courses.map((c) => c.id));
      setLocalDraftCourses((prev) => {
        const filtered = prev.filter((c) => !publishedIds.has(c.id));
        if (filtered.length !== prev.length) {
          saveJson(STORAGE_KEYS.draftCourses, filtered);
        }
        return filtered;
      });

      setSelectedCourseId((prev) => {
        if (prev) return prev;
        const first = courses[0]?.id ?? loadJson<CourseSummary[]>(STORAGE_KEYS.draftCourses, [])[0]?.id ?? '';
        return first;
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to load courses.'),
      });
    } finally {
      setLoadingCourses(false);
    }

    // Attempt to harvest published skills from an existing review case (if any exist)
    try {
      const queue = await instructorApi.getReviewQueue();
      if (queue.length > 0) {
        const detail = await instructorApi.getReviewDetail(queue[0].id);
        if (detail.availableSkills?.length) {
          setDiscoveredSkills(detail.availableSkills);
        }
      }
    } catch {
      // Non-critical if queue is empty
    }
  }, []);

  const loadCourseDetail = useCallback(async (id: string) => {
    if (!id) {
      setCourseDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const detail = await instructorApi.getCourseDetail(id);
      setCourseDetail(detail);
      setEditTitle(detail.title);
      setEditDesc(detail.description);
      setSectionPosition(String(detail.sections.length + 1));
      const nextItemPos = detail.learningItems.length + 1;
      setLessonPosition(String(nextItemPos));
      setActPosition(String(nextItemPos));
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Could not load course details.'),
      });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadCoursesAndSkills();
  }, [loadCoursesAndSkills]);

  useEffect(() => {
    if (selectedCourseId) {
      void loadCourseDetail(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseDetail]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    let parsedPolicy: Record<string, unknown>;
    try {
      parsedPolicy = JSON.parse(newCoursePolicy) as Record<string, unknown>;
      if (!parsedPolicy || typeof parsedPolicy !== 'object' || Array.isArray(parsedPolicy)) {
        throw new Error('Policy must be a JSON object');
      }
    } catch {
      setBanner({ type: 'error', text: 'Completion policy must be valid JSON object.' });
      return;
    }

    setSubmitting(true);
    try {
      const created = await instructorApi.createCourse({
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim(),
        completionPolicyJson: parsedPolicy,
      });
      const updatedDrafts = [created, ...localDraftCourses];
      setLocalDraftCourses(updatedDrafts);
      saveJson(STORAGE_KEYS.draftCourses, updatedDrafts);
      setSelectedCourseId(created.id);
      setShowNewCourse(false);
      setNewCourseTitle('');
      setNewCourseDesc('');
      setBanner({
        type: 'success',
        text: `Course "${created.title}" created in DRAFT status. Add at least one lesson or activity before publishing.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create course.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCourse = async (patch: {
    title?: string;
    description?: string;
    status?: PublicationStatus;
    enrollmentOpen?: boolean;
  }) => {
    if (!courseDetail) return;
    setBanner(null);
    setSubmitting(true);
    try {
      const updated = await instructorApi.updateCourse(courseDetail.id, patch);
      setCourseDetail((prev) => (prev ? { ...prev, ...updated } : null));

      if (updated.status === 'PUBLISHED') {
        const filtered = localDraftCourses.filter((c) => c.id !== updated.id);
        setLocalDraftCourses(filtered);
        saveJson(STORAGE_KEYS.draftCourses, filtered);
        const published = await instructorApi.getPublishedCourses();
        setPublishedCourses(published);
      } else {
        setLocalDraftCourses((prev) => {
          const exists = prev.some((c) => c.id === updated.id);
          const next = exists
            ? prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            : [updated, ...prev];
          saveJson(STORAGE_KEYS.draftCourses, next);
          return next;
        });
      }

      setBanner({
        type: 'success',
        text: `Course updated (${updated.status}, enrollment ${updated.enrollmentOpen ? 'open' : 'closed'}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to update course.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseDetail) return;
    setBanner(null);
    setSubmitting(true);
    try {
      await instructorApi.createSection(courseDetail.id, {
        title: sectionTitle.trim(),
        position: Number(sectionPosition),
      });
      setSectionTitle('');
      await loadCourseDetail(courseDetail.id);
      setBanner({ type: 'success', text: 'Chapter added to course curriculum.' });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to add chapter.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseDetail) return;
    setBanner(null);
    setSubmitting(true);
    try {
      await instructorApi.createLesson(courseDetail.id, {
        title: lessonTitle.trim(),
        contentText: lessonContent.trim(),
        position: Number(lessonPosition),
        sectionId: lessonSectionId || null,
        summary: lessonSummary.trim() ? lessonSummary.trim() : null,
      });
      setLessonTitle('');
      setLessonSummary('');
      setLessonContent('');
      await loadCourseDetail(courseDetail.id);
      setBanner({ type: 'success', text: 'Lesson created and published to course.' });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create lesson.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddManualSkill = () => {
    const tokens = manualSkillInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    setSelectedSkillIds((prev) => Array.from(new Set([...prev, ...tokens])));
    setManualSkillInput('');
  };

  const toggleSkillId = (id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseDetail) return;
    setBanner(null);
    if (selectedSkillIds.length === 0) {
      setBanner({
        type: 'error',
        text: 'Select or enter at least 1 published Skill UUID matching the skill area.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const created = await instructorApi.createActivity(courseDetail.id, {
        title: actTitle.trim(),
        skillArea: actSkillArea,
        promptText: actPrompt.trim(),
        instructions: actInstructions.trim(),
        position: Number(actPosition),
        difficulty: Number(actDifficulty),
        expectedMinutes: Number(actMinutes),
        skillIds: selectedSkillIds,
      });

      const version = created.practiceActivity.activityVersions[0];
      if (version) {
        const ref: SavedActivityRef = {
          courseId: courseDetail.id,
          itemId: created.id,
          title: created.title,
          skillArea: created.practiceActivity.skillArea,
          activityVersionId: version.id,
          versionNo: version.versionNo,
        };
        const nextActivities = [ref, ...savedActivities];
        setSavedActivities(nextActivities);
        saveJson(STORAGE_KEYS.activities, nextActivities);
        setAsgActivityVersionId(version.id);
      }

      setActTitle('');
      setActPrompt('');
      await loadCourseDetail(courseDetail.id);
      setBanner({
        type: 'success',
        text: `Activity "${created.title}" published. ActivityVersion ID ready for assignment creation.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create activity.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskTypeChange = (nextType: RubricTaskType) => {
    setRubricTaskType(nextType);
    setRubricCriteria(DEFAULT_CRITERIA_BY_TASK[nextType]);
    if (nextType === 'WRITING_TASK_1') {
      setRubricCode('IELTS_WRITING_T1');
      setRubricTitle('IELTS Writing Task 1 Band Descriptors');
    } else if (nextType === 'WRITING_TASK_2') {
      setRubricCode('IELTS_WRITING_T2');
      setRubricTitle('IELTS Writing Task 2 Band Descriptors');
    } else {
      setRubricCode('IELTS_SPEAKING');
      setRubricTitle('IELTS Speaking Band Descriptors');
    }
  };

  const handleCreateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      const created = await instructorApi.createRubric({
        rubricCode: rubricCode.trim(),
        versionNo: Number(rubricVersionNo),
        title: rubricTitle.trim(),
        taskType: rubricTaskType,
        criteria: rubricCriteria.map((c) => ({
          code: c.code.trim(),
          name: c.name.trim(),
          definition: c.definition.trim(),
        })),
      });

      const ref: SavedRubricRef = {
        id: created.id,
        rubricCode: created.rubricCode,
        versionNo: created.versionNo,
        title: created.title,
        taskType: created.taskType as RubricTaskType,
      };
      const nextRubrics = [ref, ...savedRubrics];
      setSavedRubrics(nextRubrics);
      saveJson(STORAGE_KEYS.rubrics, nextRubrics);
      setAsgRubricVersionId(created.id);
      setCfgRubricId(created.id);
      setRubricVersionNo(String(Number(rubricVersionNo) + 1));

      setBanner({
        type: 'success',
        text: `Rubric "${created.title}" (v${created.versionNo}) published. ID: ${created.id}`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create rubric.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    let parsedSchema: Record<string, unknown>;
    try {
      parsedSchema = JSON.parse(cfgSchema) as Record<string, unknown>;
    } catch {
      setBanner({ type: 'error', text: 'Output Schema must be valid JSON.' });
      return;
    }

    setSubmitting(true);
    try {
      await instructorApi.createGradingConfig({
        rubricVersionId: cfgRubricId.trim(),
        modelId: cfgModelId.trim(),
        promptCode: cfgPromptCode.trim(),
        promptVersionNo: Number(cfgPromptVersion),
        instructions: cfgInstructions.trim(),
        outputSchemaJson: parsedSchema,
      });
      setBanner({
        type: 'success',
        text: 'AI grading configuration saved.',
      });
      setShowAiConfig(false);
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create AI grading config (Admin role required).'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseDetail) return;
    setBanner(null);

    const trimmedActivityVersionId = asgActivityVersionId.trim();
    const trimmedRubricVersionId = asgRubricVersionId.trim() ? asgRubricVersionId.trim() : null;
    const trimmedTitle = asgTitle.trim();

    const payload = {
      activityVersionId: trimmedActivityVersionId,
      title: trimmedTitle,
      mode: asgMode,
      rubricVersionId: trimmedRubricVersionId,
      maxAttempts: Number(asgMaxAttempts),
      maxRevisions: Number(asgMaxRevisions),
      opensAt: asgOpensAt ? new Date(asgOpensAt).toISOString() : null,
      dueAt: asgDueAt ? new Date(asgDueAt).toISOString() : null,
      timeLimitSeconds: asgTimeLimitMin ? Number(asgTimeLimitMin) * 60 : null,
      allowLate: asgAllowLate,
      releasePolicyJson:
        asgReleaseMode === 'SCHEDULED'
          ? {
              releaseMode: 'SCHEDULED' as const,
              releaseAt: asgReleaseAt ? new Date(asgReleaseAt).toISOString() : '',
            }
          : { releaseMode: asgReleaseMode },
    };

    setSubmitting(true);
    try {
      const created = targetAssignmentId
        ? await instructorApi.createAssignmentVersion(
            courseDetail.id,
            targetAssignmentId,
            payload as never,
          )
        : await instructorApi.createAssignment(courseDetail.id, payload as never);

      const ref: SavedAssignmentRef = {
        courseId: courseDetail.id,
        assignmentId: created.assignmentId,
        versionId: created.id,
        versionNo: created.versionNo,
        title: trimmedTitle,
        mode: created.mode,
        activityVersionId: trimmedActivityVersionId,
        rubricVersionId: trimmedRubricVersionId,
      };

      const nextAssignments = [ref, ...savedAssignments];
      setSavedAssignments(nextAssignments);
      saveJson(STORAGE_KEYS.assignments, nextAssignments);
      setTargetAssignmentId('');
      setAsgTitle('');

      setBanner({
        type: 'success',
        text: `Assignment "${ref.title}" (v${created.versionNo}) published.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: getErrorMessage(err, 'Failed to create assignment.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const courseActivities = useMemo(
    () => savedActivities.filter((a) => a.courseId === selectedCourseId),
    [savedActivities, selectedCourseId],
  );

  const courseAssignments = useMemo(
    () => savedAssignments.filter((a) => a.courseId === selectedCourseId),
    [savedAssignments, selectedCourseId],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Course Authoring Studio
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build structured IELTS courses, chapters, lessons, writing/speaking activities,
            rubrics, and graded assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewCourse((v) => !v)}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          {showNewCourse ? 'Close New Course Form' : '+ New Course'}
        </button>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          role="alert"
          className={`flex items-start justify-between rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="ml-4 font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New Course Drawer */}
      {showNewCourse && (
        <form
          onSubmit={(e) => void handleCreateCourse(e)}
          className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 shadow-xs"
        >
          <h2 className="text-base font-semibold text-slate-900">Create New Course (Draft)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Courses start in DRAFT status. Add at least one lesson or practice activity before
            publishing to learners.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Course Title *
              </label>
              <input
                type="text"
                required
                maxLength={240}
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="e.g., IELTS Academic Writing Band 7.5+"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Completion Policy JSON *
              </label>
              <input
                type="text"
                required
                value={newCoursePolicy}
                onChange={(e) => setNewCoursePolicy(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Description *
              </label>
              <textarea
                required
                rows={2}
                value={newCourseDesc}
                onChange={(e) => setNewCourseDesc(e.target.value)}
                placeholder="Outline the target band score, skills covered, and study format..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewCourse(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      )}

      {/* Main Split Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Course List */}
        <aside className="space-y-3 lg:col-span-4 xl:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Courses ({allCourses.length})
              </h2>
              <button
                type="button"
                onClick={() => void loadCoursesAndSkills()}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Refresh
              </button>
            </div>

            {loadingCourses ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading courses...</p>
            ) : allCourses.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No courses found yet.</p>
                <button
                  type="button"
                  onClick={() => setShowNewCourse(true)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Create your first course
                </button>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {allCourses.map((course) => {
                  const active = course.id === selectedCourseId;
                  return (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(course.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          active
                            ? 'border-blue-600 bg-blue-50/70'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              course.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : course.status === 'DRAFT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {course.status}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {course.enrollmentOpen ? 'Enrollment Open' : 'Closed'}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900">
                          {course.title}
                        </p>
                        {course._count && (
                          <p className="mt-1 text-xs text-slate-500">
                            {course._count.learningItems} items · {course._count.enrollments}{' '}
                            learners
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Workspace: Selected Course Builder */}
        <section className="space-y-6 lg:col-span-8 xl:col-span-9">
          {!selectedCourseId ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <p className="text-sm text-slate-500">
                Select a course on the left or create a new course to begin authoring.
              </p>
            </div>
          ) : loadingDetail || !courseDetail ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <p className="text-sm text-slate-500">Loading course workspace...</p>
            </div>
          ) : (
            <>
              {/* Course Status & Metadata Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          courseDetail.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : courseDetail.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {courseDetail.status}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        ID: {courseDetail.id}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-transparent px-2 py-1 text-lg font-bold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full rounded-lg border border-transparent px-2 py-1 text-sm text-slate-600 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(editTitle !== courseDetail.title ||
                      editDesc !== courseDetail.description) && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void handleUpdateCourse({
                            title: editTitle.trim(),
                            description: editDesc.trim(),
                          })
                        }
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Save Details
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void handleUpdateCourse({
                          enrollmentOpen: !courseDetail.enrollmentOpen,
                        })
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        courseDetail.enrollmentOpen
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {courseDetail.enrollmentOpen ? 'Enrollment: OPEN' : 'Open Enrollment'}
                    </button>

                    {courseDetail.status !== 'PUBLISHED' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleUpdateCourse({ status: 'PUBLISHED' })}
                        className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Publish Course
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleUpdateCourse({ status: 'HIDDEN' })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Hide Course
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-navigation Tabs */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      ['curriculum', `1. Chapters & Lessons (${courseDetail.learningItems.length})`],
                      ['activities', '2. Writing & Speaking Activities'],
                      ['assignments', '3. Assignments & Versions'],
                      ['rubrics', '4. Rubrics & AI Config'],
                    ] as [AuthoringTab, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                        activeTab === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ============================================================ */}
              {/* TAB 1: CURRICULUM (CHAPTERS & LESSONS)                       */}
              {/* ============================================================ */}
              {activeTab === 'curriculum' && (
                <div className="grid gap-6 xl:grid-cols-12">
                  {/* Existing Curriculum Tree */}
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-5">
                    <h3 className="text-sm font-bold text-slate-900">Course Structure</h3>
                    {courseDetail.sections.length === 0 &&
                    courseDetail.learningItems.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No chapters or learning items yet. Create a chapter or add a lesson on
                        the right.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {courseDetail.sections.map((sec) => {
                          const items = courseDetail.learningItems.filter(
                            (i) => i.sectionId === sec.id,
                          );
                          return (
                            <div
                              key={sec.id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                  Chapter {sec.position}: {sec.title}
                                </p>
                                <span className="text-[11px] text-slate-400">
                                  {items.length} items
                                </span>
                              </div>
                              {items.length > 0 && (
                                <ul className="mt-2 space-y-1.5">
                                  {items.map((item) => (
                                    <li
                                      key={item.id}
                                      className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs shadow-2xs"
                                    >
                                      <span className="font-medium text-slate-800">
                                        {item.position}. {item.title}
                                      </span>
                                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                        {item.kind}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}

                        {/* Unassigned items */}
                        {courseDetail.learningItems.some((i) => !i.sectionId) && (
                          <div className="rounded-lg border border-slate-200 p-3.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              General Course Items
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {courseDetail.learningItems
                                .filter((i) => !i.sectionId)
                                .map((item) => (
                                  <li
                                    key={item.id}
                                    className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs"
                                  >
                                    <span className="font-medium text-slate-800">
                                      {item.position}. {item.title}
                                    </span>
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                      {item.kind}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Add Chapter & Add Lesson Forms */}
                  <div className="space-y-6 xl:col-span-7">
                    {/* Add Chapter */}
                    <form
                      onSubmit={(e) => void handleAddSection(e)}
                      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
                    >
                      <h3 className="text-sm font-bold text-slate-900">Add Chapter</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-600">
                            Chapter Title *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={240}
                            value={sectionTitle}
                            onChange={(e) => setSectionTitle(e.target.value)}
                            placeholder="e.g., Module 1: Essay Structure & Thesis Statements"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Position *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={sectionPosition}
                            onChange={(e) => setSectionPosition(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          Add Chapter
                        </button>
                      </div>
                    </form>

                    {/* Add Lesson */}
                    <form
                      onSubmit={(e) => void handleAddLesson(e)}
                      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
                    >
                      <h3 className="text-sm font-bold text-slate-900">Create Text Lesson</h3>
                      <div className="mt-3 grid gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">
                            Lesson Title *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={240}
                            value={lessonTitle}
                            onChange={(e) => setLessonTitle(e.target.value)}
                            placeholder="e.g., How to Write a Band 8 Introduction"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Position *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={lessonPosition}
                            onChange={(e) => setLessonPosition(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Chapter (Optional)
                          </label>
                          <select
                            value={lessonSectionId}
                            onChange={(e) => setLessonSectionId(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">No chapter (top-level)</option>
                            {courseDetail.sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.position}. {s.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">
                            Short Summary (Optional)
                          </label>
                          <input
                            type="text"
                            value={lessonSummary}
                            onChange={(e) => setLessonSummary(e.target.value)}
                            placeholder="Brief overview shown before the lesson content"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-600">
                            Lesson Body Content *
                          </label>
                          <textarea
                            required
                            rows={6}
                            value={lessonContent}
                            onChange={(e) => setLessonContent(e.target.value)}
                            placeholder="Write the full lesson reading material here..."
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Publish Lesson
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 2: WRITING & SPEAKING ACTIVITIES                         */}
              {/* ============================================================ */}
              {activeTab === 'activities' && (
                <div className="grid gap-6 xl:grid-cols-12">
                  <form
                    onSubmit={(e) => void handleCreateActivity(e)}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-7"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Create Writing or Speaking Practice Activity
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Publishes an immutable ActivityVersion that can be attached to an
                        assignment.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Activity Title *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={240}
                          value={actTitle}
                          onChange={(e) => setActTitle(e.target.value)}
                          placeholder="e.g., Task 2 Essay: Technology & Remote Work"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Skill Area *
                        </label>
                        <select
                          value={actSkillArea}
                          onChange={(e) =>
                            setActSkillArea(e.target.value as 'WRITING' | 'SPEAKING')
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="WRITING">WRITING</option>
                          <option value="SPEAKING">SPEAKING</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Curriculum Position *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={actPosition}
                          onChange={(e) => setActPosition(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Difficulty (1 - 5) *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          required
                          value={actDifficulty}
                          onChange={(e) => setActDifficulty(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Expected Minutes (1 - 240) *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={240}
                          required
                          value={actMinutes}
                          onChange={(e) => setActMinutes(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Target Published Skill IDs (1 - 20 required) *
                        </label>
                        {discoveredSkills.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {discoveredSkills.map((sk) => {
                              const picked = selectedSkillIds.includes(sk.id);
                              return (
                                <button
                                  key={sk.id}
                                  type="button"
                                  onClick={() => toggleSkillId(sk.id)}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                    picked
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {sk.name} ({sk.code})
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={manualSkillInput}
                            onChange={(e) => setManualSkillInput(e.target.value)}
                            placeholder="Paste published Skill UUID(s)..."
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddManualSkill}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Add UUID
                          </button>
                        </div>
                        {selectedSkillIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedSkillIds.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700"
                              >
                                {id}
                                <button
                                  type="button"
                                  onClick={() => toggleSkillId(id)}
                                  className="font-bold text-blue-900 hover:text-rose-600"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Task Prompt *
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={actPrompt}
                          onChange={(e) => setActPrompt(e.target.value)}
                          placeholder="Some people believe that remote work improves productivity, while others think it harms team collaboration. Discuss both views and give your own opinion."
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Candidate Instructions *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={actInstructions}
                          onChange={(e) => setActInstructions(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Create & Publish Activity
                      </button>
                    </div>
                  </form>

                  {/* Created ActivityVersions in this course */}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Published Activity Versions ({courseActivities.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Use an ActivityVersion ID when publishing an assignment in Step 3.
                    </p>
                    {courseActivities.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Activities created in this browser will appear here with copyable
                        ActivityVersion IDs.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {courseActivities.map((act) => (
                          <li
                            key={act.activityVersionId}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{act.title}</span>
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                {act.skillArea} v{act.versionNo}
                              </span>
                            </div>
                            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                              {act.activityVersionId}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAsgActivityVersionId(act.activityVersionId);
                                setAsgTitle(act.title);
                                setActiveTab('assignments');
                              }}
                              className="mt-2 font-semibold text-blue-600 hover:underline"
                            >
                              Create Assignment with this Activity →
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 3: ASSIGNMENTS & VERSIONS                                */}
              {/* ============================================================ */}
              {activeTab === 'assignments' && (
                <div className="grid gap-6 xl:grid-cols-12">
                  <form
                    onSubmit={(e) => void handleCreateAssignment(e)}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-7"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {targetAssignmentId
                          ? 'Publish New Assignment Version'
                          : 'Create & Publish Assignment'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Binds an ActivityVersion and RubricVersion with grading mode, attempt
                        limits, and release policy.
                      </p>
                    </div>

                    {courseAssignments.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Target Assignment (New vs. New Version)
                        </label>
                        <select
                          value={targetAssignmentId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setTargetAssignmentId(id);
                            const existing = courseAssignments.find(
                              (a) => a.assignmentId === id,
                            );
                            if (existing) {
                              setAsgTitle(existing.title);
                              setAsgActivityVersionId(existing.activityVersionId);
                              setAsgRubricVersionId(existing.rubricVersionId ?? '');
                              setAsgMode(existing.mode);
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">+ Create Brand New Assignment</option>
                          {Array.from(
                            new Map(
                              courseAssignments.map((a) => [a.assignmentId, a]),
                            ).values(),
                          ).map((a) => (
                            <option key={a.assignmentId} value={a.assignmentId}>
                              New version of: {a.title} (latest v{a.versionNo})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Assignment Title *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={240}
                          value={asgTitle}
                          onChange={(e) => setAsgTitle(e.target.value)}
                          placeholder="e.g., Week 1 Graded Essay Submission"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          ActivityVersion ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={asgActivityVersionId}
                          onChange={(e) => setAsgActivityVersionId(e.target.value)}
                          placeholder="UUID of published ActivityVersion in this course"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
                        />
                        {courseActivities.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {courseActivities.map((act) => (
                              <button
                                key={act.activityVersionId}
                                type="button"
                                onClick={() => setAsgActivityVersionId(act.activityVersionId)}
                                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                Use: {act.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Published RubricVersion ID (Required for Writing/Speaking) *
                        </label>
                        <input
                          type="text"
                          value={asgRubricVersionId}
                          onChange={(e) => setAsgRubricVersionId(e.target.value)}
                          placeholder="UUID of matching published RubricVersion"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
                        />
                        {savedRubrics.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {savedRubrics.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setAsgRubricVersionId(r.id)}
                                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                Use: {r.rubricCode} v{r.versionNo} ({r.taskType})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Mode *
                        </label>
                        <select
                          value={asgMode}
                          onChange={(e) => setAsgMode(e.target.value as AssignmentMode)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="GRADED">GRADED</option>
                          <option value="PRACTICE">PRACTICE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Result Release Policy *
                        </label>
                        <select
                          value={asgReleaseMode}
                          onChange={(e) => setAsgReleaseMode(e.target.value as ReleaseMode)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="IMMEDIATE">IMMEDIATE</option>
                          <option value="MANUAL">MANUAL (Teacher publishes)</option>
                          <option value="AFTER_DUE_DATE">AFTER_DUE_DATE</option>
                          <option value="SCHEDULED">SCHEDULED</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Max Attempts (1 - 100)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={asgMaxAttempts}
                          onChange={(e) => setAsgMaxAttempts(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Max Revisions per Attempt
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={asgMaxRevisions}
                          onChange={(e) => setAsgMaxRevisions(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Time Limit (Minutes, optional)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={asgTimeLimitMin}
                          onChange={(e) => setAsgTimeLimitMin(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={asgAllowLate}
                            onChange={(e) => setAsgAllowLate(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          Allow Late Submissions
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Opens At (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={asgOpensAt}
                          onChange={(e) => setAsgOpensAt(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Due At {asgReleaseMode === 'AFTER_DUE_DATE' ? '*' : '(Optional)'}
                        </label>
                        <input
                          type="datetime-local"
                          required={asgReleaseMode === 'AFTER_DUE_DATE'}
                          value={asgDueAt}
                          onChange={(e) => setAsgDueAt(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {asgReleaseMode === 'SCHEDULED' && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">
                            Scheduled Release At *
                          </label>
                          <input
                            type="datetime-local"
                            required
                            value={asgReleaseAt}
                            onChange={(e) => setAsgReleaseAt(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {targetAssignmentId
                          ? 'Publish Assignment Version'
                          : 'Create & Publish Assignment'}
                      </button>
                    </div>
                  </form>

                  {/* Published Assignments List */}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Published Assignments ({courseAssignments.length})
                    </h3>
                    {courseAssignments.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Assignments published in this course will appear here.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {courseAssignments.map((a) => (
                          <li
                            key={a.versionId}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{a.title}</span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                {a.mode} · v{a.versionNo}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-slate-500">
                              Assignment ID: {a.assignmentId}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 4: RUBRICS & AI GRADING CONFIG                           */}
              {/* ============================================================ */}
              {activeTab === 'rubrics' && (
                <div className="grid gap-6 xl:grid-cols-12">
                  <form
                    onSubmit={(e) => void handleCreateRubric(e)}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs xl:col-span-7"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          IELTS Rubric Builder (4-Criterion Band Scale 0–9)
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Creates and immediately publishes a 4-criterion rubric (25% weight each).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAiConfig((v) => !v)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {showAiConfig ? 'Hide AI Config' : 'Admin AI Config'}
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Task Type *
                        </label>
                        <select
                          value={rubricTaskType}
                          onChange={(e) =>
                            handleTaskTypeChange(e.target.value as RubricTaskType)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="WRITING_TASK_2">WRITING_TASK_2</option>
                          <option value="WRITING_TASK_1">WRITING_TASK_1</option>
                          <option value="SPEAKING">SPEAKING</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Rubric Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={60}
                          value={rubricCode}
                          onChange={(e) => setRubricCode(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600">
                          Version No *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={rubricVersionNo}
                          onChange={(e) => setRubricVersionNo(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-600">
                          Rubric Title *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={240}
                          value={rubricTitle}
                          onChange={(e) => setRubricTitle(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Required Criteria (4 × 0.25 weight, Max Band 9.0)
                      </p>
                      {rubricCriteria.map((c, idx) => (
                        <div
                          key={c.code}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                        >
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500">
                                Code
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={c.code}
                                className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[11px] font-semibold text-slate-500">
                                Criterion Name *
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={140}
                                value={c.name}
                                onChange={(e) => {
                                  const next = [...rubricCriteria];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setRubricCriteria(next);
                                }}
                                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="block text-[11px] font-semibold text-slate-500">
                                Scoring Definition *
                              </label>
                              <textarea
                                required
                                rows={2}
                                value={c.definition}
                                onChange={(e) => {
                                  const next = [...rubricCriteria];
                                  next[idx] = { ...next[idx], definition: e.target.value };
                                  setRubricCriteria(next);
                                }}
                                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Publish Rubric
                      </button>
                    </div>
                  </form>

                  {/* Saved Rubrics & Optional Admin AI Config */}
                  <div className="space-y-6 xl:col-span-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900">
                        Published Rubrics ({savedRubrics.length})
                      </h3>
                      {savedRubrics.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">
                          Rubrics published here can be linked directly to assignments.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2.5">
                          {savedRubrics.map((r) => (
                            <li
                              key={r.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900">{r.title}</span>
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                  v{r.versionNo}
                                </span>
                              </div>
                              <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                                {r.id}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setAsgRubricVersionId(r.id);
                                  setActiveTab('assignments');
                                }}
                                className="mt-2 font-semibold text-blue-600 hover:underline"
                              >
                                Use in Assignment →
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {showAiConfig && (
                      <form
                        onSubmit={(e) => void handleCreateAiConfig(e)}
                        className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
                      >
                        <h3 className="text-sm font-bold text-slate-900">
                          AI Grading Config (Admin Only)
                        </h3>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Published Writing Rubric ID *
                          </label>
                          <input
                            type="text"
                            required
                            value={cfgRubricId}
                            onChange={(e) => setCfgRubricId(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Model ID *
                            </label>
                            <input
                              type="text"
                              required
                              value={cfgModelId}
                              onChange={(e) => setCfgModelId(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Prompt Code *
                            </label>
                            <input
                              type="text"
                              required
                              value={cfgPromptCode}
                              onChange={(e) => setCfgPromptCode(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Prompt Version No *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={cfgPromptVersion}
                            onChange={(e) => setCfgPromptVersion(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            System Instructions *
                          </label>
                          <textarea
                            required
                            rows={2}
                            value={cfgInstructions}
                            onChange={(e) => setCfgInstructions(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">
                            Output JSON Schema *
                          </label>
                          <input
                            type="text"
                            required
                            value={cfgSchema}
                            onChange={(e) => setCfgSchema(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Save AI Grading Config
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
