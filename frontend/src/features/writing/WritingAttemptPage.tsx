import { useEffect, useRef, useState } from "react";
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
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(Date.now);
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
    try {
      const latest = await getStudentAttempt(attempt.id, accessToken);
      setAttempt(latest);
      if (!selectedRevision || latest.status === "SUBMITTED")
        setSelectedRevision(latest.submissionRevisions[0]?.id ?? "");
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
      setMessage("Your draft has been saved.");
    } catch (cause) {
      failed(cause);
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
    setMessage("");
    try {
      const receipt = await submitWriting(attempt, accessToken, text);
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
      setMessage(
        "A new draft is open using your latest essay. Earlier submissions and feedback are preserved.",
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
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <nav className="flex flex-wrap justify-between gap-3 text-sm font-semibold text-blue-600">
        <Link
          onClick={protectNavigation}
          to={`/courses/${encodeURIComponent(version.assignment.courseId)}`}
        >
          ← Back to course
        </Link>
        <Link onClick={protectNavigation} to="/practice-history">
          My practice attempts
        </Link>
      </nav>
      <header className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
          Writing practice
        </span>
        <h1 className="mt-2 text-2xl font-bold">{version.assignment.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Attempt {attempt.attemptNo}</span>
          <span>{attempt.status.replaceAll("_", " ")}</span>
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
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900"
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
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">Writing task</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {version.activityVersion.promptText}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-500">
              {version.activityVersion.instructions}
            </p>
            {version.rubricVersion && (
              <p className="text-xs text-slate-500">
                {version.rubricVersion.rubricCode} · version{" "}
                {version.rubricVersion.versionNo}
              </p>
            )}
          </section>
          {editing && (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">
                  Revision {nextRevision} draft
                </h2>
                <span className="text-xs text-slate-500">
                  {text.trim() ? text.trim().split(/\s+/).length : 0} words ·{" "}
                  {dirty
                    ? "Unsaved changes"
                    : lockVersion > 0
                      ? "Draft saved"
                      : "Not saved yet"}
                </span>
              </div>
              <label className="block">
                <span className="sr-only">Your essay</span>
                <textarea
                  value={text}
                  maxLength={100000}
                  rows={20}
                  disabled={
                    !canEdit || busy === "submitting" || busy === "revising"
                  }
                  onChange={(event) => setText(event.target.value)}
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
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={
                    !canEdit || !!busy || conflict || uncertain || !dirty
                  }
                  onClick={() => void save()}
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
                >
                  {busy === "saving" ? "Saving..." : "Save draft"}
                </button>
                <button
                  disabled={!canSubmit}
                  onClick={() => void submit()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "submitting" ? "Submitting..." : "Submit essay"}
                </button>
              </div>
            </section>
          )}
          {!editing && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold">
                Continue improving your essay
              </h2>
              {canRevise ? (
                <>
                  <p className="text-sm leading-6 text-slate-600">
                    Use your feedback to prepare revision {nextRevision}.
                    Earlier text and assessments remain available in the
                    revision history.
                  </p>
                  <button
                    disabled={!!busy || uncertain}
                    onClick={() => void revise()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
              <Link
                onClick={protectNavigation}
                to="/learning"
                className="block text-sm font-semibold text-blue-600"
              >
                Find suggested practice and a new learning opportunity →
              </Link>
            </section>
          )}
        </div>
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">Revision history</h2>
            {revisions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {revisions.map((revision) => (
                  <button
                    key={revision.id}
                    onClick={() => setSelectedRevision(revision.id)}
                    aria-pressed={selectedRevision === revision.id}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selectedRevision === revision.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600"}`}
                  >
                    Revision {revision.revisionNo}
                    <span className="mt-1 block font-normal">
                      {new Date(revision.submittedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Submit your first essay to receive feedback.
              </p>
            )}
          </section>
          {selectedRevision && (
            <WritingFeedbackPanel
              key={selectedRevision}
              revisionId={selectedRevision}
              attemptId={attempt.id}
              accessToken={accessToken}
              onSessionExpired={onSessionExpired}
            />
          )}
        </div>
      </div>
    </main>
  );
}
