import { useEffect, useState } from "react";
import { useSession } from "../auth/session";
import CourseCard from "./CourseCard";
import type { Course } from "./course";
import { getCourses } from "./coursesApi";
import {
  getMyEnrollments,
  type EnrollmentStatus,
} from "./enrollmentsApi";
import { catalogPage } from "./catalogPagination";

export default function CourseCatalogPage({
  loadCourses = getCourses,
}: {
  loadCourses?: typeof getCourses;
}) {
  const { session, requestToken } = useSession();
  const userId = session?.user.id ?? null;
  const isLearner = Boolean(session?.user.roles.includes("LEARNER"));

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [enrollmentsState, setEnrollmentsState] = useState<{
    userId: string;
    statuses: Record<string, EnrollmentStatus>;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadCourses(controller.signal);

        if (!controller.signal.aborted) {
          setCourses(result);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load courses.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => controller.abort();
  }, [reloadKey, loadCourses]);

  useEffect(() => {
    if (!requestToken || !userId || !isLearner) {
      return;
    }

    const controller = new AbortController();
    const token = requestToken;
    const expectedUserId = userId;

    async function loadEnrollments() {
      try {
        const mine = await getMyEnrollments(token, controller.signal);
        if (controller.signal.aborted) return;
        const statuses: Record<string, EnrollmentStatus> = {};
        for (const item of mine) {
          statuses[item.courseId] = item.status;
        }
        setEnrollmentsState({ userId: expectedUserId, statuses });
      } catch {
        // Enrollment badges are optional on the catalog; keep catalog usable on failure.
        if (!controller.signal.aborted) {
          setEnrollmentsState(null);
        }
      }
    }

    void loadEnrollments();
    return () => controller.abort();
  }, [requestToken, userId, isLearner, reloadKey]);

  const enrollmentStatuses =
    userId && isLearner && enrollmentsState?.userId === userId
      ? enrollmentsState.statuses
      : {};

  const { filteredCourses, totalPages, currentPage, visibleCourses } =
    catalogPage(courses, search, openOnly, page);

  function resetFilters() {
    setSearch("");
    setOpenOnly(false);
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0f172a] sm:text-3xl">
          Explore Preparation Courses
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#64748b]">
          Choose focused IELTS lessons and continue your enrolled courses.
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-lg">
        <label htmlFor="course-search" className="sr-only">
          Search courses
        </label>

        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>

          <input
            id="course-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by keyword or instructor..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter courses"
        className="mt-4 flex flex-wrap justify-center gap-2"
      >
        {[false, true].map((onlyOpen) => (
          <button
            key={String(onlyOpen)}
            type="button"
            aria-pressed={openOnly === onlyOpen}
            onClick={() => {
              setOpenOnly(onlyOpen);
              setPage(1);
            }}
            className={
              "rounded-full px-4 py-2 text-xs font-semibold " +
              (openOnly === onlyOpen
                ? "bg-[#2563eb] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200")
            }
          >
            {onlyOpen ? "Open for enrollment" : "All Courses"}
          </button>
        ))}
      </div>

      <section
        aria-label="Available courses"
        aria-busy={loading}
        className="mt-6"
      >
        {loading ? (
          <div
            role="status"
            className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-600"
          >
            Loading courses...
          </div>
        ) : error !== null ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-white p-8 text-center"
          >
            <h2 className="font-semibold text-red-700">
              Could not load courses
            </h2>

            <p className="mt-2 text-sm text-slate-600">{error}</p>

            <button
              type="button"
              onClick={() => setReloadKey((previous) => previous + 1)}
              className="mt-4 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <p role="status" className="mb-4 text-xs text-[#64748b]">
              {filteredCourses.length}{" "}
              {filteredCourses.length === 1 ? "course" : "courses"} found
            </p>

            {visibleCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visibleCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrollmentStatus={enrollmentStatuses[course.id] ?? null}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <h2 className="text-lg font-semibold">
                  {courses.length === 0
                    ? "No courses available yet"
                    : "No courses found"}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {courses.length === 0
                    ? "Please check back later."
                    : "Try a different keyword or course filter."}
                </p>

                {courses.length > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <nav
                aria-label="Course pagination"
                className="mt-8 flex flex-wrap justify-center gap-2"
              >
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                >
                  ← Previous
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-current={
                      currentPage === pageNumber ? "page" : undefined
                    }
                    onClick={() => setPage(pageNumber)}
                    className={
                      "rounded-lg px-3 py-2 text-sm " +
                      (currentPage === pageNumber
                        ? "bg-[#2563eb] text-white"
                        : "border border-slate-300 bg-white")
                    }
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}
