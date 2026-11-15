import CompletionBadge from "./CompletionBadge";
import { type MouseEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../auth/session";
import {
  getCourseDetail,
  type CourseDetail,
  type CourseLearningItem,
} from "./courseDetailApi";
import CourseEnrollmentPanel from "./CourseEnrollmentPanel";
import {
  getSyllabusStorageKey,
  readStoredOpenSectionIds,
  writeStoredOpenSectionIds,
} from "./syllabusStorage";

const SKILL_AREA_BADGES: Record<string, string> = {
  READING: "bg-sky-50 text-sky-700 border border-sky-200",
  WRITING: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  LISTENING: "bg-teal-50 text-teal-700 border border-teal-200",
  SPEAKING: "bg-amber-50 text-amber-800 border border-amber-200",
};

function formatSkillArea(area: string) {
  return area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
}

function SyllabusItems({ items }: { items: CourseLearningItem[] }) {
  const { courseId } = useParams<{ courseId: string }>();

  if (items.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-slate-500">
        No published content in this chapter yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {items.map((item) => {
        const skillArea = item.practiceActivity?.skillArea;
        const isLesson = item.kind === "LESSON";
        return (
          <li
            key={item.id}
            className="space-y-2 px-3.5 py-4 transition-colors hover:bg-slate-50/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isLesson
                      ? "bg-blue-50 text-[#2563eb]"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {isLesson ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <path d="m9 14 2 2 4-4" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 break-words text-sm font-medium text-slate-800">
                  {courseId && (isLesson || item.kind === "PRACTICE") ? (
                    <Link
                      to={
                        `/courses/${encodeURIComponent(courseId)}/` +
                        (isLesson ? "lessons" : "practices") +
                        `/${encodeURIComponent(item.id)}`
                      }
                      className="font-semibold text-[#1d4ed8] hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                  {isLesson
                    ? item.progress?.status === "COMPLETED" && (
                        <div className="mt-2">
                          <CompletionBadge />
                        </div>
                      )
                    : item.kind === "PRACTICE" &&
                      item.practiceCompleted === true && (
                        <div className="mt-2">
                          <CompletionBadge />
                        </div>
                      )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {skillArea && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      SKILL_AREA_BADGES[skillArea] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatSkillArea(skillArea)}
                  </span>
                )}
                <span
                  className={
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold " +
                    (isLesson
                      ? "bg-blue-50 text-blue-700"
                      : "bg-amber-50 text-amber-800")
                  }
                >
                  {isLesson ? "Lesson" : "Practice"}
                </span>
              </div>
            </div>

            {item.lesson?.summary && (
              <p className="pl-9 text-xs leading-5 text-slate-500">
                {item.lesson.summary}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type CourseDetailPageProps = {
  accessToken?: string | null;
};

export default function CourseDetailPage({
  accessToken = null,
}: CourseDetailPageProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openSectionsByKey, setOpenSectionsByKey] = useState<{
    key: string;
    ids: string[];
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourse() {
      setLoading(true);
      setError("");
      setCourse(null);

      try {
        if (!courseId) {
          throw new Error("The course link is invalid.");
        }

        const data = await getCourseDetail(
          courseId,
          controller.signal,
          accessToken,
        );

        if (!controller.signal.aborted) {
          setCourse(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load course details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCourse();

    return () => controller.abort();
  }, [courseId, reloadKey, accessToken]);

  const sections = [...(course?.sections ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const validSectionIds = sections.map((section) => section.id);
  const syllabusStorageKey = course
    ? getSyllabusStorageKey(course.id, userId)
    : null;
  const resolvedOpenSectionIds = !syllabusStorageKey
    ? []
    : openSectionsByKey?.key === syllabusStorageKey
      ? openSectionsByKey.ids.filter((id) => validSectionIds.includes(id))
      : (readStoredOpenSectionIds(syllabusStorageKey, validSectionIds) ??
        (validSectionIds.length > 0 ? [validSectionIds[0]] : []));

  function handleToggleSection(
    event: MouseEvent<HTMLElement>,
    sectionId: string,
  ) {
    event.preventDefault();
    if (!syllabusStorageKey) return;
    const currentlyOpen = resolvedOpenSectionIds.includes(sectionId);
    const nextIds = currentlyOpen
      ? resolvedOpenSectionIds.filter((id) => id !== sectionId)
      : [...resolvedOpenSectionIds, sectionId];
    setOpenSectionsByKey({ key: syllabusStorageKey, ids: nextIds });
    writeStoredOpenSectionIds(syllabusStorageKey, nextIds);
  }

  const items = [...(course?.learningItems ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  const sectionIds = new Set(sections.map((section) => section.id));

  const otherItems = items.filter(
    (item) => item.sectionId === null || !sectionIds.has(item.sectionId),
  );

  const lessonItems = items.filter((item) => item.kind === "LESSON");
  const lessonCount = lessonItems.length;
  const practiceCount = items.filter((item) => item.kind === "PRACTICE").length;
  const skillAreas = Array.from(
    new Set(
      items
        .map((item) => item.practiceActivity?.skillArea)
        .filter((area): area is string => Boolean(area)),
    ),
  );
  const hasLessonProgress =
    lessonCount > 0 && lessonItems.some((item) => item.progress != null);
  const completedLessons = lessonItems.filter(
    (item) => item.progress?.status === "COMPLETED",
  ).length;
  const lessonProgressPct =
    lessonCount > 0 ? Math.round((completedLessons / lessonCount) * 100) : 0;

  return (
    <div className="student-surface-overview min-h-[calc(100vh-4rem)]">
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
      <Link
        to="/courses"
        className="mb-5 inline-block text-sm font-semibold text-blue-600 hover:underline"
      >
        ← Back to courses
      </Link>
      {loading ? (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500"
        >
          Loading course details...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8"
        >
          <h1 className="text-xl font-bold text-slate-900">
            Unable to open this course
          </h1>

          <p className="mt-3 text-sm text-red-700">{error}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Try again
            </button>

            <Link
              to="/courses"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to courses
            </Link>
          </div>
        </div>
      ) : course ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">
            Course overview
          </p>

          <h1 className="mt-1.5 break-words text-2xl font-bold text-[#0f172a]">
            {course.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {skillAreas.map((area) => (
              <span
                key={area}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  SKILL_AREA_BADGES[area] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {formatSkillArea(area)}
              </span>
            ))}

            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (course.enrollmentOpen
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600")
              }
            >
              {course.enrollmentOpen
                ? "Open for enrollment"
                : "Enrollment closed"}
            </span>

            <span className="text-sm text-slate-600">
              By {course.creator.displayName}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
            <a
              href="#course-syllabus-heading"
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1e40af]"
            >
              Course syllabus ({items.length}) &darr;
            </a>
          </div>

          <div className="mt-4 grid items-start gap-6 lg:mt-6 lg:grid-cols-[2fr_1fr]">
            <section
              aria-labelledby="course-overview-heading"
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2
                id="course-overview-heading"
                className="text-lg font-semibold text-[#0f172a]"
              >
                About this course
              </h2>

              <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">
                {course.description || "No description available yet."}
              </p>

              {hasLessonProgress && (
                <div className="mt-5 rounded-xl border border-blue-200/90 border-l-4 border-l-[#2563eb] bg-[#eff6ff]/65 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-[#0f172a]">
                      Lesson progress
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#1e40af]">
                        {completedLessons} of {lessonCount}{" "}
                        {lessonCount === 1 ? "lesson" : "lessons"} completed
                      </span>
                      <span className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-bold text-[#2563eb]">
                        {lessonProgressPct}%
                      </span>
                    </div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Lesson progress"
                    aria-valuenow={completedLessons}
                    aria-valuemin={0}
                    aria-valuemax={lessonCount}
                    className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-blue-100"
                  >
                    <div
                      className="h-full rounded-full bg-[#2563eb] transition-all"
                      style={{ width: `${lessonProgressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#64748b]">
                    Tracks published lessons marked complete. Required practice
                    results are verified separately via course completion.
                  </p>
                </div>
              )}

              <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 text-center sm:text-left">
                {[
                  { label: "Chapters", value: sections.length },
                  { label: "Published lessons", value: lessonCount },
                  { label: "Practice activities", value: practiceCount },
                ].map((fact) => (
                  <div key={fact.label} className="px-3 py-3 sm:px-4">
                    <dt className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-xl font-bold tracking-tight text-[#0f172a]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <CourseEnrollmentPanel
                courseId={course.id}
                enrollmentOpen={course.enrollmentOpen}
                accessToken={accessToken}
              />
            </section>

            <aside
              aria-labelledby="course-syllabus-heading"
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2
                id="course-syllabus-heading"
                className="scroll-mt-20 text-lg font-semibold text-[#0f172a]"
              >
                Course syllabus
              </h2>

              <div className="mt-4 space-y-3">
                {sections.map((section, index) => {
                  const sectionItems = items.filter(
                    (item) => item.sectionId === section.id,
                  );

                  return (
                    <details
                      key={section.id}
                      open={resolvedOpenSectionIds.includes(section.id)}
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors open:border-blue-200 open:shadow-sm"
                    >
                      <summary
                        onClick={(event) =>
                          handleToggleSection(event, section.id)
                        }
                        className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/90 p-4 text-slate-700 transition-colors hover:bg-slate-100 group-open:bg-[#eff6ff]/70 group-open:text-[#1e40af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
                      >
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-semibold leading-6">
                            {index + 1}. {section.title}
                          </span>

                          <span className="mt-1 block text-xs text-slate-500 group-open:text-[#1e40af]/80">
                            {sectionItems.length}{" "}
                            {sectionItems.length === 1
                              ? "learning item"
                              : "learning items"}
                          </span>
                        </span>

                        <span
                          aria-hidden="true"
                          className="mr-1 h-2 w-2 shrink-0 rotate-45 border-b-2 border-r-2 border-slate-400 transition-transform duration-200 group-open:rotate-[225deg] group-open:border-[#2563eb] motion-reduce:transition-none"
                        />
                      </summary>

                      <div className="border-t border-slate-200 group-open:border-blue-100">
                        <SyllabusItems items={sectionItems} />
                      </div>
                    </details>
                  );
                })}

                {otherItems.length > 0 && (
                  <section className="overflow-hidden rounded-lg border border-slate-200">
                    <h3 className="bg-slate-50 p-3 text-sm font-medium text-slate-700">
                      {sections.length > 0
                        ? "Other course content"
                        : "Course content"}
                    </h3>

                    <SyllabusItems items={otherItems} />
                  </section>
                )}

                {sections.length === 0 && items.length === 0 && (
                  <p className="text-sm leading-6 text-slate-500">
                    No published content available yet.
                  </p>
                )}
              </div>

              <Link
                to="/courses"
                className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                ← Back to courses
              </Link>
            </aside>
          </div>
        </>
      ) : null}
    </main>
    </div>
  );
}
