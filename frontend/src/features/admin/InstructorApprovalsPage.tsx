import { useState } from "react";
import ActionForm from "../management/ActionForm";
import {
  field,
  managementRequest,
  panel,
  type ApplicationRow,
} from "../management/managementApi";
import AdminSection from "./AdminSection";
import { useAdminSection } from "./useAdminSection";

const loadApplications = () =>
  managementRequest<ApplicationRow[]>("GET", "/admin/instructor-applications");

const STATUS_BADGES: Record<string, string> = {
  APPROVED: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border border-rose-200 bg-rose-50 text-rose-800",
  PENDING: "border border-amber-200 bg-amber-50 text-amber-800",
};

export default function InstructorApprovalsPage() {
  const section = useAdminSection(loadApplications);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "APPROVED" | "REJECTED">("ALL");

  const applications = section.data ?? [];
  const pending = applications.filter((item) => item.status === "PENDING");
  const history = applications.filter((item) => item.status !== "PENDING");
  const filteredHistory =
    historyFilter === "ALL"
      ? history
      : history.filter((item) => item.status === historyFilter);

  return (
    <AdminSection
      title="Instructor approvals"
      description="Inspect submitted qualifications, decide on pending instructor applications, and record a clear reason."
      {...section}
    >
      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs"
          role="tablist"
        >
          {(
            [
              { id: "pending", label: `Pending applications (${pending.length})` },
              { id: "history", label: `Decision history (${history.length})` },
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
                  ? "bg-violet-700 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "pending" ? (
          <section className="min-w-0 space-y-4" aria-labelledby="pending-applications">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="pending-applications"
                className="text-base font-bold text-violet-950"
              >
                Pending applications
              </h2>
              <p className="text-xs text-slate-500">
                Action required · review qualifications and submit an approval or rejection decision.
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {pending.length} pending
            </span>
          </div>

          {section.data && !pending.length && (
            <div className={`${panel} border-dashed text-center shadow-2xs`}>
              <p className="text-sm font-semibold text-slate-900">
                No applications awaiting review
              </p>
              <p className="text-xs text-slate-500">
                New instructor applications submitted by learners will appear here for review.
              </p>
            </div>
          )}

          {pending.map((item) => (
            <ActionForm
              key={item.id}
              title={item.applicant.displayName}
              variant="admin"
              busy={section.busy}
              label="Save decision"
              submit={(data) =>
                section.run(
                  "POST",
                  `/admin/instructor-applications/${item.id}/decision`,
                  {
                    status: data.get("status"),
                    reason: data.get("reason"),
                  },
                )
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-800"
                  >
                    {item.applicant.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="break-all text-xs font-medium text-slate-600">
                    {item.applicant.email}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGES.PENDING}`}
                  >
                    PENDING
                  </span>
                  <span className="text-xs text-slate-500">
                    Submitted {new Date(item.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                  Submitted qualifications &amp; profile
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                  {item.profileText}
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Decision <span className="text-red-600">*</span>
                </legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm hover:bg-emerald-50">
                    <input
                      type="radio"
                      name="status"
                      value="APPROVED"
                      defaultChecked
                      className="mt-0.5 size-4 text-violet-700"
                    />
                    <span>
                      <span className="block font-semibold text-emerald-900">
                        Approve
                      </span>
                      <span className="block text-xs text-emerald-800/80">
                        Grant INSTRUCTOR role access
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm hover:bg-rose-50">
                    <input
                      type="radio"
                      name="status"
                      value="REJECTED"
                      className="mt-0.5 size-4 text-violet-700"
                    />
                    <span>
                      <span className="block font-semibold text-rose-900">
                        Reject
                      </span>
                      <span className="block text-xs text-rose-800/80">
                        Decline application with feedback
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <label className="block text-sm font-medium text-slate-800">
                Decision reason <span className="text-red-600">*</span>
                <textarea
                  required
                  name="reason"
                  rows={3}
                  placeholder="Record verification details or rejection feedback..."
                  className={`${field} mt-1.5`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Required for both approval and rejection. Recorded in decision history.
                </span>
              </label>
            </ActionForm>
          ))}
        </section>
        ) : (
        <section
          className={`${panel} bg-slate-50/60 shadow-2xs`}
          aria-labelledby="application-history"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <h2
                id="application-history"
                className="text-base font-bold text-slate-900"
              >
                Decision history
              </h2>
              <p className="text-xs text-slate-500">
                Read-only log of completed application reviews.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {history.length} total
            </span>
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "APPROVED", "REJECTED"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryFilter(tab)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    historyFilter === tab
                      ? "bg-violet-700 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab === "ALL"
                    ? "All decisions"
                    : tab === "APPROVED"
                      ? "Approved"
                      : "Rejected"}
                </button>
              ))}
            </div>
          )}

          {section.data && !filteredHistory.length && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
              {history.length
                ? "No decisions match this filter."
                : "No decisions recorded yet."}
            </p>
          )}

          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <article
                key={item.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">
                      {item.applicant.displayName}
                    </h3>
                    <p className="truncate break-all text-xs text-slate-500">
                      {item.applicant.email}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      STATUS_BADGES[item.status] ??
                      "border border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Submitted {new Date(item.submittedAt).toLocaleDateString()}
                </p>
                {item.decisionReason && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Reason: </span>
                    {item.decisionReason}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
        )}
      </div>
    </AdminSection>
  );
}
