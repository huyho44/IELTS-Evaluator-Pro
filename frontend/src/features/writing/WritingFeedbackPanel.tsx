import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StudentApiError } from "../../lib/api/studentRequest";
import {
  appealWriting,
  getWritingAssessments,
  getWritingRevision,
  requestWritingReview,
  type WritingAssessment,
  type WritingRevision,
} from "./writingApi";

type Props = {
  revisionId: string;
  attemptId: string;
  accessToken: string;
  onSessionExpired?: () => void;
};
const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function WritingFeedbackPanel({
  revisionId,
  attemptId,
  accessToken,
  onSessionExpired,
}: Props) {
  const [revision, setRevision] = useState<WritingRevision | null>(null);
  const [assessments, setAssessments] = useState<WritingAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [submittedAppealId, setSubmittedAppealId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const action = useRef(false);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      if (!active || inFlight) return;
      if (document.hidden) {
        timer = setTimeout(() => void refresh(), 10000);
        return;
      }
      inFlight = true;
      let monitor = true;
      try {
        const [content, feedback] = await Promise.all([
          getWritingRevision(
            revisionId,
            attemptId,
            accessToken,
            controller.signal,
          ),
          getWritingAssessments(revisionId, accessToken, controller.signal),
        ]);
        if (!active) return;
        setRevision(content);
        setAssessments(feedback);
        setRefreshError("");
        monitor =
          !feedback.some((item) => item.isOfficial) ||
          feedback.some((item) =>
            item.acceptedAssessment?.appeals?.some((appeal) =>
              ["PENDING", "IN_REVIEW"].includes(appeal.status),
            ),
          );
      } catch (cause) {
        if (!active) return;
        setRefreshError(
          cause instanceof Error
            ? cause.message
            : "Unable to refresh feedback.",
        );
        if (cause instanceof StudentApiError && cause.status === 401)
          onSessionExpired?.();
        if (
          cause instanceof StudentApiError &&
          [401, 403, 404].includes(cause.status)
        )
          monitor = false;
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (monitor) timer = setTimeout(() => void refresh(), 10000);
        }
      }
    }
    const onVisible = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        void refresh();
      }
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [revisionId, attemptId, accessToken, onSessionExpired, reloadKey]);

  const official = assessments.find((item) => item.isOfficial);
  const appeals = official?.acceptedAssessment?.appeals ?? [];
  const pendingAppeal =
    appeals.some((item) => ["PENDING", "IN_REVIEW"].includes(item.status)) ||
    (!!submittedAppealId &&
      !appeals.some((item) => item.id === submittedAppealId));
  const reviewPending = requested || !!revision?.processing.reviewCaseId;
  async function handleRequest() {
    if (action.current || !revision || !reason.trim()) return;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (official?.acceptedAssessment) {
        const result = await appealWriting(
          official.acceptedAssessment.id,
          reason,
          accessToken,
        );
        setSubmittedAppealId(String(result.id));
        setMessage(
          "Your request to review this published assessment has been sent.",
        );
      } else {
        await requestWritingReview(revisionId, reason, accessToken);
        setRequested(true);
        setMessage(
          "Your instructor review request has been sent. AI feedback remains provisional.",
        );
      }
      setReason("");
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to request a review.",
      );
      if (cause instanceof StudentApiError && cause.status === 401)
        onSessionExpired?.();
      if (cause instanceof StudentApiError && cause.status === 409)
        setReloadKey((value) => value + 1);
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Feedback for this revision</h2>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="text-sm font-semibold text-blue-600"
        >
          Refresh feedback
        </button>
      </div>
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading submission and feedback...
        </p>
      )}
      {refreshError && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          {refreshError}{" "}
          {revision && "Previously loaded feedback is shown below."}
        </p>
      )}
      {revision && (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Revision {revision.revisionNo}</span>
            <span>
              Submitted {new Date(revision.submittedAt).toLocaleString()}
            </span>
          </div>
          {!assessments.length && (
            <p
              role="status"
              className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900"
            >
              {["QUEUED", "RUNNING"].includes(revision.processing.status)
                ? "Your essay is being assessed. Feedback will appear here when it is available."
                : revision.processing.status === "FAILED"
                  ? "Automated assessment could not complete. An instructor can review your essay."
                  : "Your essay has been received. Feedback is awaiting instructor review or its release time."}
            </p>
          )}
          {assessments.map((assessment) => (
            <article
              key={assessment.id}
              className="space-y-4 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${assessment.isOfficial ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                >
                  {assessment.isOfficial
                    ? "Published instructor assessment"
                    : "Provisional AI feedback"}
                </span>
                {assessment.overallScore !== null && (
                  <p className="text-2xl font-bold">
                    Band {Number(assessment.overallScore).toFixed(1)}
                  </p>
                )}
              </div>
              {!assessment.isOfficial && (
                <p className="text-xs leading-5 text-slate-500">
                  AI feedback is an estimate. Your instructor's published
                  assessment is the confirmed result.
                </p>
              )}
              {assessment.summary && (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {assessment.summary}
                </p>
              )}
              <dl className="grid gap-3 sm:grid-cols-2">
                {assessment.criterionScores.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="rounded-lg bg-slate-50 p-3"
                  >
                    <dt className="text-sm font-semibold">
                      {criterion.criterion.code} · {criterion.criterion.name}
                    </dt>
                    <dd className="mt-1 text-lg font-bold">
                      {Number(criterion.score).toFixed(1)}
                    </dd>
                    {criterion.explanation && (
                      <dd className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {criterion.explanation}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
              {!!assessment.findings.length && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold">Feedback and evidence</h3>
                  {assessment.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="border-t border-slate-100 pt-3"
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {finding.explanation}
                      </p>
                      {finding.findingAnchors.map((anchor, index) => {
                        const paragraph = revision.paragraphs.find(
                          (item) => item.id === anchor.paragraphId,
                        );
                        return (
                          <blockquote
                            key={`${anchor.paragraphId}-${index}`}
                            className="mt-2 border-l-2 border-blue-200 pl-3 text-xs leading-5 text-slate-600"
                          >
                            <span className="font-semibold">
                              {paragraph
                                ? `Paragraph ${paragraph.paragraphNo}: `
                                : "Quoted evidence: "}
                            </span>
                            {anchor.exactQuote}
                          </blockquote>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          <details className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Read submitted revision {revision.revisionNo}
            </summary>
            <div className="mt-4 space-y-4">
              {revision.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.id}
                  className="whitespace-pre-wrap text-sm leading-7"
                >
                  <span className="mb-1 block text-xs font-semibold text-slate-400">
                    Paragraph {paragraph.paragraphNo}
                  </span>
                  {paragraph.text}
                </p>
              ))}
              {!revision.paragraphs.length && (
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {revision.writingText}
                </p>
              )}
            </div>
          </details>
          {!!appeals.length && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold">Review requests</h3>
              {appeals.map((appeal) => (
                <div
                  key={appeal.id}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {appeal.status.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{appeal.reason}</p>
                  {appeal.resolution && (
                    <p className="mt-2 whitespace-pre-wrap text-slate-600">
                      Instructor response: {appeal.resolution}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
          {((official && !pendingAppeal) ||
            (!official &&
              !reviewPending &&
              !["QUEUED", "RUNNING"].includes(revision.processing.status))) && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleRequest();
              }}
              className="space-y-3 border-t border-slate-100 pt-4"
            >
              <label className="block text-sm font-semibold">
                {official
                  ? "Request a review of this published assessment"
                  : "Ask your instructor to review this essay"}
                <textarea
                  required
                  maxLength={10000}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                  placeholder="Explain the feedback or score you would like your instructor to review."
                />
              </label>
              <button
                disabled={busy || !reason.trim()}
                className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send review request"}
              </button>
            </form>
          )}
          {((official && pendingAppeal) || (!official && reviewPending)) && (
            <p className="text-sm text-blue-700">
              Your instructor review is pending. You can return here to check
              its outcome.
            </p>
          )}
          <Link
            to="/learning"
            className="block text-sm font-semibold text-blue-600"
          >
            Explore your skills and suggested practice →
          </Link>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {message}
        </p>
      )}
    </section>
  );
}
