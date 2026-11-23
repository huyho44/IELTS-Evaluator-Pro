import { useState } from "react";
import ActionForm from "../management/ActionForm";
import {
  field,
  managementRequest,
  panel,
  type Catalog,
  type UserRow,
} from "../management/managementApi";
import AdminSection from "./AdminSection";
import { useAdminSection } from "./useAdminSection";

const loadAssignments = async () => {
  const [catalog, users] = await Promise.all([
    managementRequest<Catalog>("GET", "/authoring/catalog"),
    managementRequest<UserRow[]>("GET", "/admin/users"),
  ]);
  return {
    courses: catalog.courses,
    instructors: users.filter(
      (user) => user.status === "ACTIVE" && user.roles.includes("INSTRUCTOR"),
    ),
  };
};

const COURSE_STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  DRAFT: "border border-amber-200 bg-amber-50 text-amber-800",
  HIDDEN: "border border-slate-200 bg-slate-100 text-slate-700",
  ARCHIVED: "border border-rose-200 bg-rose-50 text-rose-800",
};

const RESPONSIBILITY_BADGE: Record<
  string,
  { badge: string; label: string; description: string }
> = {
  OWNER: {
    badge: "border border-violet-200 bg-violet-100 text-violet-900",
    label: "OWNER",
    description: "Full course authoring, rubrics & review access",
  },
  REVIEWER: {
    badge: "border border-teal-200 bg-teal-50 text-teal-800",
    label: "REVIEWER",
    description: "Grading & review queue access",
  },
};

