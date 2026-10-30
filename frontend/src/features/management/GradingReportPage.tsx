import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  managementRequest,
  managementError,
  panel as panelClass,
} from "./managementApi";

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
export default function GradingReportPage() {
  const [report, setReport] = useState<Report | null>(null);
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
      });
    return () => {
      active = false;
    };
  }, [reload]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Grading operations</h1>
        <button
          onClick={() => setReload((value) => value + 1)}
          className="rounded border px-3 py-2"
        >
          Refresh report
        </button>
      </div>
      <Link to="/dashboard" className="text-blue-700">
        Dashboard
      </Link>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!report ? (
        <p role="status">Loading report…</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {report.scope === "ALL_COURSES"
              ? "All courses"
              : "Your assigned courses"}{" "}
            · {new Date(report.generatedAt).toLocaleString()}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["Grading runs", report.runs],
                ["AI routing", report.quality],
                ["Teacher reviews", report.reviews],
              ] as const
            ).map(([title, rows]) => (
              <section key={title} className={panelClass}>
                <h2 className="mb-3 font-bold">{title}</h2>
                {Object.entries(rows).length ? (
                  <dl>
                    {Object.entries(rows).map(([status, count]) => (
                      <div key={status} className="flex justify-between gap-3">
                        <dt>{status}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>No records yet.</p>
                )}
              </section>
            ))}
          </div>
          <section className={panelClass}>
            <h2 className="font-bold">Recent provider calls</h2>
            <p className="my-3 text-sm text-slate-600">
              Latest {report.providerSample.count} calls, capped at{" "}
              {report.providerSample.limit}
              {report.providerSample.since
                ? ` since ${new Date(report.providerSample.since).toLocaleString()}`
                : ""}
              . Run and review counts above cover all records in this scope.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
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
                  "Input / output tokens recorded",
                  `${report.providerSample.inputTokens} / ${report.providerSample.outputTokens}`,
                ],
                [
                  "Calls with token metadata",
                  `${report.providerSample.tokenUsageRecordedCount} / ${report.providerSample.count}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 font-semibold">Failure codes</h3>
            {Object.entries(report.providerSample.failures).map(
              ([code, count]) => (
                <p key={code}>
                  {code}: {count}
                </p>
              ),
            )}
            {!Object.keys(report.providerSample.failures).length && (
              <p>No recorded failures in this sample.</p>
            )}
            <p className="mt-4 text-sm text-slate-600">
              Routing flags request teacher inspection. These metrics do not
              measure scoring accuracy; compare expert labels with the
              evaluation runner for that assessment.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
