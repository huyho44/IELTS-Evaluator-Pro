import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    getPracticeAssignments,
    PracticeApiError,
    type PracticeAssignment,
    startPracticeAttempt,
} from "./practiceApi";

type PracticePageProps = {
    accessToken?: string | null;
    onSessionExpired?: () => void;
};

type PracticeContentProps = {
    courseId: string;
    activityId: string;
    accessToken: string | null;
    onSessionExpired?: () => void;
};

function PracticeContent({
    courseId,
    activityId,
    accessToken,
    onSessionExpired,
}: PracticeContentProps) {
    const navigate = useNavigate();
    const [startingId, setStartingId] = useState<string | null>(null);
    const [startError, setStartError] = useState("");

    const [assignments, setAssignments] = useState<PracticeAssignment[]>([]);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!accessToken) {
            return;
        }

        const token = accessToken;
        const controller = new AbortController();

        async function loadAssignments() {
            setLoading(true);
            setError("");

            try {
                const data = await getPracticeAssignments(
                    courseId,
                    activityId,
                    token,
                    controller.signal,
                );

                if (!controller.signal.aborted) {
                    setAssignments(data);
                }
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Unable to load practice assignments.",
                    );

                    if (
                        cause instanceof PracticeApiError &&
                        cause.status === 401
                    ) {
                        onSessionExpired?.();
                    }
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadAssignments();

        return () => controller.abort();
    }, [
        courseId,
        activityId,
        accessToken,
        onSessionExpired,
        reloadKey,
    ]);

    async function handleStart(assignmentId: string) {
        if (!accessToken || startingId) return;

        setStartingId(assignmentId);
        setStartError("");

        try {
            const attempt = await startPracticeAttempt(assignmentId, accessToken);
            navigate(`/attempts/${encodeURIComponent(attempt.id)}`);
        } catch (cause) {
            setStartError(
                cause instanceof Error ? cause.message : "Unable to start practice.",
            );

            if (cause instanceof PracticeApiError && cause.status === 401) {
                onSessionExpired?.();
            }
        } finally {
            setStartingId(null);
        }
    }

    return (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <Link
                to={`/courses/${encodeURIComponent(courseId)}`}
                className="text-sm font-semibold text-blue-600 hover:underline"
            >
                ← Course overview
            </Link>

            <Link
                to="/practice-history"
                className="mt-3 block w-fit text-sm font-semibold text-blue-600 hover:underline"
            >
                My practice attempts
            </Link>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    Practice
                </span>

                <h1 className="mt-4 text-2xl font-bold text-slate-900">
                    Practice assignments
                </h1>

                {!accessToken ? (
                    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
                        <h2 className="font-semibold text-slate-900">
                            Sign in to access this practice
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Practice assignments are available according to your course
                            enrollment.
                        </p>
                    </div>
                ) : loading ? (
                    <p role="status" className="mt-6 text-sm text-slate-500">
                        Loading assignments...
                    </p>
                ) : error ? (
                    <div className="mt-6">
                        <p role="alert" className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Try again
                        </button>
                    </div>
                ) : assignments.length === 0 ? (
                    <p className="mt-6 text-sm leading-6 text-slate-500">
                        No published assignments are available for this practice.
                    </p>
                ) : (
                    <div className="mt-6">
                        <p className="text-sm leading-6 text-slate-500">
                            {assignments.length} published{" "}
                            {assignments.length === 1 ? "assignment" : "assignments"}
                        </p>

                        {startError && (
                            <p role="alert" className="mt-4 text-sm text-red-700">
                                {startError}
                            </p>
                        )}

                        <ul className="mt-4 space-y-4">
                            {assignments.map((assignment) => (
                                <li
                                    key={assignment.id}
                                    className="rounded-xl border border-slate-200 p-5"
                                >
                                    <h2 className="break-words text-lg font-semibold text-slate-900">
                                        {assignment.title}
                                    </h2>

                                    <p className="mt-2 text-sm text-slate-500">
                                        Published version{" "}
                                        {assignment.assignmentVersions[0].versionNo}
                                    </p>

                                    <button
                                        type="button"
                                        disabled={startingId !== null}
                                        onClick={() => void handleStart(assignment.id)}
                                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {startingId === assignment.id ? "Opening..." : "Start / resume"}
                                    </button>

                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        Starting a new attempt uses an attempt and starts its time limit, if set.
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>
        </main>
    );
}

export default function PracticePage({
    accessToken = null,
    onSessionExpired,
}: PracticePageProps) {
    const { courseId, activityId } = useParams();

    if (!courseId || !activityId) {
        return <p className="p-8">The practice link is invalid.</p>;
    }

    return (
        <PracticeContent
            key={JSON.stringify([courseId, activityId, accessToken])}
            courseId={courseId}
            activityId={activityId}
            accessToken={accessToken}
            onSessionExpired={onSessionExpired}
        />
    );
}