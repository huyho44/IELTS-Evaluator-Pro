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

export default function CourseAssignmentsPage() {
  const section = useAdminSection(loadAssignments);
  const [courseId, setCourseId] = useState("");
  const courses = section.data?.courses ?? [];
  const instructors = section.data?.instructors ?? [];
  const selected = courses.find((course) => course.id === courseId);
  const visible = selected ? [selected] : courses;

  return (
    <AdminSection
      title="Course assignments"
      description="Assign active instructors and manage their responsibilities for each course."
      {...section}
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className={panel} aria-labelledby="assigned-instructors">
          <h2 id="assigned-instructors" className="font-bold text-violet-950">
            Assigned instructors
          </h2>
          {section.data && !visible.length && (
            <p className="text-sm text-slate-600">No courses available.</p>
          )}
          {visible.map((course) => (
            <article key={course.id} className="border-t border-slate-100 pt-3">
              <h3 className="text-sm font-semibold">{course.title}</h3>
              {course.courseInstructors.length ? (
                <ul className="mt-2 space-y-2">
                  {course.courseInstructors.map((item) => (
                    <li
                      key={item.instructorId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm"
                    >
                      <span>{item.instructor.displayName}</span>
                      <span className="text-xs font-semibold text-violet-800">
                        {item.responsibility}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  No instructors assigned.
                </p>
              )}
            </article>
          ))}
        </section>
        <ActionForm
          title="Assign an instructor"
          label="Save assignment"
          busy={section.busy || !courses.length || !instructors.length}
          submit={(data) =>
            section.run("POST", `/courses/${courseId}/instructors`, {
              instructorId: data.get("instructorId"),
              responsibility: data.get("responsibility"),
              reason: data.get("reason"),
            })
          }
        >
          <label className="block text-sm">
            Course
            <select
              required
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className={field}
            >
              <option value="">Choose course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Instructor
            <select required name="instructorId" className={field}>
              <option value="">Choose instructor</option>
              {instructors.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Responsibility
            <select name="responsibility" className={field}>
              <option>REVIEWER</option>
              <option>OWNER</option>
            </select>
          </label>
          <label className="block text-sm">
            Reason <textarea required name="reason" className={field} />
          </label>
        </ActionForm>
      </div>
    </AdminSection>
  );
}
