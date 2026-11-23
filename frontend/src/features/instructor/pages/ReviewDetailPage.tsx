import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useSession } from "../../auth/session";
import { instructorApi } from "../services/instructorApi";
import {
  acceptedAssessmentForReview,
  aiAssessment,
  buildConfirmPayload,
  canConfirmReview,
  createReviewForm,
  teacherAssessment,
  weightedOverall,
} from "../reviewForm";
import ReviewEvidenceEditor from "../ReviewEvidenceEditor";
import type {
  CriterionInput,
  FindingInput,
  ObservationInput,
  ReviewStatus,
  AcceptedAssessment,
  ReviewDetail,
} from "../types";
function errorMessage(cause: unknown): string {
  if (isAxiosError(cause)) {
    const message: unknown = cause.response?.data?.message;
    if (typeof message === "string") return message;
    if (!cause.response)
      return "Connection interrupted. Reload the review status before retrying.";
  }
  return cause instanceof Error ? cause.message : "The request failed.";
}
const statusLabels: Record<ReviewStatus, string> = {
  PENDING: "Pending claim",
  CLAIMED: "In progress",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  return (
    <ReviewDetailContent
      key={`${id ?? "missing"}:${session?.user.id ?? "guest"}`}
    />
  );
}

function ReviewDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [criteria, setCriteria] = useState<CriterionInput[]>([]);
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState<FindingInput[]>([]);
  const [observations, setObservations] = useState<ObservationInput[]>([]);
  const [accepted, setAccepted] = useState<AcceptedAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionReason, setActionReason] = useState("");

  async function reviewAction(action: "release" | "reopen" | "reject") {
    if (!review || actionInFlight.current || needsReload) return;
    if (!actionReason.trim()) {
      setError("Enter a reason for this action.");
      return;
    }
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "reopen") {
        const next = await instructorApi.reopenReview(
          review.id,
          actionReason.trim(),
        );
        navigate(`/teacher/reviews/${encodeURIComponent(next.id)}`);
      } else {
        if (action === "release")
          await instructorApi.releaseReview(
            review.id,
            review.lockVersion,
            actionReason.trim(),
          );
        else
          await instructorApi.rejectAppeal(
            review.id,
            review.lockVersion,
            actionReason.trim(),
          );
        setReloadKey((value) => value + 1);
        setMessage(
          action === "release"
            ? "Claim released."
            : "Appeal rejected; the published assessment is retained.",
        );
      }
      setActionReason("");
    } catch (cause) {
      setError(errorMessage(cause));
      setNeedsReload(true);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!id) throw new Error("Missing review ID.");
        const detail = await instructorApi.getReviewDetail(id);
        if (!active) return;
        const form = createReviewForm(detail);
        setReview(detail);
        setCriteria(form.criteria);
        setSummary(form.summary);
        setReason(form.reason);
        setFindings(form.findings);
        setObservations(form.observations);
        setAccepted(acceptedAssessmentForReview(detail));
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, session?.user.id, reloadKey]);

  async function reloadStatus() {
    if (!review || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const detail = await instructorApi.getReviewDetail(review.id);
      setReview(detail);
      setAccepted(acceptedAssessmentForReview(detail));
      setNeedsReload(false);
      setMessage(
        "Status reloaded. Check the latest review before confirming; your form entries were preserved.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }
  async function handleClaim() {
    if (
      !review ||
      actionInFlight.current ||
      needsReload ||
      review.status !== "PENDING"
    )
      return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const claimed = await instructorApi.claimReview(review.id);
      setReview((previous) =>
        previous ? { ...previous, ...claimed } : previous,
      );
      setMessage("Review claimed.");
    } catch (cause) {
      setError(errorMessage(cause));
      setNeedsReload(true);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }
  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review || !session || actionInFlight.current || needsReload) return;
    actionInFlight.current = true;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const payload = buildConfirmPayload(
        review,
        { reason, summary, criteria, findings, observations },
        session.user.id,
      );
      const result = await instructorApi.confirmReview(review.id, payload);
      setAccepted(result.acceptedAssessment);
      setReview((previous) =>
        previous ? { ...previous, status: "CONFIRMED" } : previous,
      );
      setMessage(
        result.acceptedAssessment.publishedAt
          ? "Assessment confirmed and published."
          : "Assessment confirmed. Publication is pending.",
      );
      try {
        const detail = await instructorApi.getReviewDetail(review.id);
        setReview(detail);
        const savedForm = createReviewForm(detail);
        setCriteria(savedForm.criteria);
        setSummary(savedForm.summary);
        setReason(savedForm.reason);
        setFindings(savedForm.findings);
        setObservations(savedForm.observations);
      } catch {
        setMessage(
          "Assessment confirmed successfully, but the latest details could not be loaded. Reload the status.",
        );
      }
    } catch (cause) {
      setError(errorMessage(cause));
      if (
        isAxiosError(cause) &&
        (!cause.response || cause.response.status === 409)
      )
        setNeedsReload(true);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }
  async function handlePublish() {
    if (
      !review ||
      !accepted ||
      accepted.publishedAt ||
      actionInFlight.current ||
      needsReload ||
      review.status !== "CONFIRMED"
    )
      return;
    const policy = review.revision.attempt.assignmentVersion.releasePolicyJson;
    if (policy?.releaseMode !== "MANUAL") return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await instructorApi.publishAccepted(accepted.id);
      setAccepted(result);
      setMessage(
        result.publishedAt
          ? "Assessment published."
          : "This assessment was not published. Reload the review status.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setNeedsReload(true);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main className="p-8" role="status">
        Loading review...
      </main>
    );
  if (!review)
    return (
      <main className="p-8">
        <p role="alert">{error || "Review not found."}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError("");
            setReloadKey((value) => value + 1);
          }}
        >
          Retry
        </button>
      </main>
    );
  if (review.revision.responseMode !== "WRITING")
    return (
      <main className="p-8">
        <p>
          This review needs the{" "}
          {review.revision.responseMode === "SPEAKING"
            ? "Speaking audio"
            : "answer-key"}{" "}
          workflow. Open a Writing review to assess an essay here.
        </p>
        <Link to="/teacher/reviews">Back to review queue</Link>
      </main>
    );

  const version = review.revision.attempt.assignmentVersion;
  const rubric = version.rubricVersion;
  const paragraphs = review.revision.revisionParagraphs;
  const essay = review.revision.writingText ?? "";
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const canClaim = review.status === "PENDING" && !needsReload;
  const canConfirm = canConfirmReview(review, session?.user.id) && !needsReload;
  const isClaimedByOther =
    review.status === "CLAIMED" && review.assigneeId !== session?.user.id;
  const isManualUnpublished =
    review.status === "CONFIRMED" &&
    version.releasePolicyJson?.releaseMode === "MANUAL" &&
    Boolean(accepted && !accepted.publishedAt);
  const ai = aiAssessment(review);
  const overall = weightedOverall(review, criteria);
  const latestTeacher = teacherAssessment(review);
  const weightByCode = new Map(
    (rubric?.rubricCriterions ?? []).map((c) => [c.code, Number(c.weight)]),
  );
  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

  const statusBadgeClass: Record<ReviewStatus, string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    CLAIMED: isClaimedByOther
      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
      : "border-brand-200 bg-brand-50 text-brand-800",
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  };

  const releaseModeLabels: Record<string, string> = {
    IMMEDIATE: "Immediate release",
    MANUAL: "Manual release",
    AFTER_DUE: "Release after due date",
    SCHEDULED: "Scheduled release",
  };
  const releaseLabel =
    releaseModeLabels[version.releasePolicyJson?.releaseMode ?? "IMMEDIATE"] ??
    version.releasePolicyJson?.releaseMode ??
    "Immediate release";

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/teacher/reviews"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 hover:underline"
          >
            &larr; Back to review queue
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reloadStatus()}
            className="rounded-lg border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-800 shadow-2xs transition hover:bg-brand-50 disabled:opacity-50"
          >
            Reload review status
          </button>
        </div>

        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Writing Submission Review
              </p>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                {version.assignment.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  {review.revision.attempt.learner.displayName}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Submitted {new Date(review.revision.submittedAt).toLocaleString()}
                </span>
                <span aria-hidden="true">·</span>
                <span>{wordCount} words</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass[review.status]}`}
                >
                  {review.status === "CLAIMED" && !isClaimedByOther
                    ? "In progress · Assigned to you"
                    : statusLabels[review.status]}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {version.mode}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {releaseLabel}
                </span>
                {rubric && (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                    {rubric.rubricCode} · v{rubric.versionNo}
                  </span>
                )}
              </div>
            </div>

            {review.status === "PENDING" && (
              <div className="shrink-0">
                <button
                  type="button"
                  disabled={busy || !canClaim}
                  onClick={() => void handleClaim()}
                  className="w-full rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50 lg:w-auto"
                >
                  {busy ? "Claiming..." : "Claim review"}
                </button>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900"
          >
            {message}
          </div>
        )}
        {isClaimedByOther && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This review is assigned to another instructor. Editing is locked unless they release their claim.
          </div>
        )}

        <div
          className="sticky top-14 z-10 -mx-1 flex items-center gap-2 rounded-xl border border-brand-200 bg-white/95 px-3 py-2 shadow-xs backdrop-blur lg:hidden"
          aria-label="Quick section jump"
        >
          <a
            href="#student-submission-panel"
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            Essay &amp; prompt
          </a>
          <a
            href="#instructor-rubric-panel"
            className="flex-1 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-center text-xs font-semibold text-brand-900 hover:bg-brand-100"
          >
            Rubric &amp; grading
          </a>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div
            id="student-submission-panel"
            className="min-w-0 space-y-4 scroll-mt-28 lg:col-span-6 lg:scroll-mt-20"
          >
            <details
              open
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6"
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold text-slate-900">
                  Writing prompt &amp; instructions
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Activity v{version.activityVersion.versionNo}
                </span>
              </summary>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {version.activityVersion.promptText}
                </p>
                {version.activityVersion.instructions && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                    <p className="font-semibold text-slate-700">Instructions</p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {version.activityVersion.instructions}
                    </p>
                  </div>
                )}
              </div>
            </details>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <h2 className="text-base font-bold text-slate-900">
                  Student response
                </h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {wordCount} words · {paragraphs.length || 1} paragraph
                  {paragraphs.length === 1 ? "" : "s"}
                </span>
              </div>

              {paragraphs.length > 0 ? (
                <div className="space-y-3">
                  {paragraphs.map((paragraph) => (
                    <div
                      key={paragraph.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3.5"
                    >
                      <span className="mt-0.5 shrink-0 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-800">
                        P{paragraph.paragraphNo}
                      </span>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {paragraph.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="min-h-48 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                  {essay ||
                    "No essay text was returned. Reload the review or contact support."}
                </p>
              )}

              {!essay.trim() && (
                <p role="alert" className="text-sm text-red-700">
                  The submission text is missing. Reload the review; confirmation is disabled until the essay is available.
                </p>
              )}
            </section>

            {review.appeals?.length || review.reviewRequests?.length ? (
              <section className="space-y-3 rounded-xl border border-indigo-200 bg-white p-5 shadow-2xs sm:p-6">
                <h2 className="text-base font-bold text-slate-900">
                  Learner review requests and appeals
                </h2>
                <div className="space-y-2.5">
                  {review.reviewRequests?.map((request, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm"
                    >
                      <p className="font-medium text-slate-900">
                        {request.afterJson.reason || "Learner requested instructor review"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Requested {new Date(request.occurredAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {review.appeals?.map((appeal) => (
                    <div
                      key={appeal.id}
                      className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase text-purple-900">
                          Appeal · {appeal.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-800">{appeal.reason}</p>
                      {appeal.resolution && (
                        <p className="mt-1.5 text-xs text-slate-600">
                          <span className="font-semibold">Resolution:</span>{" "}
                          {appeal.resolution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <details
              open={ai?.aiResult?.qualityStatus === "FLAGGED"}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6"
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold text-slate-900">
                  AI assessment (provisional · read-only)
                </span>
                {ai && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        ai.aiResult?.qualityStatus === "FLAGGED"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      Quality: {ai.aiResult?.qualityStatus ?? "PASSED"}
                    </span>
                    {ai.overallScore != null && (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                        Est. band {ai.overallScore}
                      </span>
                    )}
                  </div>
                )}
              </summary>

              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {ai ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      {ai.aiResult?.qualityStatus === "FLAGGED"
                        ? "Flagged by automated validation: inspect AI scores and quotes carefully before confirming."
                        : "AI feedback is provisional reference material; instructors make the official decision."}
                    </p>
                    {ai.summary && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                        {ai.summary}
                      </p>
                    )}
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {ai.criterionScores.map((score) => (
                        <div
                          key={score.id}
                          className="rounded-lg border border-slate-200/80 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-xs font-bold uppercase text-slate-900">
                              {score.criterion.code}
                            </strong>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-900">
                              {score.score}
                            </span>
                          </div>
                          {score.explanation && (
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                              {score.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {ai.findings.length > 0 && (
                      <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-800">
                          Inspect {ai.findings.length} provisional AI finding
                          {ai.findings.length === 1 ? "" : "s"}
                        </summary>
                        <div className="mt-3 space-y-2.5">
                          {ai.findings.map((finding) => (
                            <div
                              key={finding.id}
                              className="space-y-1.5 border-t border-slate-200 pt-2 text-xs"
                            >
                              <p className="text-slate-700">{finding.explanation}</p>
                              {finding.findingAnchors.map((anchor, index) => (
                                <blockquote
                                  key={`${anchor.paragraphId}-${index}`}
                                  className="border-l-2 border-brand-400 bg-white py-1 pl-3 italic text-slate-600"
                                >
                                  &ldquo;{anchor.exactQuote}&rdquo;
                                </blockquote>
                              ))}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-600">
                    {review.targetRun
                      ? `AI processing status: ${review.targetRun.status.toLowerCase()}.`
                      : "No AI assessment is linked to this review."}{" "}
                    You can grade this submission manually using the pinned rubric on the right.
                  </p>
                )}
              </div>
            </details>

            {(review.status === "CONFIRMED" ||
              (review.status === "CLAIMED" &&
                review.assigneeId === session?.user.id)) && (
              <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                <summary className="cursor-pointer text-base font-bold text-slate-900">
                  Review lifecycle actions
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <label className="block text-sm font-medium text-slate-800">
                    Reason for review action
                    <input
                      value={actionReason}
                      onChange={(event) => setActionReason(event.target.value)}
                      maxLength={10000}
                      placeholder="Required before releasing claim, rejecting appeal, or opening a correction..."
                      className={fieldClass}
                    />
                  </label>
                  {review.status === "CONFIRMED" ? (
                    <button
                      type="button"
                      disabled={busy || needsReload}
                      onClick={() => void reviewAction("reopen")}
                      className="rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-900 transition hover:bg-brand-100 disabled:opacity-50"
                    >
                      Open a correction review
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy || needsReload}
                        onClick={() => void reviewAction("release")}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Release claim
                      </button>
                      {review.appeals?.some((appeal) =>
                        ["PENDING", "IN_REVIEW"].includes(appeal.status),
                      ) && (
                        <button
                          type="button"
                          disabled={busy || needsReload}
                          onClick={() => void reviewAction("reject")}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          Reject appeal with reason
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Corrections create a new review case while preserving prior decisions. To uphold an appeal, confirm an updated assessment.
                  </p>
                </div>
              </details>
            )}

            {!!review.reviewDecisions.length && (
              <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-base font-bold text-slate-900">
                    Decision history
                  </span>
                  <span className="text-xs text-slate-500">
                    {review.reviewDecisions.length} recorded
                  </span>
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {review.reviewDecisions.map((decision) => {
                  const assessment = review.revision.assessmentResults.find(
                    (result) =>
                      result.teacherResult?.decisionId === decision.id,
                  );
                  return (
                    <details
                      key={decision.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                    >
                      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                        Decision #{decision.decisionNo} ·{" "}
                        {new Date(decision.decidedAt).toLocaleString()}
                        {assessment?.overallScore != null
                          ? ` · Band ${assessment.overallScore}`
                          : ""}
                      </summary>
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-2.5 text-sm text-slate-700">
                        <p>
                          <span className="font-semibold">Decision reason:</span>{" "}
                          {decision.reason}
                        </p>
                        {assessment?.summary && (
                          <p className="whitespace-pre-wrap text-slate-600">
                            {assessment.summary}
                          </p>
                        )}
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {assessment?.criterionScores.map((score) => (
                            <p
                              key={score.id}
                              className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                            >
                              <strong>
                                {score.criterion.code}: {score.score}
                              </strong>{" "}
                              — {score.explanation}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                          {assessment?.acceptedAssessment?.publishedAt
                            ? `Published ${new Date(assessment.acceptedAssessment.publishedAt).toLocaleString()}`
                            : "Awaiting publication"}
                        </p>
                      </div>
                    </details>
                  );
                })}
                </div>
              </details>
            )}
          </div>

          <section
            id="instructor-rubric-panel"
            className="min-w-0 space-y-4 scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 lg:col-span-6 lg:scroll-mt-20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Instructor assessment
                </h2>
                <p className="text-xs text-slate-500">
                  {rubric
                    ? `Rubric: ${rubric.rubricCode} · version ${rubric.versionNo}`
                    : "No pinned rubric"}
                </p>
              </div>
              {review.status === "PENDING" && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Claim review above to unlock grading
                </span>
              )}
            </div>

            {isManualUnpublished && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Ready for manual publication</p>
                  <p className="mt-0.5">
                    This assessment is confirmed under MANUAL policy and is not visible to the learner yet.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || needsReload}
                  onClick={() => void handlePublish()}
                  className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-800 disabled:opacity-50"
                >
                  Publish confirmed assessment
                </button>
              </div>
            )}

            <form onSubmit={(event) => void handleConfirm(event)}>
              <fieldset disabled={!canConfirm || busy} className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-canvas p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-900">
                      Overall band
                    </p>
                    <p className="mt-0.5 text-xs text-brand-700">
                      Weighted average from {criteria.length} rubric criteria
                    </p>
                  </div>
                  <output className="text-3xl font-bold text-brand-900">
                    {overall ?? "—"}
                  </output>
                </div>

                <div className="space-y-3">
                  {criteria.map((row) => {
                    const weight = weightByCode.get(row.code);
                    return (
                      <div
                        key={row.code}
                        className="space-y-2.5 rounded-xl border border-slate-200/90 bg-slate-50/40 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">
                              {row.code}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {row.name}
                            </span>
                          </div>
                          {weight != null && !Number.isNaN(weight) && (
                            <span className="text-xs font-medium text-slate-500">
                              Weight {Math.round(weight * 100)}%
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                          <label className="block text-xs font-medium text-slate-700">
                            Band score
                            <input
                              required
                              type="number"
                              min={0}
                              max={Math.min(9, row.maxScore)}
                              step={0.5}
                              value={row.score}
                              onChange={(event) =>
                                setCriteria((previous) =>
                                  previous.map((item) =>
                                    item.code === row.code
                                      ? { ...item, score: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className={fieldClass}
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            {row.code} explanation
                            <textarea
                              required
                              rows={2}
                              maxLength={10000}
                              value={row.explanation}
                              onChange={(event) =>
                                setCriteria((previous) =>
                                  previous.map((item) =>
                                    item.code === row.code
                                      ? { ...item, explanation: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className={fieldClass}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <label className="block text-sm font-medium text-slate-800">
                  Overall feedback <span className="text-red-600">*</span>
                  <textarea
                    required
                    rows={3}
                    maxLength={10000}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Summarize key strengths and next improvement steps for the learner..."
                    className={fieldClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Decision reason <span className="text-red-600">*</span>
                  <textarea
                    required
                    rows={2}
                    maxLength={10000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Audit note explaining grading confirmation or AI adjustment..."
                    className={fieldClass}
                  />
                </label>

                <ReviewEvidenceEditor
                  review={review}
                  criteria={criteria}
                  findings={findings}
                  observations={observations}
                  onFindingsChange={setFindings}
                  onObservationsChange={setObservations}
                />

                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Confirm assessment"}
                </button>
              </fieldset>
            </form>

            {accepted && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Publication
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      accepted.publishedAt
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {accepted.publishedAt ? "Published" : "Pending publication"}
                  </span>
                </div>
                {latestTeacher?.overallScore != null && (
                  <p className="text-sm font-semibold text-slate-800">
                    Confirmed band: {latestTeacher.overallScore}
                  </p>
                )}
                <p className="text-xs text-slate-600">
                  {accepted.publishedAt
                    ? `Published: ${new Date(accepted.publishedAt).toLocaleString()}`
                    : accepted.releaseAfter
                      ? `Awaiting publication: ${new Date(accepted.releaseAfter).toLocaleString()}`
                      : "Confirmed; awaiting publication."}
                </p>
                {review.status === "CONFIRMED" &&
                  version.releasePolicyJson?.releaseMode === "MANUAL" &&
                  !accepted.publishedAt && (
                    <button
                      type="button"
                      disabled={busy || needsReload}
                      onClick={() => void handlePublish()}
                      className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
                    >
                      Publish confirmed assessment
                    </button>
                  )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
