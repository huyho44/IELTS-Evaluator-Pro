import { useEffect, useState, type ReactNode } from "react";
import Spinner from "../../components/ui/Spinner";
import { discussionError } from "../discussions/discussionsApi";
import {
  analyticsApi,
  percent,
  type AnalyticsReport,
  type CourseAnalytics,
} from "./analyticsApi";

// A7: course analytics. Admins see every course; instructors see their own.
export default function AnalyticsPage() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    analyticsApi
      .report()
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((cause) => {
        if (active) setError(discussionError(cause, "Unable to load analytics."));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="ui-eyebrow">Insights</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Course analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enrollment, completion, activity, submissions, official band averages
          and the review backlog for each course.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : !report ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-brand-600" /> Loading analytics...
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Courses", report.totals.courses],
              ["Active enrollments", report.totals.activeEnrollments],
              ["Completed", report.totals.completedEnrollments],
              [`Active learners (${report.activeWindowDays} days)`, report.totals.activeLearners],
              ["Submissions", report.totals.submissions],
              ["Review backlog", report.totals.reviewBacklog],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          {report.courses.length === 0 ? (
            <p className="text-sm text-slate-500">No courses to report on yet.</p>
          ) : (
            <div className="space-y-4">
              {report.courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Generated {new Date(report.generatedAt).toLocaleString()}. Band
            averages use current published official results only.
          </p>
        </>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: CourseAnalytics }) {
  return (
    <section
      aria-label={course.title}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-slate-900">{course.title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {course.status.toLowerCase()}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Enrolled (active / completed / left)">
          {course.enrollments.active} / {course.enrollments.completed} /{" "}
          {course.enrollments.left}
        </Metric>
        <Metric label="Completion rate">{percent(course.completionRate)}</Metric>
        <Metric label="Active learners (7 days)">{course.activeLearners}</Metric>
        <Metric label="Submissions">{course.submissions}</Metric>
        <Metric label="Official results">{course.officialResults}</Metric>
        <Metric label="Average official band">{course.averageBand ?? "—"}</Metric>
        <Metric label="Reviews pending / claimed">
          {course.reviewBacklog.pending} / {course.reviewBacklog.claimed}
        </Metric>
      </dl>
      {course.completionRate !== null && (
        <div
          role="progressbar"
          aria-label={`Completion rate of ${course.title}`}
          aria-valuenow={Math.round(course.completionRate * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${Math.round(course.completionRate * 100)}%` }}
          />
        </div>
      )}
      {course.criteria.length > 0 && (
        <table className="w-full text-left text-sm">
          <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Average official band by criterion
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-1.5 font-medium">Criterion</th>
              <th className="py-1.5 text-right font-medium">Average</th>
              <th className="py-1.5 text-right font-medium">Results</th>
            </tr>
          </thead>
          <tbody>
            {course.criteria.map((criterion) => (
              <tr key={criterion.code} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-800">
                  {criterion.name} <span className="text-xs text-slate-400">({criterion.code})</span>
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {criterion.average ?? "—"}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">{criterion.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}
