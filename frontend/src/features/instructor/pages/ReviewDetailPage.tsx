import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
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
  const essay = review.revision.writingText ?? "";
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const canConfirm = canConfirmReview(review, session?.user.id) && !needsReload;
  const ai = aiAssessment(review);
  const overall = weightedOverall(review, criteria);
  const latestTeacher = teacherAssessment(review);
  const fieldClass = "w-full rounded border border-slate-300 p-2";
  return (
    <main className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link to="/teacher/reviews" className="text-blue-600">
          Back to review queue
        </Link>
        <header className="space-y-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{version.assignment.title}</h1>
          <p>
            {review.revision.attempt.learner.displayName} ·{" "}
            {new Date(review.revision.submittedAt).toLocaleString()} ·{" "}
            {statusLabels[review.status]}
          </p>
        </header>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-blue-700">
            {message}
          </p>
        )}
        <button
          disabled={busy}
          onClick={() => void reloadStatus()}
          className="rounded border px-3 py-2"
        >
          Reload review status
        </button>
        {review.status === "PENDING" && (
          <button
            disabled={busy || needsReload}
            onClick={() => void handleClaim()}
            className="ml-3 rounded bg-blue-600 px-3 py-2 text-white"
          >
            Claim review
          </button>
        )}
        {review.status === "CLAIMED" &&
          review.assigneeId !== session?.user.id && (
            <p>This review is assigned to another instructor.</p>
          )}
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-5 lg:col-span-7">
            <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-bold">Writing prompt</h2>
              <p className="whitespace-pre-wrap">
                {version.activityVersion.promptText}
              </p>
              <p className="mt-3 whitespace-pre-wrap">
                {version.activityVersion.instructions}
              </p>
            </section>
            <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-bold">
                Student response · {wordCount} words
              </h2>
              <p className="min-h-60 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-gray-800">
                {essay ||
                  "No essay text was returned. Reload the review or contact support."}
              </p>
              {!essay.trim() && (
                <p role="alert" className="text-sm text-red-700">
                  The submission text is missing. Reload the review;
                  confirmation is disabled until the essay is available.
                </p>
              )}
            </section>
            <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-bold">AI assessment for this review</h2>
              {ai ? (
                <>
                  <p>
                    {ai.aiResult?.qualityStatus === "FLAGGED"
                      ? "Flagged: inspect the feedback and evidence carefully."
                      : "AI feedback requires instructor review."}
                  </p>
                  <p>{ai.summary}</p>
                  {ai.criterionScores.map((score) => (
                    <div key={score.id}>
                      <strong>
                        {score.criterion.code}: {score.score}
                      </strong>
                      <p>{score.explanation}</p>
                    </div>
                  ))}
                  {ai.findings.map((finding) => (
                    <div key={finding.id} className="border-t pt-2">
                      <p>{finding.explanation}</p>
                      {finding.findingAnchors.map((anchor, index) => (
                        <blockquote
                          key={`${anchor.paragraphId}-${index}`}
                          className="border-l-2 pl-3"
                        >
                          {anchor.exactQuote}
                        </blockquote>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                <p>
                  {review.targetRun
                    ? `AI processing: ${review.targetRun.status.toLowerCase()}.`
                    : "No AI assessment is linked to this review."}{" "}
                  You may assess the submission manually using its pinned
                  rubric.
                </p>
              )}
            </section>
            {!!review.reviewDecisions.length && (
              <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="font-bold">Decision history</h2>
                {review.reviewDecisions.map((decision) => {
                  const assessment = review.revision.assessmentResults.find(
                    (result) =>
                      result.teacherResult?.decisionId === decision.id,
                  );
                  return (
                    <details
                      key={decision.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        Decision {decision.decisionNo} ·{" "}
                        {new Date(decision.decidedAt).toLocaleString()}
                        {assessment?.overallScore != null
                          ? ` · Band ${assessment.overallScore}`
                          : ""}
                      </summary>
                      <div className="mt-3 space-y-2 text-sm text-gray-600">
                        <p>{decision.reason}</p>
                        <p className="whitespace-pre-wrap">
                          {assessment?.summary}
                        </p>
                        {assessment?.criterionScores.map((score) => (
                          <p key={score.id}>
                            <strong>
                              {score.criterion.code}: {score.score}.
                            </strong>{" "}
                            {score.explanation}
                          </p>
                        ))}
                        <p>
                          {assessment?.acceptedAssessment?.publishedAt
                            ? `Published ${new Date(assessment.acceptedAssessment.publishedAt).toLocaleString()}`
                            : "Awaiting publication"}
                        </p>
                      </div>
                    </details>
                  );
                })}
              </section>
            )}
          </div>
          <section className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5">
            <h2 className="font-bold">Instructor assessment</h2>
            <p>
              {rubric
                ? `${rubric.rubricCode} · version ${rubric.versionNo}`
                : "No pinned rubric"}
            </p>
            <form onSubmit={(event) => void handleConfirm(event)}>
              <fieldset disabled={!canConfirm || busy} className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-blue-900">
                      Overall band
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      Calculated from rubric weights
                    </p>
                  </div>
                  <output className="text-2xl font-bold text-blue-900">
                    {overall ?? "—"}
                  </output>
                </div>
                {criteria.map((row) => (
                  <div key={row.code} className="space-y-2">
                    <label className="block">
                      {row.code} · {row.name}
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
                    <label className="block">
                      {row.code} explanation
                      <textarea
                        required
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
                ))}
                <label className="block">
                  Overall feedback
                  <textarea
                    required
                    maxLength={10000}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  Decision reason
                  <textarea
                    required
                    maxLength={10000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
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
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Confirm assessment"}
                </button>
              </fieldset>
            </form>
            {accepted && (
              <div className="space-y-2 border-t pt-4">
                <h2 className="font-bold">Publication</h2>
                {latestTeacher?.overallScore != null && (
                  <p className="text-sm">
                    Confirmed band: {latestTeacher.overallScore}
                  </p>
                )}
                <p>
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
                      disabled={busy || needsReload}
                      onClick={() => void handlePublish()}
                      className="rounded border px-3 py-2"
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
