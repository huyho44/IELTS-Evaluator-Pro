import { useEffect, useState } from "react";
import { managementError, managementRequest } from "./managementApi";

type Counts = { status: string; _count: number }[];
type Overview = {
  accounts: Counts;
  courses: Counts;
  pending: number;
  activity: { id: string; occurredAt: string; action: string; actor: { displayName: string } | null }[];
};
const count = (rows: Counts, status?: string) =>
  rows.reduce((n, row) => n + (!status || status === row.status ? row._count : 0), 0);
const labels: Record<string, string> = {
  ACCOUNT_UPDATED: "Updated an account",
  INSTRUCTOR_APPLICATION_DECIDED: "Reviewed an instructor application",
  COURSE_INSTRUCTOR_ASSIGNED: "Assigned a course instructor",
  SKILL_SAVED: "Saved a skill",
  SKILL_PREREQUISITES_UPDATED: "Updated skill prerequisites",
};
export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    managementRequest<Overview>("GET", "/admin/overview")
      .then(value => { if (active) { setData(value); setError(""); } })
      .catch(cause => { if (active) setError(managementError(cause)); });
    return () => { active = false; };
  }, [retry]);
  return <main className="mx-auto max-w-6xl p-5 sm:p-10">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Administration / Overview</p><h1 className="mt-3 text-3xl font-bold text-slate-900">Admin dashboard</h1><p className="mt-2 text-slate-600">Monitor accounts, course activity and pending approvals.</p></header>
    {error ? <p role="alert">{error} <button className="underline" onClick={() => setRetry(v => v + 1)}>Retry overview</button></p>
      : !data ? <p role="status">Loading overview…</p> : <>
        <div className="my-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Pending applications", data.pending, "Review instructor applications", "/admin/manage#applications"],
            ["Accounts", count(data.accounts), count(data.accounts, "ACTIVE") + " active · " + count(data.accounts, "SUSPENDED") + " suspended", "/admin/manage#accounts"],
            ["Courses", count(data.courses), count(data.courses, "PUBLISHED") + " published · " + count(data.courses, "DRAFT") + " draft · " + count(data.courses, "HIDDEN") + " hidden", "/admin/catalog"],
          ].map(([name, value, detail, href]) => <a key={name} href={String(href)} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-500">
            <span className="block text-sm font-semibold">{name}</span><strong className="my-1 block text-3xl">{value}</strong><small>{detail}</small>
          </a>)}
        </div>
        <h2 className="mb-2 mt-8 text-lg font-bold">Quick actions</h2>
        <nav aria-label="Quick actions" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-blue-800 underline">
          <a href="/admin/manage#applications">Review applications</a><a href="/admin/manage#accounts">Manage accounts</a><a href="/admin/assign">Assign instructor</a>
        </nav>
        <h3 className="mt-6 font-semibold">Recent administrative activity</h3>
        {data.activity.length === 0 ? <p className="mt-2 text-sm text-slate-600">No administrative actions recorded yet.</p> :
          <ul className="mt-2 divide-y divide-slate-200">{data.activity.map(a => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span><strong>{a.actor?.displayName ?? "System"}</strong> · {labels[a.action] ?? a.action}</span><time dateTime={a.occurredAt}>{new Date(a.occurredAt).toLocaleString()}</time>
          </li>)}</ul>}
      </>}
  </main>;
}
