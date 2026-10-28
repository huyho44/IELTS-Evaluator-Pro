import CompletionBadge from "./CompletionBadge";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getCourseDetail,
    type CourseDetail,
} from "./courseDetailApi";
import {
    completeLesson,
    getLesson,
    LessonApiError,
    type LessonDetail,
    type LessonMaterial,
} from "./lessonsApi";

type LessonPageProps = {
    accessToken?: string | null;
    onSessionExpired?: () => void;
};

type LessonContentProps = {
    courseId: string;
    lessonId: string;
    accessToken: string | null;
    onSessionExpired?: () => void;
};

function MaterialContent({ material }: { material: LessonMaterial }) {
    if (material.kind === "TEXT") {
        return (
            <div className="max-w-3xl whitespace-pre-wrap break-words text-base leading-8 text-slate-700">
                {material.contentText || "No content available."}
            </div>
        );
    }

    if (material.kind === "URL" && material.externalUrl) {
        let safeUrl: string | null = null;

        try {
            const url = new URL(material.externalUrl);

            if (url.protocol === "https:" || url.protocol === "http:") {
                safeUrl = url.href;
            }
        } catch {
            // Invalid links are displayed as unavailable.
        }

        return safeUrl ? (
            <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block break-all font-semibold text-blue-600 hover:underline"
            >
                Open learning resource ↗
            </a>
        ) : (
            <p className="text-sm text-slate-500">
                This resource link is unavailable.
            </p>
        );
    }

    return (
        <p className="text-sm text-slate-500">
            This attachment is currently unavailable.
        </p>
    );
}

