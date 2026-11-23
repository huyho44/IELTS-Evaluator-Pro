import AttemptStatusBadge from "./AttemptStatusBadge";
import AttemptTimerBadge from "../../components/AttemptTimerBadge";
import PracticeAssessmentPanel from "./PracticeAssessmentPanel";
import { useEffect, useState, type MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getPracticeAttempt,
  PracticeApiError,
  type PracticeAttemptDetail,
  type PracticeQuestion,
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

type AnswerMap = Record<string, { textAnswer: string; optionIds: string[] }>;

type AnswerInputProps = {
  itemId: string;
  question: PracticeAttemptDetail["assignmentVersion"]["activityVersion"]["assessmentItems"][number]["questionVersion"];
  answer: {
    textAnswer: string;
    optionIds: string[];
  };
  disabled: boolean;
  onChange: (answer: { textAnswer: string; optionIds: string[] }) => void;
};

function cloneAnswerMap(source: AnswerMap): AnswerMap {
  const copy: AnswerMap = {};
  for (const [key, value] of Object.entries(source)) {
    copy[key] = {
      textAnswer: value.textAnswer,
      optionIds: [...value.optionIds],
    };
  }
  return copy;
}

function hasAnswerDifferences(
  items: PracticeQuestion[],
  current: AnswerMap,
  saved: AnswerMap,
): boolean {
  for (const item of items) {
    const a = current[item.id] ?? { textAnswer: "", optionIds: [] };
    const b = saved[item.id] ?? { textAnswer: "", optionIds: [] };
    if (item.questionVersion.questionType === "SHORT_ANSWER") {
      if (a.textAnswer !== b.textAnswer) return true;
    } else {
      const aSorted = [...a.optionIds].sort();
      const bSorted = [...b.optionIds].sort();
      if (
        aSorted.length !== bSorted.length ||
        aSorted.some((val, idx) => val !== bSorted[idx])
      ) {
        return true;
      }
    }
  }
  return false;
}

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
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
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
                  ? "border-brand-300 bg-brand-50 text-brand-900"
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
                className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
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
          className="text-xs font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [savedAnswers, setSavedAnswers] = useState<AnswerMap>({});
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
            const restored: AnswerMap = {};

            const responses =
              submitted?.itemResponses ??
              data.attemptDraft?.payloadJson.itemResponses ??
              [];

            for (const response of responses) {
              restored[response.assessmentItemId] = {
                textAnswer: response.textAnswer ?? "",
                optionIds: [...response.optionIds],
              };
            }

            setAnswers(restored);
            setSavedAnswers(cloneAnswerMap(restored));
            setReceipt(submitted?.receipt ?? null);
            setLockVersion(data.attemptDraft?.lockVersion ?? 0);
            setDraftConflict(false);
            setDraftError("");
            setDraftMessage("");
            setAttempt(data);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          const forbidden =
            cause instanceof PracticeApiError && cause.status === 403;
          setAccessDenied(forbidden);
          setError(
            forbidden
              ? "You do not have access to this attempt. Open your practice history."
              : cause instanceof Error
                ? cause.message
                : "Unable to load practice.",
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
    (attempt.expiresAt !== null && new Date(attempt.expiresAt).getTime() <= now);

  const unsupportedQuestions =
    activity?.assessmentItems.some(
      (item) =>
        !["SHORT_ANSWER", "SINGLE_CHOICE"].includes(
          item.questionVersion.questionType,
        ),
    ) ?? false;

  const isSubmittedView =
    Boolean(receipt) ||
    attempt?.status === "SUBMITTED" ||
    attempt?.status === "FINISHED";

  const dirty =
    Boolean(activity) &&
    !isSubmittedView &&
    hasAnswerDifferences(
      activity?.assessmentItems ?? [],
      answers,
      savedAnswers,
    );

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function protectNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm(
        "Your answers have unsaved changes. Leave without saving them?",
      )
    ) {
      event.preventDefault();
    }
  }

  function buildResponses(source: AnswerMap = answers): PracticeResponse[] {
    return (activity?.assessmentItems ?? []).map((item) => {
      const answer = source[item.id];
      const shortAnswer = item.questionVersion.questionType === "SHORT_ANSWER";

      return {
        assessmentItemId: item.id,
        textAnswer: shortAnswer ? (answer?.textAnswer ?? "") : null,
        optionIds: shortAnswer ? [] : (answer?.optionIds ?? []),
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

    const snapshot = cloneAnswerMap(answers);
    const itemResponses = buildResponses(snapshot);

    try {
      const draft = await savePracticeDraft(
        attemptId,
        accessToken,
        lockVersion,
        itemResponses,
      );

      setLockVersion(draft.lockVersion);
      setSavedAnswers(snapshot);
      setDraftMessage("Draft saved.");
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
    setDraftError("");

    const snapshot = cloneAnswerMap(answers);

    try {
      const result = await submitPracticeAttempt(
        attempt.assignmentId,
        attemptId,
        accessToken,
        buildResponses(snapshot),
      );

      setSavedAnswers(snapshot);
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

  const draftBadge = draftError
    ? {
        label: "Save failed",
        className: "border border-red-200 bg-red-50 text-red-700",
      }
    : saving
      ? {
          label: "Saving draft...",
          className: "border border-slate-200 bg-slate-50 text-slate-600",
        }
      : dirty
        ? {
            label: "Unsaved changes",
            className: "border border-amber-200 bg-amber-50 text-amber-800",
          }
        : lockVersion > 0
          ? {
              label: "Draft saved",
              className:
                "border border-emerald-200 bg-emerald-50 text-emerald-700",
            }
          : {
              label: "Not saved yet",
              className: "border border-slate-200 bg-slate-50 text-slate-600",
            };

  return (
    <div
      className={`${isSubmittedView ? "student-surface-attempt-review" : "student-surface-attempt-active"} min-h-[calc(100vh-4rem)]`}
    >
    <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
      <nav aria-label="Practice navigation">
        <Link
          onClick={protectNavigation}
          to={
            accessToken && version
              ? `/courses/${encodeURIComponent(version.assignment.courseId)}`
              : "/courses"
          }
          className="inline-flex w-fit text-sm font-semibold text-brand-600 hover:underline"
        >
          {accessToken && version
            ? "← Back to course overview"
            : "← Back to courses"}
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
              className="mt-4 block w-fit text-sm font-semibold text-brand-600 hover:underline"
            >
              My practice attempts
            </Link>
          )}
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </section>
      ) : attempt && version && activity ? (
        <>
          {isSubmittedView ? (
            <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Reading practice · Reviewing submission
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Submitted — Reviewing answers
                </span>
              </div>

              <h1 className="mt-1.5 break-words text-2xl font-bold text-slate-900">
                {version.assignment.title}
              </h1>

              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                Your answers have been submitted. Review your submission status and recorded responses below.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">
                  Attempt {attempt.attemptNo}
                </span>
              </div>
            </header>
          ) : (
            <header className="sticky top-2 z-20 rounded-xl border border-slate-200/95 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5 sm:py-3.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <span className="font-semibold uppercase tracking-wide text-brand-600">
                      {attemptClosed
                        ? "Reading practice · Attempt closed"
                        : "Reading practice"}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-semibold text-slate-900">
                      Attempt {attempt.attemptNo}
                    </span>
                  </div>
                  <h1 className="mt-0.5 truncate text-base font-bold text-slate-900 sm:text-lg">
                    {version.assignment.title}
                  </h1>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AttemptTimerBadge
                    expiresAt={attempt.expiresAt}
                    now={now}
                  />
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      attemptClosed
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : "border border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {attemptClosed
                      ? attempt.expiresAt &&
                        new Date(attempt.expiresAt).getTime() <= now
                        ? "Time limit expired — Read only"
                        : "Attempt closed — Read only"
                      : "In progress"}
                  </span>
                </div>
              </div>
            </header>
          )}

          {activity.instructions && (
            <div className="whitespace-pre-wrap rounded-xl border border-brand-100 bg-brand-50 p-5 text-sm leading-7 text-brand-900">
              {activity.instructions}
            </div>
          )}

          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 shadow-2xs lg:hidden"
            aria-label="Quick section jump"
          >
            <a
              href="#reading-passage-panel"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Reading passage
            </a>
            <a
              href="#reading-questions-panel"
              className="flex-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-center text-xs font-semibold text-brand-800 hover:bg-brand-100"
            >
              Questions {isSubmittedView ? "& result" : "& submit"}
            </a>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section
              id="reading-passage-panel"
              className={`min-w-0 scroll-mt-24 rounded-xl border border-slate-200 border-l-4 border-l-slate-300 bg-slate-50 p-5 shadow-sm sm:p-6 ${
                isSubmittedView ? "order-2 lg:order-1" : ""
              }`}
            >
              <h2 className="text-lg font-semibold text-slate-900">
                Reading passage
              </h2>
              <div className="mt-4 whitespace-pre-wrap break-words leading-8 text-slate-700">
                {activity.promptText || "No passage available."}
              </div>
            </section>

            <section
              id="reading-questions-panel"
              className={`min-w-0 scroll-mt-24 rounded-xl border bg-white p-5 shadow-sm sm:p-6 ${
                !isSubmittedView && !attemptClosed
                  ? "border-brand-200/90 ring-1 ring-brand-50"
                  : "border-slate-200"
              } ${isSubmittedView ? "order-1 lg:order-2" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  Questions
                </h2>
                {!isSubmittedView && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${draftBadge.className}`}
                  >
                    {draftBadge.label}
                  </span>
                )}
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {isSubmittedView
                  ? "This attempt has been submitted."
                  : "Save your draft before leaving or reloading this page."}
              </p>

              {isSubmittedView && (
                <div className="mt-4 space-y-3 border-b border-slate-200 pb-5">
                  {receipt && accessToken && (
                    <PracticeAssessmentPanel
                      key={JSON.stringify([receipt.submissionId, accessToken])}
                      submissionId={receipt.submissionId}
                      accessToken={accessToken}
                      onSessionExpired={onSessionExpired}
                    />
                  )}

                  {receipt && (
                    <div
                      role="status"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
                    >
                      <p className="font-semibold">
                        Your submission has been received.
                      </p>
                      <p className="mt-2">
                        Processing:{" "}
                        <AttemptStatusBadge status={receipt.status} />
                      </p>
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">
                          Submission reference
                        </summary>
                        <p className="mt-2 break-all font-mono">
                          {receipt.submissionId}
                        </p>
                      </details>

                      <button
                        type="button"
                        disabled={checkingStatus}
                        onClick={() => void handleCheckStatus()}
                        className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
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

                  <div>
                    <Link
                      to="/practice-history"
                      className="text-sm font-semibold text-brand-600 hover:underline"
                    >
                      View all attempts in practice history →
                    </Link>
                  </div>
                </div>
              )}

              <ol className="mt-5 space-y-6">
                {activity.assessmentItems.map((item, index) => (
                  <li key={item.id}>
                    <p className="whitespace-pre-wrap break-words font-medium leading-7 text-slate-800">
                      {index + 1}. {item.questionVersion.promptText}
                    </p>

                    <AnswerInput
                      itemId={item.id}
                      question={item.questionVersion}
                      answer={
                        answers[item.id] ?? { textAnswer: "", optionIds: [] }
                      }
                      disabled={
                        attemptClosed ||
                        saving ||
                        submitting ||
                        receipt !== null ||
                        draftConflict
                      }
                      onChange={(answer) => {
                        setDraftMessage("");
                        setDraftError("");

                        setAnswers((previous) => ({
                          ...previous,
                          [item.id]: answer,
                        }));
                      }}
                    />
                  </li>
                ))}
              </ol>

              {!isSubmittedView && (
                <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveDraft()}
                      disabled={
                        attemptClosed ||
                        saving ||
                        submitting ||
                        receipt !== null ||
                        draftConflict ||
                        unsupportedQuestions ||
                        !dirty
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit answers"}
                    </button>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${draftBadge.className}`}
                    >
                      {draftBadge.label}
                    </span>
                  </div>

                  {draftMessage && (
                    <p
                      role="status"
                      className="text-sm font-medium text-emerald-700"
                    >
                      {draftMessage}
                    </p>
                  )}

                  {draftError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                    >
                      Save failed: {draftError}
                    </p>
                  )}

                  {submitError && (
                    <p role="alert" className="text-sm text-red-700">
                      {submitError}
                    </p>
                  )}

                  {attemptClosed && (
                    <p className="text-sm text-amber-800">
                      This attempt is closed or its time limit has expired.
                    </p>
                  )}

                  {draftConflict && (
                    <p className="text-sm leading-6 text-amber-800">
                      Saving has been stopped. Copy any unsaved answers before
                      reloading this page to check the latest draft and attempt
                      status.
                    </p>
                  )}
                </div>
              )}

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
    </div>
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
