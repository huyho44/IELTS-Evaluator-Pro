import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StudentApiError } from "../../lib/api/studentRequest";
import {
  getStudentAttempt,
  reopenWriting,
  saveWritingDraft,
  selectRevisionId,
  submitWriting,
  type StudentAttempt,
} from "./writingApi";
import WritingFeedbackPanel from "./WritingFeedbackPanel";

type Props = {
  initialAttempt: StudentAttempt;
  accessToken: string;
  onSessionExpired?: () => void;
};

function restoredText(attempt: StudentAttempt) {
  return attempt.status === "IN_PROGRESS"
    ? (attempt.attemptDraft?.payloadJson.writingText ?? "")
    : "";
}

export default function WritingAttemptPage({
  initialAttempt,
  accessToken,
  onSessionExpired,
}: Props) {
  const [searchParams] = useSearchParams();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [text, setText] = useState(() => restoredText(initialAttempt));
  const [savedText, setSavedText] = useState(() =>
    restoredText(initialAttempt),
  );
  const [lockVersion, setLockVersion] = useState(
    initialAttempt.attemptDraft?.lockVersion ?? 0,
  );
  const [selectedRevision, setSelectedRevision] = useState(() =>
    selectRevisionId(
      initialAttempt.submissionRevisions,
      searchParams.get("revision"),
    ),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [feedbackByRevision, setFeedbackByRevision] = useState<
    Record<string, boolean>
  >({});
  const action = useRef(false);

  const dirty = text !== savedText;
  const version = attempt.assignmentVersion;
  const expired =
    !!attempt.expiresAt && new Date(attempt.expiresAt).getTime() <= now;
  const pastDue =
    !!version.dueAt &&
    !version.allowLate &&
    new Date(version.dueAt).getTime() < now;
  const editing = attempt.status === "IN_PROGRESS";
  const canEdit = editing && !expired && !pastDue;
  const canSubmit =
    canEdit && !busy && !conflict && !uncertain && !!text.trim();
  const revisions = [...attempt.submissionRevisions].sort(
    (a, b) => b.revisionNo - a.revisionNo,
  );
  const nextRevision = (revisions[0]?.revisionNo ?? 0) + 1;
  const canRevise =
    attempt.status === "SUBMITTED" &&
    !pastDue &&
    nextRevision <= version.maxRevisions;
  const selectedRevisionObj =
    revisions.find((revision) => revision.id === selectedRevision) ??
    revisions[0];

  const handleFeedbackStatusChange = useCallback(
    (revisionId: string, hasFeedback: boolean) => {
      setFeedbackByRevision((previous) =>
        previous[revisionId] === hasFeedback
          ? previous
          : { ...previous, [revisionId]: hasFeedback },
      );
    },
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function failed(cause: unknown) {
    setError(
      cause instanceof Error
        ? cause.message
        : "The request could not be completed.",
    );
    if (cause instanceof StudentApiError && cause.status === 401)
      onSessionExpired?.();
  }

  async function checkStatus(reloadDraft = false) {
    if (action.current) return;
    if (
      reloadDraft &&
      dirty &&
      !window.confirm(
        "Replace your unsaved editor text with the saved draft? Copy any text you want to keep first.",
      )
    )
      return;
    action.current = true;
    setBusy("checking");
    setError("");
    setSaveError("");
    setSubmitError("");
    try {
      const latest = await getStudentAttempt(attempt.id, accessToken);
      setAttempt(latest);
      if (!selectedRevision || latest.status === "SUBMITTED") {
        setSelectedRevision(
          selectRevisionId(latest.submissionRevisions, selectedRevision),
        );
      }
      if (reloadDraft) {
        const restored = restoredText(latest);
        setText(restored);
        setSavedText(restored);
        setLockVersion(latest.attemptDraft?.lockVersion ?? 0);
        setConflict(false);
        setMessage("The saved draft and attempt status have been loaded.");
      } else {
        const changed =
          latest.status === "IN_PROGRESS" &&
          (latest.attemptDraft?.lockVersion ?? 0) !== lockVersion;
        setConflict(changed);
        setMessage(
          changed
            ? "The saved draft changed elsewhere. Copy your editor text, then load the saved draft before saving again."
            : "The latest attempt status has been checked. Your editor text was preserved.",
        );
      }
      setUncertain(false);
    } catch (cause) {
      failed(cause);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  async function save() {
    if (action.current || !canEdit || conflict || uncertain) return;
    action.current = true;
    setBusy("saving");
    setError("");
    setSaveError("");
    setSubmitError("");
    setMessage("");
    const snapshot = text;
    try {
      const result = await saveWritingDraft(
        attempt.id,
        accessToken,
        lockVersion,
        snapshot,
      );
      setLockVersion(result.lockVersion);
      setSavedText(snapshot);
      setMessage("Draft saved.");
    } catch (cause) {
      const reason =
        cause instanceof Error
          ? cause.message
          : "Unable to save your draft.";
      setSaveError(reason);
      if (cause instanceof StudentApiError && cause.status === 401)
        onSessionExpired?.();
      if (
        !(cause instanceof StudentApiError) ||
        cause.status === 409 ||
        cause.status >= 500
      )
        setConflict(true);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  async function submit() {
    if (action.current || !canSubmit) return;
    if (
      !window.confirm(
        `Submit revision ${nextRevision}? Your submitted text will be saved as a fixed revision.`,
      )
    )
      return;
    action.current = true;
    setBusy("submitting");
    setError("");
    setSaveError("");
    setSubmitError("");
    setMessage("");
    try {
      const receipt = await submitWriting(attempt, accessToken, text);
      if (
        attempt.submissionRevisions.some(
          (item) => item.id === receipt.revisionId,
        )
      ) {
        try {
          const latestAttempt = await getStudentAttempt(attempt.id, accessToken);
          setAttempt(latestAttempt);
          if (latestAttempt.status !== "SUBMITTED") {
            setSubmitError(
              "No new revision was recorded. Please revise your essay before submitting a new revision.",
            );
            return;
          }
          const matchedNewRevision = latestAttempt.submissionRevisions.find(
            (item) =>
              item.id === receipt.revisionId &&
              item.revisionNo === nextRevision,
          );
          if (matchedNewRevision) {
            setSavedText(text);
            setSelectedRevision(matchedNewRevision.id);
            setMessage(
              "Your essay has been submitted. Feedback will update automatically below.",
            );
            return;
          }
          setSelectedRevision(
            selectRevisionId(latestAttempt.submissionRevisions, null),
          );
          setMessage(
            "This attempt was already updated. Showing the latest submission confirmed by the server.",
          );
          return;
        } catch {
          setUncertain(true);
          setSubmitError(
            "Submission status could not be confirmed. Check current status before trying again.",
          );
          return;
        }
      }
      setSavedText(text);
      setSelectedRevision(receipt.revisionId);
      setAttempt((previous) => ({
        ...previous,
        status: "SUBMITTED",
        submissionRevisions: previous.submissionRevisions.some(
          (item) => item.id === receipt.revisionId,
        )
          ? previous.submissionRevisions
          : [
              {
                id: receipt.revisionId,
                revisionNo: nextRevision,
                submittedAt: new Date().toISOString(),
              },
              ...previous.submissionRevisions,
            ],
      }));
      setMessage(
        "Your essay has been submitted. Feedback will update automatically below.",
      );
      try {
        setAttempt(await getStudentAttempt(attempt.id, accessToken));
      } catch {
        setMessage(
          "Your essay was submitted successfully. Check the attempt status to refresh its revision history.",
        );
      }
    } catch (cause) {
      if (
        cause instanceof StudentApiError &&
        cause.status === 409 &&
        cause.message.toLowerCase().includes("revise your essay")
      ) {
        setUncertain(false);
        setSubmitError(cause.message);
        return;
      }
      failed(cause);
      if (
        !(cause instanceof StudentApiError) ||
        cause.status === 409 ||
        cause.status >= 500
      ) {
        setUncertain(true);
        setMessage(
          "Check the latest attempt status before submitting again. Your editor text is still here.",
        );
      }
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  async function revise() {
    if (action.current || !canRevise || uncertain) return;
    action.current = true;
    setBusy("revising");
    setError("");
    setSaveError("");
    setMessage("");
    try {
      await reopenWriting(attempt.id, accessToken);
      const latest = await getStudentAttempt(attempt.id, accessToken);
      const draft = restoredText(latest);
      setAttempt(latest);
      setText(draft);
      setSavedText(draft);
      setLockVersion(latest.attemptDraft?.lockVersion ?? 0);
      setConflict(false);
      setUncertain(false);
      setSubmitError("");
      setMessage(
        "A new draft is open using your latest essay. Earlier submissions remain available in revision history.",
      );
    } catch (cause) {
      failed(cause);
      setUncertain(true);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  function protectNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm(
        "Your editor has unsaved changes. Leave without saving them?",
      )
    )
      event.preventDefault();
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const draftBadge = saveError
    ? {
        label: "Save failed",
        className: "border border-red-200 bg-red-50 text-red-700",
      }
    : busy === "saving"
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

  const selectedFeedbackKnown = selectedRevision
    ? feedbackByRevision[selectedRevision]
    : undefined;
  const hasConfirmedFeedback = revisions.some(
    (revision) => feedbackByRevision[revision.id] === true,
  );

  return (
    <div
      className={`${editing ? "student-surface-attempt-active" : "student-surface-attempt-review"} min-h-[calc(100vh-4rem)]`}
    >
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-8 sm:py-8">
      <nav aria-label="Writing practice navigation">
        <Link
          onClick={protectNavigation}
          to={`/courses/${encodeURIComponent(version.assignment.courseId)}`}
          className="inline-flex text-sm font-semibold text-[#2563eb] hover:underline"
        >
          ← Back to course overview
        </Link>
      </nav>

      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">
            {editing
              ? canEdit
                ? revisions.length > 0
                  ? "Writing practice · Preparing new revision"
                  : "Writing practice · Writing draft"
                : "Writing practice · Editing window closed"
              : revisions.length === 0
                ? "Writing practice · Attempt closed"
                : canRevise
                  ? "Writing practice · Reviewing submission"
                  : "Writing practice · Reviewing final submission"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                editing
                  ? canEdit
                    ? "border border-blue-200 bg-blue-50 text-[#1e40af]"
                    : "border border-amber-200 bg-amber-50 text-amber-800"
                  : revisions.length > 0
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {editing
                ? canEdit
                  ? `Editing revision ${nextRevision} draft`
                  : pastDue
                    ? "Deadline passed — Read only"
                    : "Time limit expired — Read only"
                : revisions.length > 0
                  ? `Viewing submitted revision ${selectedRevisionObj?.revisionNo ?? 1}`
                  : "Attempt closed — Read only"}
            </span>
            {editing && revisions.length > 0 && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {hasConfirmedFeedback
                  ? "Earlier feedback available below"
                  : "Earlier submissions below"}
              </span>
            )}
            {!editing && revisions.length > 0 && !canRevise && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {pastDue
                  ? "Deadline passed"
                  : nextRevision > version.maxRevisions
                    ? "All revisions used"
                    : "Attempt closed"}
              </span>
            )}
          </div>
        </div>
        <h1 className="mt-1.5 text-2xl font-bold text-[#0f172a]">
          {version.assignment.title}
        </h1>
        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {editing
            ? canEdit
              ? revisions.length > 0
                ? hasConfirmedFeedback
                  ? "Save your draft anytime or submit when ready. Confirmed feedback from earlier revisions is below."
                  : "Save your draft anytime or submit when ready. Your earlier submitted revisions are available below."
                : "Save your draft anytime or submit when ready for evaluation."
              : "Your saved draft is preserved below in read-only mode."
            : revisions.length === 0
              ? "No revisions were submitted before this attempt closed."
              : canRevise
                ? "Review your submission and evaluation details below, or start a new revision when ready."
                : "Review your submitted essay and evaluation details below."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
          <span className="font-semibold text-[#0f172a]">
            Attempt {attempt.attemptNo}
          </span>
          <span>
            {revisions.length} / {version.maxRevisions} revisions submitted
          </span>
          {attempt.expiresAt && editing && (
            <span>
              Editing ends: {new Date(attempt.expiresAt).toLocaleString()}
            </span>
          )}
          {version.dueAt && (
            <span>Due: {new Date(version.dueAt).toLocaleString()}</span>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          {message}
        </p>
      )}
      {(conflict || uncertain) && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Your editor text is preserved. Check the current status before
            continuing; load the saved draft only when you are ready to replace
            the editor text.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!!busy}
              onClick={() => void checkStatus()}
              className="font-semibold underline"
            >
              Check current status
            </button>
            <button
              disabled={!!busy}
              onClick={() => void checkStatus(true)}
              className="font-semibold underline"
            >
              Load saved draft
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-6">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-slate-200 border-l-4 border-l-slate-300 bg-[#f8fafc] p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#0f172a]">Writing task</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                {version.activityVersion.promptText}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {version.activityVersion.instructions}
              </p>
              {version.rubricVersion && (
                <p className="text-xs text-slate-500">
                  {version.rubricVersion.rubricCode} · version{" "}
                  {version.rubricVersion.versionNo}
                </p>
              )}
            </section>

            <section
              className={`space-y-4 rounded-xl border bg-white p-5 shadow-sm sm:p-6 ${
                canEdit
                  ? "border-blue-200/90 ring-1 ring-blue-50"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#0f172a]">
                    Revision {nextRevision} draft
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      canEdit
                        ? "bg-blue-50 text-[#1e40af]"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {canEdit ? "Active draft" : "Editing closed"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-slate-500">
                    {wordCount} words
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${draftBadge.className}`}
                  >
                    {draftBadge.label}
                  </span>
                </div>
              </div>
              <label className="block">
                <span className="sr-only">Your essay</span>
                <textarea
                  value={text}
                  maxLength={100000}
                  rows={18}
                  disabled={
                    !canEdit || busy === "submitting" || busy === "revising"
                  }
                  onChange={(event) => {
                    setText(event.target.value);
                    setSaveError("");
                    setSubmitError("");
                    setMessage("");
                  }}
                  className="w-full rounded-lg border border-slate-300 p-4 text-sm leading-7 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </label>
              <p className="text-xs text-slate-500">
                Save your draft before leaving. Submitting creates a fixed
                revision that can be reviewed separately.
              </p>
              {(expired || pastDue) && (
                <p className="text-sm text-amber-800">
                  The editing window has ended. Your saved draft is retained;
                  contact your instructor if you need more time.
                </p>
              )}
              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      !canEdit || !!busy || conflict || uncertain || !dirty
                    }
                    onClick={() => void save()}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy === "saving" ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => void submit()}
                    className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy === "submitting" ? "Submitting..." : "Submit essay"}
                  </button>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${draftBadge.className}`}
                  >
                    {draftBadge.label}
                  </span>
                </div>
                {saveError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                  >
                    Save failed: {saveError}
                  </p>
                )}
                {submitError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                  >
                    {submitError}
                  </p>
                )}
              </div>
            </section>
          </div>

          {revisions.length > 0 && (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#0f172a]">
                    Earlier submissions
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {canEdit
                      ? `Viewing submitted Revision ${selectedRevisionObj?.revisionNo ?? 1} while drafting Revision ${nextRevision}`
                      : `Viewing submitted Revision ${selectedRevisionObj?.revisionNo ?? 1} (Revision ${nextRevision} draft is read-only)`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {revisions.map((revision) => (
                    <button
                      key={revision.id}
                      type="button"
                      onClick={() => setSelectedRevision(revision.id)}
                      aria-pressed={selectedRevision === revision.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        selectedRevision === revision.id
                          ? "border-blue-300 bg-blue-50 text-blue-800"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      Revision {revision.revisionNo} ·{" "}
                      {new Date(revision.submittedAt).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
              {selectedRevision && (
                <WritingFeedbackPanel
                  key={selectedRevision}
                  revisionId={selectedRevision}
                  attemptId={attempt.id}
                  accessToken={accessToken}
                  compact={true}
                  onSessionExpired={onSessionExpired}
                  onFeedbackStatusChange={handleFeedbackStatusChange}
                />
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f172a]">
                  Revision history
                </h2>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Select a submitted revision to view its status, feedback, and
                  submitted essay.
                </p>
              </div>
              {revisions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {revisions.map((revision, index) => (
                    <button
                      key={revision.id}
                      type="button"
                      onClick={() => setSelectedRevision(revision.id)}
                      aria-pressed={selectedRevision === revision.id}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        selectedRevision === revision.id
                          ? "border-[#2563eb] bg-[#eff6ff] text-[#1e40af]"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Revision {revision.revisionNo}
                      {index === 0 ? " (Latest)" : ""}
                      <span className="mt-0.5 block font-normal text-slate-500">
                        {new Date(revision.submittedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!revisions.length && (
              <p className="mt-3 text-sm text-slate-500">
                Submit your first essay to receive feedback.
              </p>
            )}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="min-w-0">
              {selectedRevision && (
                <WritingFeedbackPanel
                  key={selectedRevision}
                  revisionId={selectedRevision}
                  attemptId={attempt.id}
                  accessToken={accessToken}
                  onSessionExpired={onSessionExpired}
                  onFeedbackStatusChange={handleFeedbackStatusChange}
                />
              )}
            </div>

            <aside className="space-y-5">
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#0f172a]">
                  Continue improving your essay
                </h2>
                {canRevise ? (
                  <>
                    <p className="text-sm leading-6 text-slate-600">
                      {selectedFeedbackKnown === true
                        ? `Use your feedback to prepare revision ${nextRevision}. Earlier text and assessments remain available in the revision history.`
                        : selectedFeedbackKnown === false
                          ? `Feedback is not ready yet. You can still start revision ${nextRevision} from your latest submitted essay, or wait for feedback first.`
                          : `Prepare revision ${nextRevision} from your latest submitted essay. Earlier submissions remain in your revision history.`}
                    </p>
                    <button
                      type="button"
                      disabled={!!busy || uncertain}
                      onClick={() => void revise()}
                      className="w-full rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy === "revising"
                        ? "Opening draft..."
                        : "Write a new revision"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    {pastDue
                      ? "The submission deadline has passed."
                      : nextRevision > version.maxRevisions
                        ? "You have used all revisions allowed for this attempt."
                        : "This attempt is closed."}
                  </p>
                )}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <Link
                    onClick={protectNavigation}
                    to="/learning"
                    className="block text-sm font-semibold text-[#2563eb] hover:underline"
                  >
                    Explore skills & suggested practice →
                  </Link>
                  <Link
                    onClick={protectNavigation}
                    to="/practice-history"
                    className="block text-sm font-semibold text-slate-600 hover:text-[#2563eb] hover:underline"
                  >
                    View all attempts in practice history →
                  </Link>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-[#0f172a] [&::-webkit-details-marker]:hidden">
                    <span>Writing task prompt</span>
                    <span className="text-xs font-semibold text-[#2563eb] group-open:hidden">
                      Show prompt
                    </span>
                    <span className="hidden text-xs font-semibold text-slate-500 group-open:inline">
                      Hide prompt
                    </span>
                  </summary>
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {version.activityVersion.promptText}
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-6 text-slate-500">
                      {version.activityVersion.instructions}
                    </p>
                    {version.rubricVersion && (
                      <p className="text-xs text-slate-500">
                        {version.rubricVersion.rubricCode} · version{" "}
                        {version.rubricVersion.versionNo}
                      </p>
                    )}
                  </div>
                </details>
              </section>
            </aside>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