function LessonContent({
    courseId,
    lessonId,
    accessToken,
    onSessionExpired,
}: LessonContentProps) {
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [lesson, setLesson] = useState<LessonDetail | null>(null);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [completionSaved, setCompletionSaved] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [completionError, setCompletionError] = useState("");
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!accessToken) {
            return;
        }

        const token = accessToken;
        const controller = new AbortController();

        async function loadLesson() {
            setLoading(true);
            setError("");

            try {
                const [courseData, lessonData] = await Promise.all([
                    getCourseDetail(courseId, controller.signal, token),
                    getLesson(courseId, lessonId, token, controller.signal),
                ]);

                if (!controller.signal.aborted) {
                    setCourse(courseData);
                    setLesson(lessonData);
                    setCompletionSaved(lessonData.progress.status === "COMPLETED");
                }
            } catch (cause) {
                if (!controller.signal.aborted) {
                    if (cause instanceof LessonApiError && cause.status === 401) {
                        onSessionExpired?.();
                    }

                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Unable to load this lesson.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadLesson();

        return () => controller.abort();
    }, [courseId, lessonId, accessToken, reloadKey, onSessionExpired]);

    async function handleComplete() {
        if (!accessToken || saving || completionSaved || !lesson) {
            return;
        }

        setSaving(true);
        setCompletionError("");

        try {
            const progress = await completeLesson(courseId, lessonId, accessToken);

            if (mounted.current) {
                setCompletionSaved(true);
                setJustSaved(true);
                setCourse(previous => previous ? { ...previous, learningItems: previous.learningItems.map(item => item.id === lessonId ? { ...item, progress } : item) } : previous);
            }
        } catch (cause) {
            if (mounted.current) {
                if (cause instanceof LessonApiError && cause.status === 401) {
                    onSessionExpired?.();
                }

                setCompletionError(
                    cause instanceof Error
                        ? cause.message
                        : "Unable to save lesson completion.",
                );
            }
        } finally {
            if (mounted.current) {
                setSaving(false);
            }
        }
    }

    const lessons = [...(course?.learningItems ?? [])]
        .filter((item) => item.kind === "LESSON")
        .sort((a, b) => {
            const sections = [...(course?.sections ?? [])].sort(
                (first, second) => first.position - second.position,
            );

            function sectionOrder(sectionId: string | null) {
                const index = sections.findIndex(
                    (section) => section.id === sectionId,
                );

                return index === -1 ? sections.length : index;
            }

            return (
                sectionOrder(a.sectionId) - sectionOrder(b.sectionId) ||
                a.position - b.position
            );
        });

    const currentIndex = lessons.findIndex((item) => item.id === lessonId);
    const previousLesson =
        currentIndex > 0 ? lessons[currentIndex - 1] : null;
    const nextLesson =
        currentIndex >= 0 ? lessons[currentIndex + 1] : null;

    return (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <Link
                to={`/courses/${courseId}`}
                className="text-sm font-semibold text-blue-600 hover:underline"
            >
                ← Back to course overview
            </Link>

            {!accessToken ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-8">
                    <h1 className="text-xl font-bold">Sign in to access this lesson</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        Lesson content is available according to your course enrollment.
                    </p>
                </section>
            ) : loading ? (
                <p
                    role="status"
                    className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-slate-500"
                >
                    Loading lesson...
                </p>
            ) : error ? (
                <section className="mt-6 rounded-xl border border-red-200 bg-white p-8">
                    <h1 className="text-xl font-bold">Unable to open this lesson</h1>
                    <p role="alert" className="mt-3 text-sm text-red-700">
                        {error}
                    </p>
                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Try again
                    </button>
                </section>
            ) : lesson && course ? (
                <>
                    <h1 className="mt-5 break-words text-2xl font-bold">
                        {course.title}
                    </h1>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            Lesson workspace
                        </span>
                        <span className="text-sm leading-6 text-slate-500">
                            By {course.creator.displayName}
                        </span>
                    </div>

                    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
                        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="break-words text-xl font-bold">
                                {lesson.learningItem.title}
                            </h2>

                            {lesson.summary && (
                                <p className="mt-3 text-sm leading-7 text-slate-500">
                                    {lesson.summary}
                                </p>
                            )}

                            <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
                                {lesson.lessonMaterials.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        No learning materials available yet.
                                    </p>
                                ) : (
                                    [...lesson.lessonMaterials]
                                        .sort((a, b) => a.position - b.position)
                                        .map((material) => (
                                            <MaterialContent
                                                key={material.id}
                                                material={material}
                                            />
                                        ))
                                )}
                            </div>

                            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
                                {completionSaved ? <CompletionBadge /> : <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleComplete()}
                                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : "Mark complete"}
                                </button>}

                                {justSaved && (
                                    <p role="status" className="order-last basis-full text-sm text-emerald-700">
                                        Your lesson completion has been saved.
                                    </p>
                                )}

                                {completionError && (
                                    <p role="alert" className="order-last basis-full text-sm text-red-700">
                                        {completionError}
                                    </p>
                                )}

                                <nav
                                    aria-label="Lesson navigation"
                                    className="flex flex-wrap gap-3"
                                >
                                    {previousLesson && (
                                        <Link
                                            to={`/courses/${courseId}/lessons/${previousLesson.id}`}
                                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            ← Previous lesson
                                        </Link>
                                    )}

                                    {nextLesson && (
                                        <Link
                                            to={`/courses/${courseId}/lessons/${nextLesson.id}`}
                                            className="ml-auto rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                            Next lesson →
                                        </Link>
                                    )}
                                </nav>
                            </div>
                        </section>

                        <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold">Course lessons</h2>

                            <p className="mt-2 text-sm text-slate-500">
                                {lessons.length} published{" "}
                                {lessons.length === 1 ? "lesson" : "lessons"}
                            </p>

                            <nav aria-label="Course lessons" className="mt-4 space-y-2">
                                {lessons.map((item, index) => (
                                    <div key={item.id} className="space-y-2">
                                    <Link
                                        to={`/courses/${courseId}/lessons/${item.id}`}
                                        aria-current={item.id === lessonId ? "page" : undefined}
                                        className={
                                            "block break-words rounded-lg border p-3 text-sm leading-6 no-underline " +
                                            (item.id === lessonId
                                                ? "border-blue-200 bg-blue-50 font-semibold text-blue-700"
                                                : "border-slate-200 text-slate-600 hover:bg-slate-50")
                                        }
                                    >
                                        <span className="block">{index + 1}. {item.title}</span>
                                    {item.progress?.status === "COMPLETED" && <span className="mt-2 block"><CompletionBadge /></span>}
                                    </Link>
                                    </div>
                                ))}
                            </nav>
                        </aside>
                    </div>
                </>
            ) : null}
        </main>
    );
}

export default function LessonPage({
    accessToken = null,
    onSessionExpired,
}: LessonPageProps) {
    const { courseId, lessonId } = useParams();

    if (!courseId || !lessonId) {
        return <p className="p-8">The lesson link is invalid.</p>;
    }

    return (
        <LessonContent
            key={JSON.stringify([courseId, lessonId, accessToken])}
            courseId={courseId}
            lessonId={lessonId}
            accessToken={accessToken}
            onSessionExpired={onSessionExpired}
        />
    );
}
