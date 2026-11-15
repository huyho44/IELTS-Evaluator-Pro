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

export default function InstructorApprovalsPage() {
  const section = useAdminSection(loadApplications);
  const applications = section.data ?? [];
  const pending = applications.filter((item) => item.status === "PENDING");
  const history = applications.filter((item) => item.status !== "PENDING");

  return (
    <AdminSection
      title="Instructor approvals"
      description="Review applications and record the reason for each decision."
      {...section}
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-3" aria-labelledby="pending-applications">
          <h2 id="pending-applications" className="font-bold text-violet-950">
            Pending applications
          </h2>
          {section.data && !pending.length && (
            <p className={panel}>No applications awaiting review.</p>
          )}
          {pending.map((item) => (
            <ActionForm
              key={item.id}
              title={item.applicant.displayName}
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
              <p className="break-all text-xs text-slate-600">
                {item.applicant.email}
              </p>
              <p className="whitespace-pre-wrap break-words rounded-lg bg-violet-50 p-3 text-sm">
                {item.profileText}
              </p>
              <label className="block text-sm">
                Decision
                <select name="status" className={field}>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </label>
              <label className="block text-sm">
                Decision reason{" "}
                <textarea required name="reason" className={field} />
              </label>
            </ActionForm>
          ))}
        </section>
        <section className={panel} aria-labelledby="application-history">
          <h2 id="application-history" className="font-bold text-violet-950">
            Decision history
          </h2>
          {section.data && !history.length && (
            <p className="text-sm text-slate-600">No decisions recorded yet.</p>
          )}
          {history.map((item) => (
            <article
              key={item.id}
              className="break-words border-t border-slate-100 pt-3 text-sm"
            >
              <h3 className="font-semibold">
                {item.applicant.displayName} · {item.status}
              </h3>
              <p className="text-slate-600">{item.decisionReason}</p>
            </article>
          ))}
        </section>
      </div>
    </AdminSection>
  );
}
