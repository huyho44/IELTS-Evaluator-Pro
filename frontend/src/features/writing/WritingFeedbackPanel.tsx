import { useEffect, useRef, useState } from "react";
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
  compact?: boolean;
  onSessionExpired?: () => void;
  onFeedbackStatusChange?: (revisionId: string, hasFeedback: boolean) => void;
};

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function WritingFeedbackPanel({
  revisionId,
  attemptId,
  accessToken,
  compact = false,
  onSessionExpired,
  onFeedbackStatusChange,
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
  const feedbackCallbackRef = useRef(onFeedbackStatusChange);

  useEffect(() => {
    feedbackCallbackRef.current = onFeedbackStatusChange;
  }, [onFeedbackStatusChange]);

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
        feedbackCallbackRef.current?.(revisionId, feedback.length > 0);
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
  const hasProvisionalAi = assessments.some((item) => !item.isOfficial);
  const appeals = official?.acceptedAssessment?.appeals ?? [];
  const pendingAppeal =
    appeals.some((item) => ["PENDING", "IN_REVIEW"].includes(item.status)) ||
    (!!submittedAppealId &&
      !appeals.some((item) => item.id === submittedAppealId));
  const reviewPending = requested || !!revision?.processing.reviewCaseId;
  const isProcessing =
    !!revision && ["QUEUED", "RUNNING"].includes(revision.processing.status);
  const processingFailed = revision?.processing.status === "FAILED";
  const awaitingInstructorReview = !official && reviewPending;
  const topAccentClass = official
    ? "border-t-4 border-t-emerald-500"
    : hasProvisionalAi
      ? "border-t-4 border-t-amber-500"
      : processingFailed
        ? "border-t-4 border-t-rose-500"
        : "border-t-4 border-t-brand-600";
  const primaryStatus = official
    ? {
        label: "Official instructor assessment",
        className:
          "border border-emerald-200 bg-emerald-50 text-emerald-800",
      }
    : hasProvisionalAi
      ? {
          label: "Provisional AI feedback",
          className: "border border-amber-200 bg-amber-50 text-amber-900",
        }
      : processingFailed
        ? {
            label: "Automated assessment failed",
            className: "border border-rose-200 bg-rose-50 text-rose-800",
          }
        : awaitingInstructorReview
          ? {
              label: "Awaiting instructor review",
              className:
                "border border-indigo-200 bg-indigo-50 text-indigo-800",
            }
          : isProcessing
            ? {
                label: "Evaluating essay automatically",
                className: "border border-brand-200 bg-brand-50 text-brand-800",
              }
            : {
                label: "Awaiting evaluation",
                className: "border border-slate-200 bg-slate-100 text-slate-700",
              };
  const essayText = revision
    ? revision.writingText ||
      revision.paragraphs.map((item) => item.text).join("\n\n")
    : "";
  const essayWordCount = essayText.trim()
    ? essayText.trim().split(/\s+/).length
    : 0;
  const essayParagraphCount = revision
    ? revision.paragraphs.length ||
      (essayText.trim()
        ? essayText.trim().split(/\n\s*\n/).filter(Boolean).length
        : 0)
    : 0;

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
    <div className="space-y-5">
      <section
        aria-labelledby="feedback-panel-heading"
        className={`space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${topAccentClass}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="feedback-panel-heading"
                className="text-lg font-bold text-slate-900"
              >
                {revision
                  ? `Feedback · Revision ${revision.revisionNo}`
                  : "Feedback"}
              </h2>
              {revision && (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${primaryStatus.className}`}
                >
                  {primaryStatus.label}
                </span>
              )}
              {official && pendingAppeal && (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  Appeal in review
                </span>
              )}
            </div>
            {revision && (
              <p className="text-xs text-slate-500">
                Submitted {new Date(revision.submittedAt).toLocaleString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="shrink-0 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-50"
          >
            {assessments.length > 0 ? "Refresh feedback" : "Check for feedback"}
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
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {refreshError}{" "}
            {revision && "Previously loaded feedback is shown below."}
          </p>
        )}

        {revision && (
          <>
            {!assessments.length && (
              <div
                role="status"
                className={`rounded-xl border p-4 sm:p-5 ${
                  processingFailed
                    ? "border-rose-200 bg-rose-50/70 text-rose-900"
                    : awaitingInstructorReview
                      ? "border-indigo-200 bg-indigo-50/70 text-indigo-950"
                      : "border-brand-200 bg-brand-50/80 text-slate-900"
                }`}
              >
                <p className="text-sm font-semibold">
                  {isProcessing
                    ? "Automated assessment is running"
                    : processingFailed
                      ? "Automated assessment could not complete"
                      : awaitingInstructorReview
                        ? "Instructor review requested"
                        : "Evaluation pending"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {isProcessing
                    ? "Your essay is being assessed automatically. Feedback will appear here once processing completes."
                    : processingFailed
                      ? "The automated check could not complete for this revision. You can request an instructor review below."
                      : awaitingInstructorReview
                        ? "Your essay has been received and is awaiting instructor review."
                        : "Your essay has been received. No feedback has been released for this revision yet."}
                </p>
              </div>
            )}

            {assessments.map((assessment) => (
              <article
                key={assessment.id}
                className={`space-y-4 rounded-xl border p-4 sm:p-5 ${
                  assessment.isOfficial
                    ? "border-emerald-200 bg-emerald-50/20"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3.5">
                  <div className="space-y-1">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        assessment.isOfficial
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {assessment.isOfficial
                        ? "Official"
                        : "Provisional AI feedback"}
                    </span>
                    {!assessment.isOfficial && (
                      <p className="text-xs leading-5 text-slate-500">
                        AI feedback is an estimate. Only a published instructor
                        decision is official.
                      </p>
                    )}
                  </div>
                  {assessment.overallScore !== null && (
                    <div className="text-right">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Overall band
                      </span>
                      <p className="text-3xl font-bold tracking-tight text-slate-900">
                        Band {Number(assessment.overallScore).toFixed(1)}
                      </p>
                    </div>
                  )}
                </div>

                {assessment.summary && (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {assessment.summary}
                  </p>
                )}

                <dl className="grid gap-3 sm:grid-cols-2">
                  {assessment.criterionScores.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <dt className="text-xs font-semibold text-slate-900">
                          {criterion.criterion.code} · {criterion.criterion.name}
                        </dt>
                        <dd className="shrink-0 rounded-md bg-white px-2 py-0.5 text-sm font-bold text-brand-800 shadow-sm">
                          {Number(criterion.score).toFixed(1)}
                        </dd>
                      </div>
                      {criterion.explanation && (
                        <dd className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                          {criterion.explanation}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>

                {!!assessment.findings.length && (
                  <div className="space-y-3 pt-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Feedback and quoted evidence
                    </h3>
                    <div className="space-y-3">
                      {assessment.findings.map((finding) => (
                        <div
                          key={finding.id}
                          className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3.5"
                        >
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                            {finding.explanation}
                          </p>
                          {finding.findingAnchors.map((anchor, index) => {
                            const paragraph = revision.paragraphs.find(
                              (item) => item.id === anchor.paragraphId,
                            );
                            return (
                              <blockquote
                                key={`${anchor.paragraphId}-${index}`}
                                className="rounded-r-lg border-l-4 border-brand-600 bg-brand-50/50 px-3 py-2 text-xs leading-5 text-slate-700"
                              >
                                <span className="font-semibold text-brand-800">
                                  {paragraph
                                    ? `Paragraph ${paragraph.paragraphNo}: `
                                    : "Quoted evidence: "}
                                </span>
                                “{anchor.exactQuote}”
                              </blockquote>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}

            {!!appeals.length && (
              <section className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Review requests
                </h3>
                {appeals.map((appeal) => (
                  <div
                    key={appeal.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {appeal.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">
                      {appeal.reason}
                    </p>
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
                !["QUEUED", "RUNNING"].includes(
                  revision.processing.status,
                ))) && (
              <details
                open={Boolean(reason || error || message)}
                className="group border-t border-slate-100 pt-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100/70 [&::-webkit-details-marker]:hidden">
                  <span>
                    {official
                      ? "Need a second look? Request an appeal review"
                      : "Want an instructor to check this essay?"}
                  </span>
                  <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-brand-800 group-open:hidden">
                    Open form
                  </span>
                  <span className="hidden rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 group-open:inline">
                    Close
                  </span>
                </summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRequest();
                  }}
                  className="mt-3 space-y-3 rounded-lg border border-slate-200/80 bg-white p-4"
                >
                  <label className="block text-sm font-semibold text-slate-900">
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
                    className="rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {busy ? "Sending..." : "Send review request"}
                  </button>
                </form>
              </details>
            )}

            {((official && pendingAppeal) ||
              (!official &&
                reviewPending &&
                (assessments.length > 0 || !awaitingInstructorReview))) && (
              <p className="rounded-lg bg-brand-50/70 px-3.5 py-2.5 text-sm text-brand-800">
                Your instructor review is pending. Return here later to check its
                outcome.
              </p>
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
          </>
        )}
      </section>

      {revision && (
        <section
          id="writing-submitted-essay"
          className="scroll-mt-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          <details open={!compact && !assessments.length} className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50 px-5 py-3.5 transition-colors hover:bg-slate-100/70 [&::-webkit-details-marker]:hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Submitted essay · Revision {revision.revisionNo}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {essayWordCount} {essayWordCount === 1 ? "word" : "words"} ·{" "}
                  {essayParagraphCount}{" "}
                  {essayParagraphCount === 1 ? "paragraph" : "paragraphs"}
                </span>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800 shadow-2xs group-open:hidden">
                Read submitted essay
              </span>
              <span className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs group-open:inline">
                Hide essay
              </span>
            </summary>
            <div className="space-y-4 p-5 sm:p-6">
              {revision.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.id}
                  className="whitespace-pre-wrap text-sm leading-7 text-slate-700"
                >
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Paragraph {paragraph.paragraphNo}
                  </span>
                  {paragraph.text}
                </p>
              ))}
              {!revision.paragraphs.length && (
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {revision.writingText}
                </p>
              )}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
