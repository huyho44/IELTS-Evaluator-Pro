import { isRecord, studentRequest } from "../../lib/api/studentRequest";

export type OverviewItem = {
  id: string;
  title: string;
  kind: string;
  path: string;
};

export type OverviewCourse = {
  courseId: string;
  title: string;
  status: "ACTIVE" | "COMPLETED";
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
  progress: {
    completedItems: number;
    totalItems: number;
    completedLessons: number;
    totalLessons: number;
    percent: number;
  };
  nextItem: OverviewItem | null;
};

export type LearningOverview = {
  continueLearning:
    | (OverviewItem & {
        courseId: string;
        courseTitle: string;
        lastAccessedAt: string | null;
      })
    | null;
  inProgress: OverviewCourse[];
  completed: OverviewCourse[];
  resumeAttempts: {
    id: string;
    attemptNo: number;
    startedAt: string;
    expiresAt: string | null;
    title: string;
    courseId: string;
    courseTitle: string;
    path: string;
  }[];
};

// Only internal app paths are followed from server data.
const safePath = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

export function parseOverview(value: unknown): LearningOverview {
  if (
    !isRecord(value) ||
    !Array.isArray(value.inProgress) ||
    !Array.isArray(value.completed) ||
    !Array.isArray(value.resumeAttempts) ||
    (value.continueLearning !== null &&
      (!isRecord(value.continueLearning) ||
        !safePath(value.continueLearning.path))) ||
    ![...value.inProgress, ...value.completed].every(
      (course) =>
        isRecord(course) &&
        typeof course.courseId === "string" &&
        typeof course.title === "string" &&
        isRecord(course.progress) &&
        typeof course.progress.percent === "number" &&
        (course.nextItem === null ||
          (isRecord(course.nextItem) && safePath(course.nextItem.path))),
    ) ||
    !value.resumeAttempts.every(
      (attempt) => isRecord(attempt) && safePath(attempt.path),
    )
  )
    throw new Error("The server returned an unexpected learning overview.");
  return value as unknown as LearningOverview;
}

export async function getLearningOverview(token: string, signal?: AbortSignal) {
  return parseOverview(
    await studentRequest("/me/learning-overview", token, { signal }),
  );
}

// Share of the page scrolled, rounded to 0.001 (0 at top, 1 at bottom).
export function scrollRatio(scrollY: number, scrollable: number) {
  if (scrollable <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, scrollY / scrollable)) * 1000) / 1000;
}

// Saved position worth restoring: unfinished lessons read past the top.
export function savedScrollRatio(progress: {
  status: string;
  lastPositionJson?: unknown;
}) {
  const position = progress.lastPositionJson;
  if (progress.status === "COMPLETED" || !isRecord(position)) return null;
  const ratio = position.scrollRatio;
  return typeof ratio === "number" && ratio > 0.05 && ratio <= 1 ? ratio : null;
}

// Records a lesson visit (and optionally the reading position).
export async function recordLessonVisit(
  courseId: string,
  lessonId: string,
  token: string,
  ratio?: number,
) {
  return studentRequest(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/progress`,
    token,
    {
      method: "POST",
      body: ratio === undefined ? {} : { position: { scrollRatio: ratio } },
    },
  );
}
