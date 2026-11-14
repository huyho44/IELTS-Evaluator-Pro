import { Link } from "react-router-dom";
import readingDemoCover from "../../assets/course-covers/reading-demo-cover.svg";
import writingDemoCover from "../../assets/course-covers/writing-demo-cover.svg";
import generalCourseCover from "../../assets/course-covers/general-course-cover.svg";
import type { Course } from "./course";
import type { EnrollmentStatus } from "./enrollmentsApi";

const DEMO_COURSE_COVERS: Record<string, string> = {
  "26102026-0000-4000-8000-000000000001": readingDemoCover,
  "30102026-0000-4000-8000-000000000001": writingDemoCover,
};

const DEMO_TITLE_COVERS: Record<string, string> = {
  "[Demo] IELTS Reading Foundations": readingDemoCover,
  "[Demo] Writing Clinic: evidence to transfer": writingDemoCover,
};

function resolveCourseCover(course: Course): string {
  return (
    DEMO_COURSE_COVERS[course.id] ??
    DEMO_TITLE_COVERS[course.title] ??
    generalCourseCover
  );
}

type CourseCardProps = {
  course: Course;
  enrollmentStatus?: EnrollmentStatus | null;
};

export default function CourseCard({
  course,
  enrollmentStatus = null,
}: CourseCardProps) {
  const coverSrc = resolveCourseCover(course);
  const isEnrolled = enrollmentStatus === "ACTIVE";
  const isCompleted = enrollmentStatus === "COMPLETED";

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-40 overflow-hidden border-b border-slate-100 bg-slate-50">
        <img
          src={coverSrc}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          {isEnrolled && (
            <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#1e40af]">
              Enrolled
            </span>
          )}
          {isCompleted && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Completed
            </span>
          )}
          {enrollmentStatus === "LEFT" && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Previously enrolled
            </span>
          )}
          {course.category !== null && (
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              {course.category}
            </span>
          )}
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-semibold " +
              (course.enrollmentOpen
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600")
            }
          >
            {course.enrollmentOpen ? "Open for enrollment" : "Enrollment closed"}
          </span>
        </div>

        <h2 className="break-words text-lg font-bold leading-snug text-[#0f172a]">
          {course.title}
        </h2>

        <p className="line-clamp-3 text-sm leading-6 text-[#64748b]">
          {course.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b]">
          <span>By {course.instructorName}</span>
          {course.learningItemCount !== undefined && (
            <span>
              · {course.learningItemCount}{" "}
              {course.learningItemCount === 1
                ? "learning item"
                : "learning items"}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          <Link
            to={`/courses/${course.id}`}
            className={
              isEnrolled
                ? "block w-full rounded-[10px] bg-[#2563eb] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                : isCompleted
                  ? "block w-full rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                  : "block w-full rounded-[10px] border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
            }
          >
            {isEnrolled
              ? "Open course"
              : isCompleted
                ? "Review course"
                : "View course"}
          </Link>
        </div>
      </div>
    </article>
  );
}
