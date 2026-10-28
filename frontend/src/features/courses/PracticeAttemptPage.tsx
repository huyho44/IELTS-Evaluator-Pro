import AttemptStatusBadge from "./AttemptStatusBadge";
import PracticeAssessmentPanel from "./PracticeAssessmentPanel";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getPracticeAttempt,
    PracticeApiError,
    type PracticeAttemptDetail,
    savePracticeDraft,
    type PracticeResponse,
    submitPracticeAttempt,
    type PracticeReceipt,
    getPracticeSubmissionStatus,
    getSubmittedPractice,
} from "./practiceApi";

type Props = {
    accessToken?: string | null;
    onSessionExpired?: () => void;
};

type ContentProps = Props & {
    attemptId: string;
};

type AnswerInputProps = {
    itemId: string;
    question: PracticeAttemptDetail["assignmentVersion"]["activityVersion"]["assessmentItems"][number]["questionVersion"];
    answer: {
        textAnswer: string;
        optionIds: string[];
    };
    disabled: boolean;
    onChange: (answer: {
        textAnswer: string;
        optionIds: string[];
    }) => void;
};

function AnswerInput({
    itemId,
    question,
    answer,
    disabled,
    onChange,
}: AnswerInputProps) {
    if (question.questionType === "SHORT_ANSWER") {
        return (
            <div className="mt-3">
                <label
                    htmlFor={`answer-${itemId}`}
                    className="block text-sm font-medium text-slate-700"
                >
                    Your answer
                </label>

                <input
                    id={`answer-${itemId}`}
                    type="text"
                    value={answer.textAnswer}
                    disabled={disabled}
                    onChange={(event) =>
                        onChange({
                            textAnswer: event.target.value,
                            optionIds: [],
                        })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                />
            </div>
        );
    }

    if (question.questionType === "SINGLE_CHOICE") {
        return (
            <fieldset disabled={disabled} className="mt-3 space-y-2">
                <legend className="sr-only">{question.promptText}</legend>

                {question.questionOptions.map((option) => {
                    const selected = answer.optionIds.includes(option.id);

                    return (
                        <label
                            key={option.id}
                            className={
                                "flex items-start gap-3 rounded-lg border p-3 text-sm leading-6 " +
                                (selected
                                    ? "border-blue-300 bg-blue-50 text-blue-900"
                                    : "border-slate-200 text-slate-700") +
                                (disabled ? " cursor-not-allowed opacity-70" : " cursor-pointer")
                            }
                        >
                            <input
                                type="radio"
                                name={`question-${itemId}`}
                                value={option.id}
                                checked={selected}
                                onChange={() =>
                                    onChange({
                                        textAnswer: "",
                                        optionIds: [option.id],
                                    })
                                }
                                className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                            />

                            <span className="break-words">
                                <span className="font-semibold">{option.optionCode}.</span>{" "}
                                {option.contentText}
                            </span>
                        </label>
                    );
                })}

                <button
                    type="button"
                    disabled={disabled || answer.optionIds.length === 0}
                    onClick={() => onChange({ textAnswer: "", optionIds: [] })}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Clear selection
                </button>
            </fieldset>
        );
    }

    return (
        <p className="mt-3 text-sm text-amber-800">
            This question type is not supported on this page yet.
        </p>
    );
}

function AttemptContent({
    attemptId,
    accessToken,
    onSessionExpired,
}: ContentProps) {
    const [attempt, setAttempt] = useState<PracticeAttemptDetail | null>(null);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [error, setError] = useState("");
    const [accessDenied, setAccessDenied] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [answers, setAnswers] = useState<
        Record<string, { textAnswer: string; optionIds: string[] }>
    >({});
    const [now, setNow] = useState(() => Date.now());
    const [lockVersion, setLockVersion] = useState(0);
    const [saving, setSaving] = useState(false);
    const [draftMessage, setDraftMessage] = useState("");
    const [draftError, setDraftError] = useState("");
    const [draftConflict, setDraftConflict] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [receipt, setReceipt] = useState<PracticeReceipt | null>(null);
    const [submitError, setSubmitError] = useState("");

    const [checkingStatus, setCheckingStatus] = useState(false);
    const [statusError, setStatusError] = useState("");

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!accessToken) return;

        const token = accessToken;
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");
            setAccessDenied(false);

            try {
                const data = await getPracticeAttempt(
                    attemptId,
                    token,
                    controller.signal,
                );

                if (!controller.signal.aborted) {
                    const latestRevision = [...data.submissionRevisions].sort(
                        (first, second) => second.revisionNo - first.revisionNo,
                    )[0];

                    const submitted = latestRevision
                        ? await getSubmittedPractice(
                            latestRevision.id,
                            token,
                            controller.signal,
                        )
                        : null;

                    if (submitted && submitted.receipt.attemptId !== attemptId) {
                        throw new Error("The submission does not belong to this attempt.");
                    }

                    if (!controller.signal.aborted) {
                        const restored: Record<
                            string,
                            { textAnswer: string; optionIds: string[] }
                        > = {};

                        const responses =
                            submitted?.itemResponses ??
                            data.attemptDraft?.payloadJson.itemResponses ??
                            [];

                        for (const response of responses) {
                            restored[response.assessmentItemId] = {
                                textAnswer: response.textAnswer ?? "",
                                optionIds: response.optionIds,
                            };
                        }

                        setAnswers(restored);
                        setReceipt(submitted?.receipt ?? null);
                        setLockVersion(data.attemptDraft?.lockVersion ?? 0);
                        setDraftConflict(false);
                        setAttempt(data);
                    }
                }
            } catch (cause) {
                if (!controller.signal.aborted) {
                    const forbidden = cause instanceof PracticeApiError && cause.status === 403;
                    setAccessDenied(forbidden);
                    setError(
                        forbidden
                            ? "You do not have access to this attempt. Open your practice history."
                            : cause instanceof Error ? cause.message : "Unable to load practice.",
                    );

                    if (cause instanceof PracticeApiError && cause.status === 401) {
                        onSessionExpired?.();
                    }
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, [attemptId, accessToken, onSessionExpired, reloadKey]);

    const version = attempt?.assignmentVersion;
    const activity = version?.activityVersion;

    const attemptClosed =
        !attempt ||
        attempt.status !== "IN_PROGRESS" ||
        (attempt.expiresAt !== null &&
            new Date(attempt.expiresAt).getTime() <= now);

    const unsupportedQuestions =
        activity?.assessmentItems.some(
            (item) =>
                !["SHORT_ANSWER", "SINGLE_CHOICE"].includes(
                    item.questionVersion.questionType,
                ),
        ) ?? false;

    function buildResponses(): PracticeResponse[] {
        return (activity?.assessmentItems ?? []).map((item) => {
            const answer = answers[item.id];
            const shortAnswer = item.questionVersion.questionType === "SHORT_ANSWER";

            return {
                assessmentItemId: item.id,
                textAnswer: shortAnswer ? answer?.textAnswer ?? "" : null,
                optionIds: shortAnswer ? [] : answer?.optionIds ?? [],
            };
        });
    }

    async function handleSaveDraft() {
        if (
            !accessToken ||
            submitting ||
            receipt !== null ||
            !activity ||
            attemptClosed ||
            saving ||
            draftConflict ||
            unsupportedQuestions
        ) {
            return;
        }

        setSaving(true);
        setDraftMessage("");
        setDraftError("");

        const itemResponses = buildResponses();

        try {
            const draft = await savePracticeDraft(
                attemptId,
                accessToken,
                lockVersion,
                itemResponses,
            );

            setLockVersion(draft.lockVersion);
            setDraftMessage("Your draft has been saved.");
        } catch (cause) {
            setDraftError(
                cause instanceof Error ? cause.message : "Unable to save draft.",
            );

            if (cause instanceof PracticeApiError) {
                if (cause.status === 401) onSessionExpired?.();

                if (cause.status === 409) {
                    setDraftConflict(true);
                }
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit() {
        if (
            !accessToken ||
            !attempt ||
            !activity ||
            attemptClosed ||
            saving ||
            submitting ||
            receipt ||
            draftConflict ||
            unsupportedQuestions
        ) {
            return;
        }

        const confirmed = window.confirm(
            "Submit your current answers? Unanswered questions will also be submitted.",
        );

        if (!confirmed) return;

        setSubmitting(true);
        setSubmitError("");
        setDraftMessage("");

        try {
            const result = await submitPracticeAttempt(
                attempt.assignmentId,
                attemptId,
                accessToken,
                buildResponses(),
            );

            setReceipt(result);
            setAttempt((previous) =>
                previous ? { ...previous, status: "SUBMITTED" } : previous,
            );
        } catch (cause) {
            setSubmitError(
                cause instanceof Error ? cause.message : "Unable to submit.",
            );

            if (cause instanceof PracticeApiError) {
                if (cause.status === 401) onSessionExpired?.();

                if (cause.status === 409) setDraftConflict(true);
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCheckStatus() {
        if (!accessToken || !receipt || checkingStatus) return;

        setCheckingStatus(true);
        setStatusError("");

        try {
            const updated = await getPracticeSubmissionStatus(
                receipt.submissionId,
                accessToken,
            );

            setReceipt(updated);
        } catch (cause) {
            setStatusError(
                cause instanceof Error
                    ? cause.message
                    : "Unable to check submission status.",
            );

            if (cause instanceof PracticeApiError && cause.status === 401) {
                onSessionExpired?.();
            }
        } finally {
            setCheckingStatus(false);
        }
    }

    return (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <nav aria-label="Practice navigation" className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
                to={
                    accessToken && version
                        ? `/courses/${encodeURIComponent(version.assignment.courseId)}`
                        : "/courses"
                }
                className="block w-fit text-sm font-semibold text-blue-600 hover:underline"
            >
                {accessToken && version ? "← Back to course overview" : "← Back to courses"}
            </Link>

            <Link
                to="/practice-history"
                className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
                My practice attempts
            </Link>
            </nav>

            {!accessToken ? (
                <section className="rounded-xl border border-slate-200 bg-white p-8">
                    <h1 className="text-xl font-bold">Sign in to access this attempt</h1>
                    <p className="mt-3 text-sm text-slate-600">
                        Use the account that started this practice.
                    </p>
                </section>
            ) : loading ? (
                <p role="status" className="p-8 text-slate-500">
                    Loading practice...
                </p>
            ) : error ? (
                <section className="rounded-xl border border-red-200 bg-white p-8">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>
                    {accessDenied && (
                        <Link
                            to="/practice-history"
                            className="mt-4 block w-fit text-sm font-semibold text-blue-600 hover:underline"
                        >
                            My practice attempts
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Try again
                    </button>
                </section>
            ) : attempt && version && activity ? (
                <>
                    <h1 className="mt-5 break-words text-2xl font-bold text-slate-900">
                        {version.assignment.title}
                    </h1>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                        <span>Attempt {attempt.attemptNo}</span>
                        <AttemptStatusBadge status={attempt.status} />
                        {attempt.status === "IN_PROGRESS" && attempt.expiresAt && new Date(attempt.expiresAt).getTime() <= now && <span className="text-xs text-amber-800">Time limit expired</span>}
                        {attempt.expiresAt && (
                            <span>
                                {attempt.status === "IN_PROGRESS" ? "Time limit ends" : "Time limit ended"}: {new Date(attempt.expiresAt).toLocaleString()}
                            </span>
                        )}
                    </div>

                    {activity.instructions && (
                        <div className="mt-6 whitespace-pre-wrap rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-900">
                            {activity.instructions}
                        </div>
                    )}

                    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
                        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
                            <h2 className="text-lg font-semibold">Reading passage</h2>
                            <div className="mt-4 whitespace-pre-wrap break-words leading-8 text-slate-700">
                                {activity.promptText || "No passage available."}
                            </div>
                        </section>

                        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
                            <h2 className="text-lg font-semibold">Questions</h2>

                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                {attempt.status === "SUBMITTED" || attempt.status === "FINISHED"
                                    ? "This attempt has been submitted."
                                    : "Save your draft before leaving or reloading this page."}
                            </p>

                            <ol className="mt-5 space-y-6">
                                {activity.assessmentItems.map((item, index) => (
                                    <li key={item.id}>
                                        <p className="whitespace-pre-wrap break-words font-medium leading-7 text-slate-800">
                                            {index + 1}. {item.questionVersion.promptText}
                                        </p>

                                        <AnswerInput
                                            itemId={item.id}
                                            question={item.questionVersion}
                                            answer={answers[item.id] ?? { textAnswer: "", optionIds: [] }}
                                            disabled={
                                                attemptClosed ||
                                                saving ||
                                                submitting ||
                                                receipt !== null ||
                                                draftConflict
                                            }
                                            onChange={(answer) => {
                                                setDraftMessage("");

                                                setAnswers((previous) => ({
                                                    ...previous,
                                                    [item.id]: answer,
                                                }));
                                            }}
                                        />
                                    </li>
                                ))}
                            </ol>

                            <div className="mt-6 border-t border-slate-200 pt-5">
                                {!receipt && attempt.status !== "SUBMITTED" && attempt.status !== "FINISHED" && <>
                                <button
                                    type="button"
                                    onClick={() => void handleSaveDraft()}
                                    disabled={
                                        attemptClosed ||
                                        saving ||
                                        submitting ||
                                        receipt !== null ||
                                        draftConflict ||
                                        unsupportedQuestions
                                    }
                                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : "Save draft"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void handleSubmit()}
                                    disabled={
                                        attemptClosed ||
                                        saving ||
                                        submitting ||
                                        receipt !== null ||
                                        draftConflict ||
                                        unsupportedQuestions
                                    }
                                    className="ml-3 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting
                                        ? "Submitting..."
                                        : receipt ||
                                            attempt.status === "SUBMITTED" ||
                                            attempt.status === "FINISHED"
                                            ? "Submitted"
                                            : "Submit answers"}
                                </button>

                                </>}

                                {receipt && (
                                    <div
                                        role="status"
                                        className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
                                    >
                                        <p className="font-semibold">Your submission has been received.</p>
                                        <p className="mt-2">Processing: <AttemptStatusBadge status={receipt.status} /></p>
                                        <details className="mt-2 text-xs"><summary className="cursor-pointer">Submission reference</summary><p className="mt-2 break-all font-mono">{receipt.submissionId}</p></details>

                                        <button
                                            type="button"
                                            disabled={checkingStatus}
                                            onClick={() => void handleCheckStatus()}
                                            className="mt-3 rounded-lg border border-emerald-300 px-3 py-2 font-semibold hover:bg-emerald-100 disabled:opacity-50"
                                        >
                                            {checkingStatus ? "Checking..." : "Refresh status"}
                                        </button>

                                        {statusError && (
                                            <p role="alert" className="mt-3 text-red-700">
                                                {statusError}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {receipt && accessToken && (
                                    <PracticeAssessmentPanel
                                        key={JSON.stringify([receipt.submissionId, accessToken])}
                                        submissionId={receipt.submissionId}
                                        accessToken={accessToken}
                                        onSessionExpired={onSessionExpired}
                                    />
                                )}

                                {submitError && (
                                    <p role="alert" className="mt-3 text-sm text-red-700">
                                        {submitError}
                                    </p>
                                )}

                                {attemptClosed &&
                                    !receipt &&
                                    attempt.status !== "SUBMITTED" &&
                                    attempt.status !== "FINISHED" && (
                                        <p className="mt-3 text-sm text-amber-800">
                                            This attempt is closed or its time limit has expired.
                                        </p>
                                    )}

                                {draftMessage && (
                                    <p role="status" className="mt-3 text-sm text-emerald-700">
                                        {draftMessage}
                                    </p>
                                )}

                                {draftError && (
                                    <p role="alert" className="mt-3 text-sm text-red-700">
                                        {draftError}
                                    </p>
                                )}

                                {draftConflict && (
                                    <p className="mt-3 text-sm leading-6 text-amber-800">
                                        Saving has been stopped. Copy any unsaved answers before reloading
                                        this page to check the latest draft and attempt status.
                                    </p>
                                )}
                            </div>

                            {activity.assessmentItems.length === 0 && (
                                <p className="mt-4 text-sm text-slate-500">
                                    No questions available.
                                </p>
                            )}
                        </section>
                    </div>
                </>
            ) : null}
        </main>
    );
}

export default function PracticeAttemptPage({
    accessToken = null,
    onSessionExpired,
}: Props) {
    const { attemptId } = useParams();

    if (!attemptId) {
        return <p className="p-8">The attempt link is invalid.</p>;
    }

    return (
        <AttemptContent
            key={JSON.stringify([attemptId, accessToken])}
            attemptId={attemptId}
            accessToken={accessToken}
            onSessionExpired={onSessionExpired}
        />
    );
}