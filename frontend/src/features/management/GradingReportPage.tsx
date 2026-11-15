import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  managementRequest,
  managementError,
  panel as panelClass,
} from "./managementApi";
import { getWorkspaceTheme } from "./workspaceTheme";

type Report = {
  scope: string;
  generatedAt: string;
  runs: Record<string, number>;
  quality: Record<string, number>;
  reviews: Record<string, number>;
  providerSample: {
    limit: number;
    count: number;
    since: string | null;
    successCount: number;
    meanLatencyMs: number | null;
    p95LatencyMs: number | null;
    inputTokens: number;
    outputTokens: number;
    tokenUsageRecordedCount: number;
    failures: Record<string, number>;
  };
};

const METRIC_STATUS_COLOR: Record<string, string> = {
  COMPLETED: "bg-emerald-500",
  CONFIRMED: "bg-emerald-500",
  PASSED: "bg-emerald-500",
  PENDING: "bg-amber-500",
  QUEUED: "bg-amber-500",
  CLAIMED: "bg-teal-600",
  RUNNING: "bg-teal-600",
  FLAGGED: "bg-rose-500",
  FAILED: "bg-rose-500",
  CANCELLED: "bg-slate-400",
};

export default function GradingReportPage() {
  const { pathname } = useLocation();
  const theme = getWorkspaceTheme(pathname, false);
  const isAdmin = theme.variant === "admin";
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "telemetry">("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    managementRequest<Report>("GET", "/grading/report")
      .then((value) => {
        if (active) {
          setReport(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(managementError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-7">
      <header
        className={`flex flex-wrap items-end justify-between gap-4 border-b pb-5 ${theme.sectionBorder}`}
      >
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${theme.eyebrowText}`}
          >
            {isAdmin
              ? "Admin Console / Grading Reports"
              : "Instructor Workspace / Grading Reports"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Grading operations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pipeline counts for grading runs, AI quality routing, teacher review cases, and recent provider calls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="../dashboard"
            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${theme.outlineButton}`}
          >
            Account overview
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setReload((value) => value + 1);
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold shadow-2xs transition disabled:opacity-50 ${theme.primaryButton}`}
          >
            {loading ? "Refreshing..." : "Refresh report"}
          </button>
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

      {!report ? (
        <div
          role="status"
          className={`${panelClass} text-sm text-slate-600 shadow-2xs`}
        >
          Loading report…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.chipBadge}`}
              >
                Scope:{" "}
                {report.scope === "ALL_COURSES"
                  ? "All courses (Admin)"
                  : "Your assigned courses (Instructor)"}
              </span>
              <span className="text-xs text-slate-500">
                Generated {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Live backend metrics
            </span>
          </div>

          <div
            className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs"
            role="tablist"
          >
            {(
              [
                { id: "summary", label: "Pipeline summary" },
                {
                  id: "telemetry",
                  label: `Provider telemetry (${report.providerSample.count})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? theme.primaryButton
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "summary" ? (
            <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                [
                  "Grading runs",
                  "Automated AI grading jobs in this scope",
                  report.runs,
                ],
                [
                  "AI routing",
                  "Automated quality check decisions",
                  report.quality,
                ],
                [
                  "Teacher reviews",
                  "Human review queue lifecycle states",
                  report.reviews,
                ],
              ] as const
            ).map(([title, subtitle, rows]) => {
              const entries = Object.entries(rows);
              const total = entries.reduce((sum, [, count]) => sum + count, 0);
              return (
                <section key={title} className={`${panelClass} shadow-2xs`}>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {title}
                      </h2>
                      <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-900">
                      {total}
                    </span>
                  </div>
                  {entries.length ? (
                    <dl className="space-y-3">
                      {entries.map(([status, count]) => {
                        const pct =
                          total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={status} className="space-y-1">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <dt className="font-medium text-slate-700">
                                {status}
                              </dt>
                              <dd className="font-bold text-slate-900">
                                {count}{" "}
                                <span className="text-xs font-normal text-slate-400">
                                  ({pct}%)
                                </span>
                              </dd>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  METRIC_STATUS_COLOR[status] ?? "bg-slate-600"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </dl>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      No records yet.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          ) : (
          <section className={`${panelClass} shadow-2xs`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Recent provider calls
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Latest {report.providerSample.count} calls, capped at{" "}
                  {report.providerSample.limit}
                  {report.providerSample.since
                    ? ` since ${new Date(report.providerSample.since).toLocaleString()}`
                    : ""}
                  . Run and review counts above cover all records in this scope.
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  Object.keys(report.providerSample.failures).length === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {Object.values(report.providerSample.failures).reduce(
                  (sum, v) => sum + v,
                  0,
                )}{" "}
                failures in sample
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Successful calls", report.providerSample.successCount],
                [
                  "Mean latency",
                  report.providerSample.meanLatencyMs === null
                    ? "No measurement"
                    : `${report.providerSample.meanLatencyMs} ms`,
                ],
                [
                  "P95 latency",
                  report.providerSample.p95LatencyMs === null
                    ? "No measurement"
                    : `${report.providerSample.p95LatencyMs} ms`,
                ],
                [
                  "Input / output tokens",
                  `${report.providerSample.inputTokens} / ${report.providerSample.outputTokens}`,
                ],
                [
                  "Calls with token metadata",
                  `${report.providerSample.tokenUsageRecordedCount} / ${report.providerSample.count}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"
                >
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-900">Failure codes</h3>
              {Object.entries(report.providerSample.failures).length ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.providerSample.failures).map(
                    ([code, count]) => (
                      <span
                        key={code}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800"
                      >
                        {code}: {count}
                      </span>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  No recorded failures in this sample.
                </p>
              )}
              <p className="pt-2 text-xs text-slate-500">
                Routing flags request teacher inspection. These metrics do not measure scoring accuracy; compare expert labels with the evaluation runner for that assessment.
              </p>
            </div>
          </section>
          )}
        </>
      )}
    </main>
  );
}
