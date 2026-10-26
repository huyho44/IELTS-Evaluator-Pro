import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getCourseDetail,
    type CourseDetail,
    type CourseLearningItem,
} from "./courseDetailApi";
import CourseEnrollmentPanel from "./CourseEnrollmentPanel";

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
            {items.map((item) => (
                <li key={item.id} className="space-y-2 px-3 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 break-words text-sm font-medium text-slate-800">
                            {courseId &&
                                (item.kind === "LESSON" || item.kind === "PRACTICE") ? (
                                <Link
                                    to={
                                        `/courses/${encodeURIComponent(courseId)}/` +
                                        (item.kind === "LESSON" ? "lessons" : "practices") +
                                        `/${encodeURIComponent(item.id)}`
                                    }
                                    className="text-blue-700 hover:underline"
                                >
                                    {item.title}
                                </Link>
                            ) : (
                                item.title
                            )}
                        </div>

                        <span
                            className={
                                "shrink-0 rounded-md px-2 py-1 text-xs font-semibold " +
                                (item.kind === "LESSON"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-800")
                            }
                        >
                            {item.kind === "LESSON" ? "Lesson" : "Practice"}
                        </span>
                    </div>

                    {item.lesson?.summary && (
                        <p className="text-sm leading-6 text-slate-500">
                            {item.lesson.summary}
                        </p>
                    )}

                    {item.practiceActivity && (
                        <p className="text-xs text-slate-500">
                            Skill:{" "}
                            <span className="capitalize">
                                {item.practiceActivity.skillArea.toLowerCase()}
                            </span>
                        </p>
                    )}
                </li>
            ))}
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
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

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

                const data = await getCourseDetail(courseId, controller.signal);

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
    }, [courseId, reloadKey]);

    const sections = [...(course?.sections ?? [])].sort(
        (a, b) => a.position - b.position,
    );

    const items = [...(course?.learningItems ?? [])].sort(
        (a, b) => a.position - b.position,
    );

    const sectionIds = new Set(sections.map((section) => section.id));

    const otherItems = items.filter(
        (item) => item.sectionId === null || !sectionIds.has(item.sectionId),
    );

    const lessonCount = items.filter((item) => item.kind === "LESSON").length;
    const practiceCount = items.filter((item) => item.kind === "PRACTICE").length;

    return (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
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
                    <h1 className="break-words text-2xl font-bold text-slate-900">
                        {course.title}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            Course overview
                        </span>

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

                    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
                        <section
                            aria-labelledby="course-overview-heading"
                            className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <h2
                                id="course-overview-heading"
                                className="text-lg font-semibold"
                            >
                                About this course
                            </h2>

                            <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">
                                {course.description || "No description available yet."}
                            </p>

                            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                                {[
                                    { label: "Chapters", value: sections.length },
                                    { label: "Published lessons", value: lessonCount },
                                    { label: "Practice activities", value: practiceCount },
                                ].map((fact) => (
                                    <div
                                        key={fact.label}
                                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                                    >
                                        <dt className="text-xs font-medium leading-5 text-slate-500">
                                            {fact.label}
                                        </dt>
                                        <dd className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
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
                                className="text-lg font-semibold"
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
                                            className="group overflow-hidden rounded-xl border border-slate-200"
                                        >
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 p-4 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                                                <span className="min-w-0">
                                                    <span className="block break-words text-sm font-semibold leading-6">
                                                        {index + 1}. {section.title}
                                                    </span>

                                                    <span className="mt-1 block text-xs text-slate-500">
                                                        {sectionItems.length}{" "}
                                                        {sectionItems.length === 1 ? "learning item" : "learning items"}
                                                    </span>
                                                </span>

                                                <span
                                                    aria-hidden="true"
                                                    className="mr-1 h-2 w-2 shrink-0 rotate-45 border-b-2 border-r-2 border-slate-400 transition-transform duration-200 group-open:rotate-[225deg] motion-reduce:transition-none"
                                                />
                                            </summary>

                                            <div className="border-t border-slate-200">
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
                                ← Course Catalog
                            </Link>
                        </aside>
                    </div>
                </>
            ) : null}
        </main>
    );
}