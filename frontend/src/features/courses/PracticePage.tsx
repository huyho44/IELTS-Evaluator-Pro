import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    formatMaxAttempts,
    formatTimeLimit,
    getPracticeAssignments,
    PracticeApiError,
    type ActivePracticeAttempt,
    type PracticeAssignment,
    resolveAssignmentAttemptStatus,
    startPracticeAttempt,
} from "./practiceApi";

function PracticeClipboardIcon() {
    return (
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
            aria-hidden="true"
        >
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="m9 14 2 2 4-4" />
        </svg>
    );
}

type StartResumeButtonProps = {
    assignmentId: string;
    startingId: string | null;
    disabled?: boolean;
    label: string;
    onStart: (assignmentId: string) => void;
};

function StartResumeButton({
    assignmentId,
    startingId,
    disabled = false,
    label,
    onStart,
}: StartResumeButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled || startingId !== null}
            onClick={() => onStart(assignmentId)}
            className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
        >
            {startingId === assignmentId ? "Opening..." : label}
        </button>
    );
}

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

    async function handleStart(
        assignmentId: string,
        activeAttempt: ActivePracticeAttempt | null,
    ) {
        if (!accessToken || startingId) return;

        setStartError("");
        if (activeAttempt) {
            navigate(`/attempts/${encodeURIComponent(activeAttempt.id)}`);
            return;
        }

        setStartingId(assignmentId);
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

    const singleAssignment = assignments.length === 1 ? assignments[0] : null;
    const singleVersion = singleAssignment?.assignmentVersions[0] ?? null;
    const singleStatus = singleAssignment
        ? resolveAssignmentAttemptStatus(singleAssignment)
        : null;

    function statusPillClass(
        kind: ReturnType<typeof resolveAssignmentAttemptStatus>["statusKind"],
    ) {
        switch (kind) {
            case "active_and_remaining":
            case "resume_only":
                return "border-brand-200 bg-brand-50 text-brand-800";
            case "exhausted":
                return "border-amber-200 bg-amber-50 text-amber-800";
            case "unknown":
                return "border-slate-200 bg-slate-50 text-slate-700";
            default:
                return "border-emerald-200 bg-emerald-50 text-emerald-700";
        }
    }

    return (
        <div className="student-surface-overview min-h-[calc(100vh-4rem)]">
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
            <nav aria-label="Practice navigation" className="mb-6">
                <Link
                    to={`/courses/${encodeURIComponent(courseId)}`}
                    className="inline-flex text-sm font-semibold text-brand-600 hover:underline"
                >
                    ← Back to course overview
                </Link>
            </nav>

            {(!accessToken || loading || error || assignments.length !== 1) && (
                <header className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                            Course activity
                        </p>
                        <h1 className="mt-1.5 text-2xl font-bold text-slate-900">
                            {assignments.length > 1
                                ? "Choose a practice assignment"
                                : "Practice preparation"}
                        </h1>
                        {assignments.length > 1 && (
                            <p className="mt-1 text-sm text-slate-600">
                                Select an assignment below to begin a new attempt or resume an in-progress attempt.
                            </p>
                        )}
                    </div>
                    {accessToken && !loading && !error && assignments.length > 1 && (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-xs">
                            {assignments.length} published assignments
                        </span>
                    )}
                </header>
            )}

            {!accessToken ? (
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="font-semibold text-slate-900">
                        Sign in to access this practice
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Practice assignments are available according to your course
                        enrollment.
                    </p>
                </section>
            ) : loading ? (
                <p
                    role="status"
                    className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm"
                >
                    Loading assignments...
                </p>
            ) : error ? (
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                        Try again
                    </button>
                </section>
            ) : assignments.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-500 shadow-sm">
                    No published assignments are available for this practice.
                </p>
            ) : singleAssignment && singleVersion && singleStatus ? (
                <section
                    aria-labelledby="assignment-heading"
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                            Practice preparation
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(singleStatus.statusKind)}`}
                            >
                                {singleStatus.statusBadge}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                Published version {singleVersion.versionNo}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 flex items-start gap-3.5">
                        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                            <PracticeClipboardIcon />
                        </span>
                        <div className="min-w-0">
                            <h1
                                id="assignment-heading"
                                className="break-words text-2xl font-bold leading-snug text-slate-900 sm:text-[26px]"
                            >
                                {singleAssignment.title}
                            </h1>
                            <p className="mt-1.5 text-sm leading-6 text-slate-600">
                                Review your remaining attempts and timing limits below before opening this activity.
                            </p>
                        </div>
                    </div>

                    <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div
                            className={`rounded-xl border p-4 ${
                                singleStatus.statusKind === "exhausted"
                                    ? "border-amber-200 bg-amber-50/45"
                                    : singleStatus.activeAttempt
                                      ? "border-brand-200 bg-brand-50/65"
                                      : "border-brand-200/80 bg-brand-50/40"
                            }`}
                        >
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Remaining new attempts
                            </dt>
                            <dd className="mt-1.5 text-base font-bold text-slate-900">
                                {singleStatus.remainingValue}
                            </dd>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                {singleStatus.remainingSubtext}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-4">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Attempt limit
                            </dt>
                            <dd className="mt-1.5 text-base font-bold text-slate-900">
                                {formatMaxAttempts(singleVersion.maxAttempts)}
                            </dd>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Maximum new attempts allowed per learner.
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-4">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Time limit
                            </dt>
                            <dd className="mt-1.5 text-base font-bold text-slate-900">
                                {formatTimeLimit(singleVersion.timeLimitSeconds)}
                            </dd>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                {singleVersion.timeLimitSeconds === null
                                    ? "No countdown applies once an attempt starts."
                                    : "Timer runs once you begin an attempt."}
                            </p>
                        </div>
                    </dl>

                    {startError && (
                        <p
                            role="alert"
                            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                            {startError}
                        </p>
                    )}

                    <div
                        className={`mt-6 rounded-xl border p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5 ${
                            singleStatus.statusKind === "exhausted"
                                ? "border-amber-200 bg-amber-50/55"
                                : "border-brand-100 bg-brand-50/50"
                        }`}
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                                {singleStatus.actionHeadline}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                {singleStatus.actionDescription}
                            </p>
                            {singleStatus.statusKind === "exhausted" && (
                                <Link
                                    to="/practice-history"
                                    className="mt-2 inline-flex text-xs font-semibold text-brand-600 hover:underline"
                                >
                                    View my practice attempts →
                                </Link>
                            )}
                        </div>
                        <div className="mt-4 shrink-0 sm:mt-0">
                            <StartResumeButton
                                assignmentId={singleAssignment.id}
                                startingId={startingId}
                                disabled={!singleStatus.canStartOrResume}
                                label={singleStatus.ctaLabel}
                                onStart={(id) =>
                                    void handleStart(id, singleStatus.activeAttempt)
                                }
                            />
                        </div>
                    </div>
                </section>
            ) : (
                <div className="mt-6">
                    {startError && (
                        <p
                            role="alert"
                            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                            {startError}
                        </p>
                    )}

                    <ul className="space-y-4">
                        {assignments.map((assignment) => {
                            const version = assignment.assignmentVersions[0];
                            const status =
                                resolveAssignmentAttemptStatus(assignment);

                            return (
                                <li
                                    key={assignment.id}
                                    className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                                        status.statusKind === "exhausted"
                                            ? "border-l-amber-400"
                                            : "border-l-brand-600"
                                    }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3.5">
                                            <span
                                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                                    status.statusKind ===
                                                    "exhausted"
                                                        ? "bg-amber-50 text-amber-700"
                                                        : "bg-brand-50 text-brand-600"
                                                }`}
                                            >
                                                <PracticeClipboardIcon />
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="break-words text-lg font-bold text-slate-900">
                                                        {assignment.title}
                                                    </h2>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusPillClass(status.statusKind)}`}
                                                    >
                                                        {status.statusBadge}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                                        Published version{" "}
                                                        {version.versionNo}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm font-semibold text-brand-800">
                                                    {status.remainingValue} ·{" "}
                                                    {formatMaxAttempts(
                                                        version.maxAttempts,
                                                    )}{" "}
                                                    ·{" "}
                                                    {formatTimeLimit(
                                                        version.timeLimitSeconds,
                                                    )}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                    {status.actionDescription}
                                                </p>
                                            </div>
                                        </div>

                                        <StartResumeButton
                                            assignmentId={assignment.id}
                                            startingId={startingId}
                                            disabled={!status.canStartOrResume}
                                            label={status.ctaLabel}
                                            onStart={(id) =>
                                                void handleStart(id, status.activeAttempt)
                                            }
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </main>
        </div>
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
