import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getLearningOverview,
  type LearningOverview,
  type OverviewCourse,
} from "./overviewApi";

// A6: "Continue learning", unfinished attempts, and in-progress / completed
// courses with their progress.
export default function LearningOverviewPanel({
  accessToken,
  reloadKey,
}: {
  accessToken: string;
  reloadKey: number;
}) {
  const [overview, setOverview] = useState<LearningOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    getLearningOverview(accessToken, controller.signal)
      .then((data) => {
        setOverview(data);
        setError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your courses.",
          );
      });
    return () => controller.abort();
  }, [accessToken, reloadKey]);

  if (error)
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error}
      </p>
    );
  if (!overview) return null;
  const { continueLearning, resumeAttempts, inProgress, completed } = overview;
  if (!continueLearning && !inProgress.length && !completed.length && !resumeAttempts.length)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        You are not enrolled in any course yet.{" "}
        <Link to="/courses" className="font-semibold text-brand-700 hover:underline">
          Browse courses
        </Link>
      </section>
    );

  return (
    <div className="space-y-4">
      {(continueLearning || resumeAttempts.length > 0) && (
        <section
          aria-labelledby="continue-learning-heading"
          className="grid gap-3 lg:grid-cols-2"
        >
          <h2 id="continue-learning-heading" className="sr-only">
            Continue learning
          </h2>
          {continueLearning && (
            <Link
              to={continueLearning.path}
              className="group flex flex-col justify-between gap-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm transition-colors hover:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Continue learning
              </span>
              <span>
                <span className="block break-words text-lg font-bold text-slate-900">
                  {continueLearning.title}
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">
                  {continueLearning.kind === "LESSON" ? "Lesson" : "Practice"} in{" "}
                  {continueLearning.courseTitle}
                </span>
              </span>
              <span className="text-sm font-semibold text-brand-700 group-hover:underline">
                {continueLearning.lastAccessedAt ? "Resume" : "Start"} →
              </span>
            </Link>
          )}
          {resumeAttempts.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Unfinished attempts
              </h3>
              <ul className="mt-2 space-y-2">
                {resumeAttempts.slice(0, 4).map((attempt) => (
                  <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{attempt.title}</span>
                      <span className="text-xs text-slate-500">
                        {attempt.courseTitle} · attempt {attempt.attemptNo}
                        {attempt.expiresAt
                          ? ` · ends ${new Date(attempt.expiresAt).toLocaleString()}`
                          : ""}
                      </span>
                    </span>
                    <Link
                      to={attempt.path}
                      className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
                    >
                      Resume
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <CourseList title="In progress" courses={inProgress} />
      <CourseList title="Completed" courses={completed} />
    </div>
  );
}

function CourseList({ title, courses }: { title: string; courses: OverviewCourse[] }) {
  if (!courses.length) return null;
  return (
    <section aria-label={`${title} courses`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        {title} <span className="font-normal text-slate-500">({courses.length})</span>
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {courses.map((course) => (
          <li key={course.courseId} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={`/courses/${course.courseId}`}
                className="min-w-0 break-words text-sm font-semibold text-slate-900 hover:text-brand-700 hover:underline"
              >
                {course.title}
              </Link>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-700">
                {course.progress.percent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${course.title} progress`}
              aria-valuenow={course.progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={`h-full rounded-full ${course.status === "COMPLETED" ? "bg-emerald-500" : "bg-brand-600"}`}
                style={{ width: `${course.progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {course.progress.completedItems} of {course.progress.totalItems} items done
              {course.status === "COMPLETED" && course.completedAt
                ? ` · completed ${new Date(course.completedAt).toLocaleDateString()}`
                : ""}
            </p>
            {course.status === "ACTIVE" && course.nextItem && (
              <Link
                to={course.nextItem.path}
                className="inline-block text-xs font-semibold text-brand-700 hover:underline"
              >
                Next: {course.nextItem.title} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
