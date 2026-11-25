import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import ActionForm from "./ActionForm";
import ContentEditor from "./authoring/ContentEditor";
import PrerequisitesEditor from "./authoring/PrerequisitesEditor";
import QuizBuilder from "./authoring/QuizBuilder";
import {
  managementRequest as request,
  managementError,
  field,
  panel,
  type Catalog,
} from "./managementApi";

type Template = {
  instructions: string;
  schema: unknown;
  criteria: { code: string; name: string; definition: string }[];
};

const COURSE_STATUS_BADGES: Record<string, string> = {
  DRAFT: "border border-amber-200 bg-amber-50 text-amber-800",
  PUBLISHED: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  HIDDEN: "border border-slate-200 bg-slate-100 text-slate-700",
  ARCHIVED: "border border-rose-200 bg-rose-50 text-rose-800",
};

type WorkspaceTab = "curriculum" | "assignments" | "rubrics";
type CurriculumSubTab =
  | "settings"
  | "content"
  | "prerequisites"
  | "section"
  | "lesson"
  | "activity"
  | "quiz";

export default function AuthoringPage({
  mode = "instructor",
}: {
  mode?: "admin" | "instructor";
}) {
  const { session } = useSession();
  return <Content key={session?.user.id} mode={mode} />;
}

function Content({ mode }: { mode: "admin" | "instructor" }) {
  const { session } = useSession();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [courseId, setCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED"
  >("ALL");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("curriculum");
  const [curriculumSubTab, setCurriculumSubTab] =
    useState<CurriculumSubTab>("settings");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const action = useRef(false);

  const isAdminMode = mode === "admin";
  const variant = isAdminMode ? "admin" : "instructor";

  useEffect(() => {
    let active = true;
    Promise.all([
      request<Catalog>("GET", "/authoring/catalog"),
      request<Template>("GET", "/grading/templates/writing-task-2"),
    ])
      .then(([data, t]) => {
        if (active) {
          setCatalog(data);
          setTemplate(t);
          setCourseId((previous) => {
            if (previous && data.courses.some((c) => c.id === previous)) {
              return previous;
            }
            return data.courses[0]?.id || "";
          });
        }
      })
      .catch((cause) => {
        if (active) setError(managementError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  async function run<T = unknown>(
    method: "POST" | "PATCH" | "PUT",
    path: string,
    body: unknown,
    onSuccess?: (result: T) => void,
  ) {
    if (action.current) return false;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<T>(method, path, body);
      onSuccess?.(result);
      setMessage(
        "Saved. Published versions already used by attempts were preserved.",
      );
      setLoading(true);
      setRefresh((v) => v + 1);
      return true;
    } catch (cause) {
      setError(managementError(cause));
      return false;
    } finally {
      action.current = false;
      setBusy(false);
    }
  }

  const courses = catalog?.courses ?? [];
  const selected = courses.find((c) => c.id === courseId);
  const instructor =
    mode === "instructor" && session?.user.roles.includes("INSTRUCTOR");

  const keyword = courseQuery.trim().toLowerCase();
  const filteredCourses = courses.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesQuery =
      !keyword ||
      `${c.title} ${c.status} ${c.courseInstructors
        .map((i) => i.instructor.displayName)
        .join(" ")}`
        .toLowerCase()
        .includes(keyword);
    return matchesStatus && matchesQuery;
  });

  const statusCounts = {
    ALL: courses.length,
    DRAFT: courses.filter((c) => c.status === "DRAFT").length,
    PUBLISHED: courses.filter((c) => c.status === "PUBLISHED").length,
    HIDDEN: courses.filter((c) => c.status === "HIDDEN").length,
    ARCHIVED: courses.filter((c) => c.status === "ARCHIVED").length,
  };

  const iso = (value: FormDataEntryValue | null) =>
    typeof value === "string" && value
      ? new Date(value).toISOString()
      : undefined;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-7">
      <header
        className={`flex flex-wrap items-end justify-between gap-4 border-b pb-5 ${
          "border-brand-100"
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {isAdminMode ? "Grading setup" : "Course authoring"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isAdminMode
              ? "Inspect course structures and configure AI assessment models and prompts."
              : "Reopen draft or published courses, manage lessons and activities, publish assignments, and maintain rubrics."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {instructor && (
            <>
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-800"
              >
                {showCreateForm ? "Hide new course form" : "+ New draft course"}
              </button>
              <Link
                to="/teacher/reviews"
                className="rounded-lg border border-brand-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-800 shadow-2xs transition hover:bg-brand-50"
              >
                Open review queue
              </Link>
            </>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRefresh((v) => v + 1);
            }}
            className={`rounded-lg border bg-white px-3.5 py-2 text-xs font-semibold shadow-2xs transition disabled:opacity-50 ${
              "border-brand-200 text-brand-900 hover:bg-brand-50"
            }`}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {message}
        </div>
      )}

      {instructor && showCreateForm && (
        <ActionForm
          title="Create a course"
          description="New courses start in DRAFT status so you can build lessons and activities before publishing."
          variant="instructor"
          label="Create draft course"
          busy={busy}
          submit={(data) =>
            run<{ id?: string }>(
              "POST",
              "/courses",
              {
                title: data.get("title"),
                description: data.get("description"),
                completionPolicyJson: { mode: "ALL_REQUIRED_ITEMS" },
              },
              (created) => {
                if (created?.id) {
                  setCourseId(created.id);
                  setStatusFilter("ALL");
                  setShowCreateForm(false);
                }
              },
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Course title <span className="text-red-600">*</span>
              <input
                required
                name="title"
                maxLength={240}
                placeholder="e.g. IELTS Writing Task 2 Intensive"
                className={`${field} mt-1`}
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Description <span className="text-red-600">*</span>
              <textarea
                required
                rows={2}
                name="description"
                placeholder="Outline learning goals and practice focus..."
                className={`${field} mt-1`}
              />
            </label>
          </div>
        </ActionForm>
      )}

      <section className={`${panel} shadow-2xs`} aria-label="Course selector">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Course directory
            </h2>
            <p className="text-xs text-slate-500">
              Switch between courses or filter by{" "}
              <span className="font-semibold text-slate-700">DRAFT</span> status to reopen unfinished courses.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "DRAFT", label: "Drafts" },
                { key: "PUBLISHED", label: "Published" },
                { key: "HIDDEN", label: "Hidden" },
                { key: "ARCHIVED", label: "Archived" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === tab.key
                    ? "bg-brand-700 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label} ({statusCounts[tab.key]})
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search courses
            <input
              type="search"
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="Search by course title or instructor..."
              className={`${field} mt-1 font-normal`}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Quick select course
            <select
              className={`${field} mt-1 font-normal`}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Choose a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && !catalog ? (
          <p className="text-sm text-slate-500" role="status">
            Loading catalog...
          </p>
        ) : !filteredCourses.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-sm text-slate-600">
            No courses match this status or search query.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((c) => {
              const isSelected = c.id === courseId;
              const mine = c.courseInstructors.find(
                (i) => i.instructorId === session?.user.id,
              );
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseId(c.id)}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-600/15"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-bold text-slate-900">
                        {c.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          COURSE_STATUS_BADGES[c.status] ??
                          "border border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.chapters.length} sections · {c.learningItems.length}{" "}
                      items · {c.assignments.length} assignments
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
                    {instructor ? (
                      <span
                        className={`font-semibold ${
                          mine ? "text-brand-800" : "text-slate-500"
                        }`}
                      >
                        {mine
                          ? `Your role: ${mine.responsibility}`
                          : "Read-only (not assigned)"}
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {c.courseInstructors.length} instructor
                        {c.courseInstructors.length === 1 ? "" : "s"}
                      </span>
                    )}
                    <span
                      className={`font-semibold ${
                        isSelected
                          ? "text-brand-800"
                          : "text-slate-400"
                      }`}
                    >
                      {isSelected ? "Opened" : "Open →"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {(
          [
            {
              id: "curriculum",
              label: "Course & Curriculum",
            },
            {
              id: "assignments",
              label: `Assignments & Versions (${selected?.assignments.length ?? 0})`,
            },
            {
              id: "rubrics",
              label: isAdminMode
                ? `Rubrics & AI Config (${catalog?.gradingConfigs.length ?? 0})`
                : `Rubrics (${catalog?.rubrics.length ?? 0})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === tab.id
                ? "bg-brand-700 text-white shadow-2xs"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === "curriculum" || activeTab === "assignments") && !selected && (
        <div className={`${panel} text-sm text-slate-600`}>
          Select or create a course above to view or edit its curriculum and assignments.
        </div>
      )}

      {courses.map((course) => {
        const isCurrentCourse = course.id === courseId;
        const courseCanEdit =
          !!instructor &&
          course.courseInstructors.some(
            (item) => item.instructorId === session?.user.id,
          );
        // Writing/Speaking activities need a rubric; quizzes use their answer key.
        const practiceActivities = course.learningItems
          .filter((i) => i.practiceActivity)
          .flatMap((i) =>
            i.practiceActivity!.activityVersions.map((v) => ({
              id: v.id,
              label: `${i.title} v${v.versionNo} (${i.practiceActivity!.skillArea.toLowerCase()})`,
            })),
          );

        return (
          <div
            key={course.id}
            className={isCurrentCourse ? "space-y-6" : "hidden"}
          >
            <div className={activeTab === "curriculum" ? "space-y-6" : "hidden"}>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {course.title}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        COURSE_STATUS_BADGES[course.status] ??
                        "border border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {course.status}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        course.enrollmentOpen
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {course.enrollmentOpen
                        ? "Enrollment open"
                        : "Enrollment closed"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Instructors:{" "}
                    {course.courseInstructors
                      .map(
                        (i) =>
                          `${i.instructor.displayName} (${i.responsibility})`,
                      )
                      .join(", ") || "None assigned"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:hidden">
                <a
                  href={`#course-authoring-${course.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  Authoring form
                </a>
                <a
                  href={`#course-outline-${course.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  Content &amp; outline ({course.learningItems.length})
                </a>
              </div>

              <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
                <div
                  id={`course-authoring-${course.id}`}
                  className="min-w-0 space-y-4 scroll-mt-20 xl:col-span-7"
                >
                  {courseCanEdit ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
                        {(
                          [
                            { id: "settings", label: "Course settings" },
                            { id: "content", label: "Edit & hide content" },
                            { id: "prerequisites", label: "Prerequisites" },
                            { id: "section", label: "+ Section" },
                            { id: "lesson", label: "+ Text lesson" },
                            { id: "activity", label: "+ Writing activity" },
                            { id: "quiz", label: "+ Auto-graded quiz" },
                          ] as const
                        ).map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setCurriculumSubTab(sub.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              curriculumSubTab === sub.id
                                ? "bg-brand-700 text-white shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>

                      <div
                        className={
                          curriculumSubTab === "settings" ? "block" : "hidden"
                        }
                      >
                        <ActionForm
                          key={`${course.id}:${course.status}:${course.enrollmentOpen}`}
                          title="Course settings"
                          description="Change course status (e.g. DRAFT to PUBLISHED) and enrollment availability."
                          variant={variant}
                          label="Save course settings"
                          busy={busy}
                          submit={(data) =>
                            run("PATCH", `/courses/${course.id}`, {
                              title: data.get("title"),
                              description: data.get("description"),
                              status: data.get("status"),
                              enrollmentOpen: data.get("enrollmentOpen") === "on",
                            })
                          }
                        >
                          <label className="block text-sm font-medium text-slate-800">
                            Title
                            <input
                              required
                              name="title"
                              defaultValue={course.title}
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Description
                            <textarea
                              required
                              rows={3}
                              name="description"
                              defaultValue={course.description}
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Visibility
                            <select
                              name="status"
                              defaultValue={course.status}
                              className={`${field} mt-1`}
                            >
                              {["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].map(
                                (s) => (
                                  <option key={s}>{s}</option>
                                ),
                              )}
                            </select>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              name="enrollmentOpen"
                              defaultChecked={course.enrollmentOpen}
                              className="size-4 rounded border-slate-300 text-brand-700"
                            />
                            Open enrollment
                          </label>
                        </ActionForm>
                      </div>

                      <div
                        className={
                          curriculumSubTab === "section" ? "block" : "hidden"
                        }
                      >
                        <ActionForm
                          title="Add a section"
                          variant="instructor"
                          label="Add section"
                          busy={busy}
                          submit={(data) =>
                            run("POST", `/courses/${course.id}/sections`, {
                              title: data.get("title"),
                              position: Number(data.get("position")),
                            })
                          }
                        >
                          <label className="block text-sm font-medium text-slate-800">
                            Title
                            <input
                              required
                              name="title"
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Position
                            <input
                              required
                              type="number"
                              min={1}
                              name="position"
                              defaultValue={course.chapters.length + 1}
                              className={`${field} mt-1`}
                            />
                          </label>
                        </ActionForm>
                      </div>

                      <div
                        className={
                          curriculumSubTab === "lesson" ? "block" : "hidden"
                        }
                      >
                        <ActionForm
                          title="Add a text lesson"
                          variant="instructor"
                          label="Add text lesson"
                          busy={busy}
                          submit={(data) =>
                            run("POST", `/courses/${course.id}/lessons`, {
                              title: data.get("title"),
                              contentText: data.get("contentText"),
                              position: Number(data.get("position")),
                              ...(data.get("chapterId")
                                ? { sectionId: data.get("chapterId") }
                                : {}),
                            })
                          }
                        >
                          <label className="block text-sm font-medium text-slate-800">
                            Title
                            <input
                              required
                              name="title"
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Section
                            <select name="chapterId" className={`${field} mt-1`}>
                              <option value="">No section</option>
                              {course.chapters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Lesson content
                            <textarea
                              required
                              rows={4}
                              name="contentText"
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-800">
                            Position
                            <input
                              required
                              type="number"
                              min={1}
                              name="position"
                              defaultValue={course.learningItems.length + 1}
                              className={`${field} mt-1`}
                            />
                          </label>
                        </ActionForm>
                      </div>

                      <div
                        className={
                          curriculumSubTab === "activity" ? "block" : "hidden"
                        }
                      >
                        <ActionForm
                          title="Publish a Writing activity"
                          description="Create a Writing task prompt and link observable skills before attaching assignments."
                          variant="instructor"
                          label="Publish activity"
                          busy={busy}
                          submit={(data) =>
                            run("POST", `/courses/${course.id}/activities`, {
                              title: data.get("title"),
                              position: Number(data.get("position")),
                              skillArea: "WRITING",
                              promptText: data.get("prompt"),
                              instructions: data.get("instructions"),
                              difficulty: Number(data.get("difficulty")),
                              expectedMinutes: Number(data.get("minutes")),
                              skillIds: data.getAll("skills"),
                            })
                          }
                        >
                          <label className="block text-sm font-medium text-slate-800">
                            Title
                            <input
                              required
                              name="title"
                              className={`${field} mt-1`}
                            />
                          </label>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-800">
                              Task prompt
                              <textarea
                                required
                                rows={4}
                                name="prompt"
                                className={`${field} mt-1`}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-800">
                              Instructions
                              <textarea
                                required
                                rows={4}
                                name="instructions"
                                className={`${field} mt-1`}
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-800">
                            Target skills (select one or more)
                            <select
                              required
                              multiple
                              name="skills"
                              className={`${field} mt-1 min-h-32`}
                            >
                              {catalog?.skills
                                .filter((s) => s.skillArea === "WRITING")
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            <label className="text-sm font-medium text-slate-800">
                              Difficulty
                              <input
                                required
                                type="number"
                                min={1}
                                max={5}
                                name="difficulty"
                                defaultValue={2}
                                className={`${field} mt-1`}
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-800">
                              Minutes
                              <input
                                required
                                type="number"
                                min={1}
                                max={240}
                                name="minutes"
                                defaultValue={40}
                                className={`${field} mt-1`}
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-800">
                              Position
                              <input
                                required
                                type="number"
                                min={1}
                                name="position"
                                defaultValue={course.learningItems.length + 1}
                                className={`${field} mt-1`}
                              />
                            </label>
                          </div>
                        </ActionForm>
                      </div>

                      {curriculumSubTab === "content" && (
                        <ContentEditor course={course} busy={busy} run={run} />
                      )}
                      {curriculumSubTab === "prerequisites" && (
                        <PrerequisitesEditor
                          key={(course.prerequisites ?? [])
                            .map((row) => row.prerequisiteCourseId)
                            .join()}
                          course={course}
                          busy={busy}
                          run={run}
                        />
                      )}
                      {curriculumSubTab === "quiz" && (
                        <QuizBuilder
                          course={course}
                          busy={busy}
                          run={run}
                          skills={catalog?.skills ?? []}
                        />
                      )}
                    </>
                  ) : (
                    <section className={`${panel} shadow-2xs`}>
                      <h2 className="text-lg font-bold text-slate-900">
                        Editing access
                      </h2>
                      <p className="text-sm text-slate-600">
                        {isAdminMode
                          ? "Course curriculum editing is performed in the Instructor Workspace by assigned course owners or reviewers."
                          : "You are not currently assigned to this course. Ask an Administrator under Course Assignments to grant OWNER or REVIEWER access."}
                      </p>
                    </section>
                  )}
                </div>

                <section
                  id={`course-outline-${course.id}`}
                  className={`${panel} min-w-0 scroll-mt-20 shadow-2xs xl:col-span-5`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900">
                      Content and assignments
                    </h2>
                    <span className="text-xs text-slate-500">
                      {course.chapters.length} sections ·{" "}
                      {course.learningItems.length} items
                    </span>
                  </div>

                  {course.chapters.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sections
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {course.chapters.map((chapter) => (
                          <span
                            key={chapter.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {chapter.position}. {chapter.title}
                            {chapter.status !== "PUBLISHED" && " (hidden)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Learning items
                    </p>
                    {course.learningItems.length ? (
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/80">
                        {course.learningItems.map((i) => (
                          <li
                            key={i.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 font-medium text-slate-800">
                              {i.position}. {i.title}
                              {i.status !== "PUBLISHED" && (
                                <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
                                  ({i.status.toLowerCase()})
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              {i.kind}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No lessons or practice activities added yet.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className={activeTab === "assignments" ? "space-y-4" : "hidden"}>
              <div className="flex flex-wrap items-center gap-2 xl:hidden">
                <a
                  href={`#course-assignments-list-${course.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  Published assignments ({course.assignments.length})
                </a>
                <a
                  href={`#course-assignments-form-${course.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  Publish assignment / version
                </a>
              </div>

              <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section
                  id={`course-assignments-list-${course.id}`}
                  className={`${panel} min-w-0 scroll-mt-20 shadow-2xs`}
                >
                  <h2 className="text-lg font-bold text-slate-900">
                    Assignments in {course.title}
                  </h2>
                  {!course.assignments.length ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                      No assignments published for this course yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {course.assignments.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5"
                        >
                          <p className="text-sm font-bold text-slate-900">
                            {a.title}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {a.assignmentVersions.map((v) => (
                              <span
                                key={v.id}
                                className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800"
                              >
                                v{v.versionNo} · {v.mode}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div
                  id={`course-assignments-form-${course.id}`}
                  className="min-w-0 scroll-mt-20"
                >
                  {courseCanEdit ? (
                    <ActionForm
                      title="Publish an assignment or new version"
                      variant="instructor"
                      label="Publish assignment version"
                      busy={busy}
                      submit={(data) => {
                        const releaseMode = String(data.get("releaseMode"));
                        return run(
                          "POST",
                          `/courses/${course.id}/assignments${data.get("assignmentId") ? `/${data.get("assignmentId")}/versions` : ""}`,
                          {
                            title: data.get("title"),
                            activityVersionId: data.get("activityVersionId"),
                            ...(data.get("rubricId")
                              ? { rubricVersionId: data.get("rubricId") }
                              : {}),
                            mode: data.get("mode"),
                            maxAttempts: Number(data.get("attempts")),
                            maxRevisions: Number(data.get("revisions")),
                            opensAt: iso(data.get("opensAt")),
                            dueAt: iso(data.get("dueAt")),
                            allowLate: data.get("allowLate") === "on",
                            ...(data.get("seconds")
                              ? { timeLimitSeconds: Number(data.get("seconds")) }
                              : {}),
                            releasePolicyJson: {
                              releaseMode,
                              ...(releaseMode === "SCHEDULED"
                                ? { releaseAt: iso(data.get("releaseAt")) }
                                : {}),
                            },
                          },
                        );
                      }}
                    >
                      <label className="block text-sm font-medium text-slate-800">
                        Create or update
                        <select name="assignmentId" className={`${field} mt-1`}>
                          <option value="">New assignment</option>
                          {course.assignments.map((a) => (
                            <option key={a.id} value={a.id}>
                              New version of: {a.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Assignment title
                        <input
                          required
                          name="title"
                          className={`${field} mt-1`}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Activity version
                        <select
                          required
                          name="activityVersionId"
                          className={`${field} mt-1`}
                        >
                          <option value="">Choose activity</option>
                          {practiceActivities.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Rubric (Writing only; leave empty for quizzes)
                        <select
                          name="rubricId"
                          className={`${field} mt-1`}
                        >
                          <option value="">Choose rubric</option>
                          {catalog?.rubrics
                            .filter((r) => r.taskType.startsWith("WRITING"))
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.rubricCode} v{r.versionNo}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Assessment mode
                        <select name="mode" className={`${field} mt-1`}>
                          <option value="PRACTICE">
                            Practice: provisional AI feedback allowed by release policy
                          </option>
                          <option value="GRADED">
                            Graded: instructor confirmation required
                          </option>
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm font-medium text-slate-800">
                          Maximum attempts
                          <input
                            required
                            name="attempts"
                            type="number"
                            min={1}
                            defaultValue={5}
                            className={`${field} mt-1`}
                          />
                        </label>
                        <label className="text-sm font-medium text-slate-800">
                          Revisions per attempt
                          <input
                            required
                            name="revisions"
                            type="number"
                            min={1}
                            defaultValue={4}
                            className={`${field} mt-1`}
                          />
                        </label>
                        <label className="text-sm font-medium text-slate-800">
                          Opens at
                          <input
                            name="opensAt"
                            type="datetime-local"
                            className={`${field} mt-1`}
                          />
                        </label>
                        <label className="text-sm font-medium text-slate-800">
                          Due at
                          <input
                            name="dueAt"
                            type="datetime-local"
                            className={`${field} mt-1`}
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-800">
                        Time limit in seconds (blank for none)
                        <input
                          name="seconds"
                          type="number"
                          min={60}
                          className={`${field} mt-1`}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input type="checkbox" name="allowLate" />
                        Allow late submissions
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Publication policy
                        <select name="releaseMode" className={`${field} mt-1`}>
                          {[
                            "IMMEDIATE",
                            "MANUAL",
                            "AFTER_DUE_DATE",
                            "SCHEDULED",
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-800">
                        Scheduled publication time
                        <input
                          name="releaseAt"
                          type="datetime-local"
                          className={`${field} mt-1`}
                        />
                      </label>
                    </ActionForm>
                  ) : (
                    <section className={`${panel} shadow-2xs`}>
                      <h2 className="text-lg font-bold text-slate-900">
                        Assignment publishing
                      </h2>
                      <p className="text-sm text-slate-600">
                        {isAdminMode
                          ? "Instructors assigned to the course publish new assignment versions from their Instructor Workspace."
                          : "Select a course assigned to you to publish an assignment or new version."}
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className={activeTab === "rubrics" ? "space-y-6" : "hidden"}>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {instructor && template && (
              <ActionForm
                title="Publish a Task 2 rubric"
                variant="instructor"
                label="Publish rubric"
                busy={busy}
                submit={(data) =>
                  run("POST", "/grading/rubrics", {
                    rubricCode: data.get("code"),
                    versionNo: Number(data.get("version")),
                    title: data.get("title"),
                    taskType: "WRITING_TASK_2",
                    criteria: template.criteria.map((c) => ({
                      code: c.code,
                      name: c.name,
                      definition: data.get(c.code),
                    })),
                  })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Rubric code
                    <input
                      required
                      name="code"
                      maxLength={60}
                      className={`${field} mt-1`}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Version
                    <input
                      required
                      type="number"
                      min={1}
                      name="version"
                      defaultValue={1}
                      className={`${field} mt-1`}
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-800">
                  Title
                  <input required name="title" className={`${field} mt-1`} />
                </label>
                {template.criteria.map((c) => (
                  <label
                    key={c.code}
                    className="block text-sm font-medium text-slate-800"
                  >
                    {c.name}
                    <textarea
                      required
                      rows={2}
                      name={c.code}
                      defaultValue={c.definition}
                      className={`${field} mt-1`}
                    />
                  </label>
                ))}
              </ActionForm>
            )}

            {isAdminMode && session?.user.roles.includes("ADMIN") && template && (
              <ActionForm
                title="Configure AI assessment"
                description="API keys are configured on the server. Choose a model enabled in your provider account."
                variant="admin"
                label="Save AI configuration"
                busy={busy}
                submit={(data) =>
                  run("POST", "/grading/configs", {
                    rubricVersionId: data.get("rubricId"),
                    provider: data.get("provider"),
                    modelId: data.get("model"),
                    promptCode: data.get("promptCode"),
                    promptVersionNo: Number(data.get("version")),
                    instructions: data.get("instructions"),
                    outputSchemaJson: template.schema,
                    settingsJson: { max_output_tokens: 4000 },
                  })
                }
              >
                <label className="block text-sm font-medium text-slate-800">
                  Writing rubric
                  <select required name="rubricId" className={`${field} mt-1`}>
                    <option value="">Choose rubric</option>
                    {catalog?.rubrics
                      .filter((r) => r.taskType.startsWith("WRITING"))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.rubricCode} v{r.versionNo}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Provider
                    <select name="provider" className={`${field} mt-1`}>
                      <option value="OPENAI">OpenAI Responses</option>
                      <option value="JSON_HTTP">Custom JSON gateway</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Model ID
                    <input
                      required
                      name="model"
                      maxLength={120}
                      placeholder="e.g. gpt-4o-mini"
                      className={`${field} mt-1`}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Prompt code
                    <input
                      required
                      name="promptCode"
                      maxLength={60}
                      className={`${field} mt-1`}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Prompt version
                    <input
                      required
                      name="version"
                      type="number"
                      min={1}
                      defaultValue={1}
                      className={`${field} mt-1`}
                    />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-800">
                  Assessment instructions
                  <textarea
                    required
                    rows={6}
                    name="instructions"
                    defaultValue={template.instructions}
                    className={`${field} mt-1`}
                  />
                </label>
              </ActionForm>
            )}

            <div className="space-y-6">
              <section className={`${panel} shadow-2xs`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    Available rubrics
                  </h2>
                  <span className="text-xs text-slate-500">
                    {catalog?.rubrics.length ?? 0} versions
                  </span>
                </div>
                {catalog?.rubrics.length ? (
                  <div className="space-y-2">
                    {catalog.rubrics.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-slate-900">
                          {r.rubricCode} · v{r.versionNo}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {r.taskType}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No rubrics yet.</p>
                )}
              </section>

              <section className={`${panel} shadow-2xs`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    Assessment configurations
                  </h2>
                  <span className="text-xs text-slate-500">
                    {catalog?.gradingConfigs.length ?? 0} active
                  </span>
                </div>
                {catalog?.gradingConfigs.length ? (
                  <div className="space-y-2">
                    {catalog.gradingConfigs.map((c) => {
                      const rubric = catalog.rubrics.find(
                        (r) => r.id === c.rubricVersionId,
                      );
                      return (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {c.provider} · {c.modelId}
                            </p>
                            <p className="text-xs text-slate-500">
                              Rubric:{" "}
                              {rubric
                                ? `${rubric.rubricCode} v${rubric.versionNo}`
                                : "Unknown rubric"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No AI grading configurations saved yet.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
    </main>
  );
}