export default function CourseAssignmentsPage() {
  const section = useAdminSection(loadAssignments);
  const [courseId, setCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [focusSelected, setFocusSelected] = useState(false);

  const courses = section.data?.courses ?? [];
  const instructors = section.data?.instructors ?? [];
  const selected = courses.find((course) => course.id === courseId);
  const emailByInstructorId = new Map(
    instructors.map((inst) => [inst.id, inst.email]),
  );

  const keyword = courseQuery.trim().toLowerCase();
  const matchingCourses = courses.filter(
    (course) =>
      !keyword ||
      `${course.title} ${course.status} ${course.courseInstructors
        .map((i) => i.instructor.displayName)
        .join(" ")}`
        .toLowerCase()
        .includes(keyword),
  );
  const visible =
    focusSelected && selected ? [selected] : matchingCourses;

  return (
    <AdminSection
      title="Course assignments"
      description="Assign active instructors as course OWNER or REVIEWER and record a reason."
      {...section}
    >
      <div className="mb-4 flex flex-wrap gap-2 xl:hidden">
        <a
          href="#assigned-courses-list"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
        >
          Courses &amp; instructors ({courses.length})
        </a>
        <a
          href="#assign-instructor-panel"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900 shadow-2xs"
        >
          Assign instructor form &darr;
        </a>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section
          id="assigned-courses-list"
          className={`${panel} min-w-0 scroll-mt-20 shadow-2xs`}
          aria-labelledby="assigned-instructors"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2
                id="assigned-instructors"
                className="text-base font-bold text-slate-900"
              >
                Courses &amp; assigned instructors
              </h2>
              <p className="text-xs text-slate-500">
                Click a course to target it in the assignment panel.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected && (
                <button
                  type="button"
                  onClick={() => setFocusSelected((prev) => !prev)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    focusSelected
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100"
                  }`}
                >
                  {focusSelected ? "Show all courses" : "Focused on selected"}
                </button>
              )}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {courses.length} courses
              </span>
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filter courses
            <input
              type="search"
              value={courseQuery}
              onChange={(event) => {
                setCourseQuery(event.target.value);
                setFocusSelected(false);
              }}
              placeholder="Search by course title, status, or assigned instructor..."
              className={`${field} mt-1 font-normal`}
            />
          </label>

          {section.data && !visible.length && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-600">
              {courses.length
                ? "No courses match your search filter."
                : "No courses available."}
            </p>
          )}

          <div className="space-y-3">
            {visible.map((course) => {
              const isSelected = course.id === courseId;
              return (
                <article
                  key={course.id}
                  className={`rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-600/15"
                      : "border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {course.title}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            COURSE_STATUS_BADGE[course.status] ??
                            "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {course.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {course.courseInstructors.length} instructor
                        {course.courseInstructors.length === 1 ? "" : "s"} assigned
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCourseId(isSelected ? "" : course.id)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? "bg-brand-700 text-white"
                          : "border border-brand-200 bg-white text-brand-900 hover:bg-brand-50"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select course"}
                    </button>
                  </div>

                  {course.courseInstructors.length ? (
                    <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {course.courseInstructors.map((item) => {
                        const roleInfo =
                          RESPONSIBILITY_BADGE[item.responsibility] ?? {
                            badge: "border border-slate-200 bg-slate-100 text-slate-700",
                            label: item.responsibility,
                            description: "",
                          };
                        const email = emailByInstructorId.get(item.instructorId);
                        return (
                          <li
                            key={item.instructorId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                aria-hidden="true"
                                className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                              >
                                {item.instructor.displayName
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <span className="block truncate font-semibold text-slate-900">
                                  {item.instructor.displayName}
                                </span>
                                {email && (
                                  <span className="block truncate text-xs text-slate-500">
                                    {email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleInfo.badge}`}
                            >
                              {roleInfo.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      No instructors assigned yet. Select this course to assign an OWNER or REVIEWER.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <div id="assign-instructor-panel" className="min-w-0 scroll-mt-20 xl:sticky xl:top-20">
          <ActionForm
            title="Assign an instructor"
            description="Only active users with the INSTRUCTOR role appear in the instructor list."
            variant="admin"
            label="Save assignment"
            busy={section.busy || !courses.length || !instructors.length}
            submitDisabled={!courseId}
            submit={(data) =>
              section.run("POST", `/courses/${courseId}/instructors`, {
                instructorId: data.get("instructorId"),
                responsibility: data.get("responsibility"),
                reason: data.get("reason"),
              })
            }
          >
            {selected ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                  Selected course
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-950">
                  {selected.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      COURSE_STATUS_BADGE[selected.status] ??
                      "border border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selected.status}
                  </span>
                  <span className="text-xs text-slate-600">
                    {selected.courseInstructors.length} assigned
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/30 p-3 text-xs text-slate-600">
                Select a course below or click any course card on the left before assigning.
              </div>
            )}

            <label className="block text-sm font-medium text-slate-800">
              Course <span className="text-red-600">*</span>
              <select
                required
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                className={`${field} mt-1.5`}
              >
                <option value="">Choose course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.status})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Active instructor <span className="text-red-600">*</span>
              <select required name="instructorId" className={`${field} mt-1.5`}>
                <option value="">Choose instructor</option>
                {instructors.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} · {user.email}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {instructors.length} active instructor
                {instructors.length === 1 ? "" : "s"} eligible.
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Responsibility
              <select name="responsibility" className={`${field} mt-1.5`}>
                <option value="REVIEWER">
                  REVIEWER — Claim &amp; grade in review queue
                </option>
                <option value="OWNER">
                  OWNER — Full course authoring &amp; grading
                </option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-2 text-brand-950">
                <span className="font-bold">OWNER</span>
                <p className="mt-0.5 text-slate-600">
                  Manage syllabus, rubrics &amp; grade reviews.
                </p>
              </div>
              <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-2 text-teal-950">
                <span className="font-bold">REVIEWER</span>
                <p className="mt-0.5 text-slate-600">
                  Claim, confirm &amp; publish assigned reviews.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-800">
              Reason <span className="text-red-600">*</span>
              <textarea
                required
                name="reason"
                rows={3}
                placeholder="Explain course assignment or responsibility update..."
                className={`${field} mt-1.5`}
              />
            </label>
          </ActionForm>
        </div>
      </div>
    </AdminSection>
  );
}
