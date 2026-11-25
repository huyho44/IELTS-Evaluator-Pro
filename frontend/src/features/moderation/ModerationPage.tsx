import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../../components/ui/Spinner";
import { discussionError } from "../discussions/discussionsApi";
import {
  TARGET_LABELS,
  moderationApi,
  targetLink,
  type ModerationReport,
  type ReportStatus,
} from "./moderationApi";

const FILTERS: (ReportStatus | "ALL")[] = ["PENDING", "RESOLVED", "DISMISSED", "ALL"];
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// A3: instructors handle reports in their courses; admins handle all reports.
export default function ModerationPage() {
  const [status, setStatus] = useState<ReportStatus | "ALL">("PENDING");
  const [reports, setReports] = useState<ModerationReport[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    moderationApi
      .list(status)
      .then((rows) => {
        if (active) {
          setReports(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(discussionError(cause, "Unable to load reports."));
      });
    return () => {
      active = false;
    };
  }, [status, reload]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="ui-eyebrow">Content safety</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Moderation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review reported content. Upholding a report about a discussion post
          hides the post; for lessons and courses you choose whether to hide
          them. A reason is always required and every decision is audited.
        </p>
      </header>
      <div role="tablist" aria-label="Report status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            role="tab"
            type="button"
            aria-selected={status === filter}
            onClick={() => {
              setReports(null);
              setStatus(filter);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              status === filter
                ? "bg-brand-700 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : !reports ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-brand-600" /> Loading reports...
        </p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No {status === "ALL" ? "" : status.toLowerCase()} reports.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} onHandled={() => setReload((v) => v + 1)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onHandled,
}: {
  report: ModerationReport;
  onHandled: () => void;
}) {
  const [resolution, setResolution] = useState("");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { target } = report;
  const link = targetLink(report);
  const isPost = target.type === "POST";

  const act = (action: () => Promise<unknown>) => {
    if (!resolution.trim()) {
      setError("Write the reason for your decision first.");
      return;
    }
    setBusy(true);
    setError("");
    action()
      .then(onHandled)
      .catch((cause) => setError(discussionError(cause, "Unable to save the decision.")))
      .finally(() => setBusy(false));
  };

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
          {TARGET_LABELS[target.type]}
        </span>
        <span className="font-semibold text-slate-800">{target.title}</span>
        {target.courseTitle && target.type !== "COURSE" && (
          <span className="text-slate-500">in {target.courseTitle}</span>
        )}
        {target.contentStatus && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            {target.contentStatus.toLowerCase()}
          </span>
        )}
        {link && (
          <Link to={link} className="ml-auto font-semibold text-brand-700 hover:underline">
            View content
          </Link>
        )}
      </div>
      {target.excerpt && (
        <blockquote className="whitespace-pre-wrap break-words rounded-lg border-l-4 border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {target.author && (
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              {target.author.displayName} wrote:
            </span>
          )}
          {target.excerpt}
        </blockquote>
      )}
      <p className="text-sm text-slate-800">
        <span className="font-semibold">Reason:</span> {report.reason}
      </p>
      <p className="text-xs text-slate-500">
        Reported by {report.reporter.displayName} ·{" "}
        {dateFormat.format(new Date(report.createdAt))}
      </p>
      {report.status === "PENDING" ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-medium text-slate-700">
            Decision reason (shown to the reporter)
            <textarea
              rows={2}
              maxLength={2000}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              className="ui-input mt-1 text-sm"
            />
          </label>
          {!isPost && (
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={hide}
                onChange={(event) => setHide(event.target.checked)}
                className="size-4"
              />
              Hide this {target.type === "COURSE" ? "course" : "lesson or practice"} from learners
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => moderationApi.resolve(report.id, resolution.trim(), hide))}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPost ? "Uphold and hide post" : hide ? "Uphold and hide" : "Uphold (record only)"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => moderationApi.dismiss(report.id, resolution.trim()))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span className="font-semibold">
            {report.status === "RESOLVED" ? "Upheld" : "Dismissed"}
          </span>
          {report.resolver ? ` by ${report.resolver.displayName}` : ""}
          {report.resolvedAt ? ` · ${dateFormat.format(new Date(report.resolvedAt))}` : ""}
          {report.resolution ? `: ${report.resolution}` : ""}
        </p>
      )}
    </article>
  );
}
