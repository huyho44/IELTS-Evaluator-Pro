import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { instructorApi } from "../services/instructorApi";
import { useSession } from "../../auth/session";
import type { ReviewQueueItem } from "../types";

const REASON_LABELS: Record<string, { label: string; className: string }> = {
  FLAGGED_QUALITY: {
    label: "AI flagged",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  QUALITY_FLAGGED: {
    label: "AI flagged",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  LOW_CONFIDENCE: {
    label: "Low AI confidence",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  LEARNER_REQUEST: {
    label: "Learner request",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  LEARNER_APPEAL: {
    label: "Learner appeal",
    className: "border-purple-200 bg-purple-50 text-purple-800",
  },
  APPEAL: {
    label: "Learner appeal",
    className: "border-purple-200 bg-purple-50 text-purple-800",
  },
  MANUAL_GRADING: {
    label: "Manual grading",
    className: "border-brand-200 bg-brand-50 text-brand-800",
  },
  PRACTICE_REVIEW: {
    label: "Practice review",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

function formatReasonBadge(reasonCode: string) {
  const mapped = REASON_LABELS[reasonCode];
  if (mapped) return mapped;
  return {
    label: reasonCode
      .toLowerCase()
      .split("_")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
      .join(" "),
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

export default function ReviewQueuePage() {
  const { session } = useSession();
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "OPEN" | "PENDING" | "CLAIMED" | "CONFIRMED" | "ALL"
  >("OPEN");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setReviews([]);
      try {
        const data = await instructorApi.getReviewQueue(statusFilter);
        if (!Array.isArray(data))
          throw new Error("Unexpected review queue response.");
        if (active) setReviews(data);
      } catch (cause) {
        if (!active) return;
        const message: unknown = isAxiosError(cause)
          ? cause.response?.data?.message
          : undefined;
        setError(
          typeof message === "string"
            ? message
            : "Unable to load the review queue. Please try again.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey, session?.user.id, statusFilter]);

  const renderStatusBadge = (item: ReviewQueueItem) => {
    const isMine = item.assigneeId === session?.user.id;
    switch (item.status) {
      case "CLAIMED":
        return isMine ? (
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-brand-600" />
            Claimed · Assigned to you
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Claimed · Another instructor
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Confirmed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending claim
          </span>
        );
    }
  };

  const keyword = searchTerm.trim().toLowerCase();
  const filteredReviews = reviews.filter((item) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      statusFilter === "OPEN" ||
      item.status === statusFilter;
    const reasonLabel = formatReasonBadge(item.reasonCode).label;
    const matchesSearch =
      !keyword ||
      `${item.revision.attempt.assignmentVersion.assignment.title} ${item.revision.attempt.learner.displayName} ${item.reasonCode} ${reasonLabel}`
        .toLowerCase()
        .includes(keyword);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = reviews.filter((r) => r.status === "PENDING").length;
  const claimedCount = reviews.filter((r) => r.status === "CLAIMED").length;
  const mineCount = reviews.filter(
    (r) => r.status === "CLAIMED" && r.assigneeId === session?.user.id,
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
              Review Queue
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Claim pending submissions, verify AI provisional findings, and publish confirmed assessments.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Shows up to 100 matching reviews. Switch to{" "}
              <span className="font-semibold text-slate-700">Confirmed</span> to inspect past decisions or open corrections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/teacher/reports"
              className="rounded-lg border border-brand-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-800 shadow-2xs transition hover:bg-brand-50"
            >
              Grading operations report
            </Link>
            <button
              type="button"
              disabled={loading}
              onClick={() => setReloadKey((value) => value + 1)}
              className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-800 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh queue"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-white p-5 shadow-2xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Claim
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {pendingCount}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Ready for any assigned instructor
              </p>
            </div>
            <div
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                In Progress (Claimed)
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {claimedCount}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Currently locked for review
              </p>
            </div>
            <div
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-white p-5 shadow-2xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Assigned to Me
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-950">
                {mineCount}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Active drafts claimed by you
              </p>
            </div>
            <div
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-1 self-start rounded-lg bg-slate-100 p-1">
              {(
                ["OPEN", "PENDING", "CLAIMED", "CONFIRMED", "ALL"] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === tab
                      ? "bg-brand-700 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab === "OPEN"
                    ? "Open reviews"
                    : tab === "PENDING"
                      ? "Pending"
                      : tab === "CLAIMED"
                        ? "Claimed"
                        : tab === "CONFIRMED"
                          ? "Confirmed"
                          : "All history"}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center gap-3 md:w-auto">
              <div className="relative w-full md:w-72">
                <input
                  type="search"
                  placeholder="Search student, assignment, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {filteredReviews.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Loading review queue...
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm">
                <p role="alert" className="text-red-700">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-3 rounded-lg border border-brand-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-50"
                >
                  Try again
                </button>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No submissions found in this view
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try another status tab or clear your search term.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-brand-100 bg-canvas text-xs font-semibold uppercase tracking-wider text-brand-900">
                    <th className="px-4 py-3">Assessment Details</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Submitted &amp; Routing</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredReviews.map((item) => {
                    const reasonBadge = formatReasonBadge(item.reasonCode);
                    const isMine =
                      item.status === "CLAIMED" &&
                      item.assigneeId === session?.user.id;
                    const isPending = item.status === "PENDING";

                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-brand-50/25"
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">
                            {
                              item.revision.attempt.assignmentVersion.assignment
                                .title
                            }
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                              {item.revision.responseMode}
                            </span>
                            {item.priority > 0 && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                Priority {item.priority}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800 ring-1 ring-brand-200/80"
                            >
                              {item.revision.attempt.learner.displayName
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                            <span className="font-medium text-slate-800">
                              {item.revision.attempt.learner.displayName}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-xs font-medium text-slate-700">
                            {new Date(item.revision.submittedAt).toLocaleString()}
                          </div>
                          <span
                            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${reasonBadge.className}`}
                          >
                            {reasonBadge.label}
                          </span>
                        </td>

                        <td className="px-4 py-4">{renderStatusBadge(item)}</td>

                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/teacher/reviews/${encodeURIComponent(item.id)}`}
                            className={`inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                              isPending
                                ? "bg-brand-700 text-white shadow-2xs hover:bg-brand-800"
                                : isMine
                                  ? "border border-brand-300 bg-brand-50 text-brand-900 hover:bg-brand-100"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {isPending
                              ? "Open review"
                              : isMine
                                ? "Continue grading"
                                : "View review"}{" "}
                            &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
