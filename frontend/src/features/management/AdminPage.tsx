import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/session";
import ActionForm from "./ActionForm";
import {
  managementRequest as request,
  managementError,
  field,
  panel,
  type UserRow,
  type SkillRow,
  type ApplicationRow,
  type Catalog,
} from "./managementApi";

export default function AdminPage() {
  const { session } = useSession();
  return <AdminContent key={session?.user.id} />;
}
function AdminContent() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0);
  const action = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      request<UserRow[]>("GET", "/admin/users"),
      request<ApplicationRow[]>("GET", "/admin/instructor-applications"),
      request<SkillRow[]>("GET", "/skills"),
      request<Catalog>("GET", "/authoring/catalog"),
    ])
      .then(([u, a, s, c]) => {
        if (active) {
          setUsers(u);
          setApplications(a);
          setSkills(s);
          setCatalog(c);
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
  }, [refresh]);
  async function run(
    method: "POST" | "PATCH" | "PUT",
    path: string,
    body: unknown,
  ) {
    if (action.current) return false;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(method, path, body);
      setMessage("Saved.");
      setRefresh((v) => v + 1);
      return true;
    } catch (cause) {
      setError(managementError(cause));
      return false;
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="text-sm text-slate-600">
        Manage accounts, instructor approval, course assignments and the skill
        catalog. Changes to access require a recorded reason.
      </p>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
          <button
            onClick={() => {
              setError("");
              setRefresh((v) => v + 1);
            }}
            className="ml-3 underline"
          >
            Reload
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
      {loading && <p role="status">Loading administration...</p>}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Accounts</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {users.map((user) => (
            <ActionForm
              key={`${user.id}:${user.status}:${user.roles.join()}`}
              title={`${user.displayName} · ${user.email}`}
              busy={busy}
              submit={(data) =>
                run("PATCH", `/admin/users/${user.id}`, {
                  status: data.get("status"),
                  roles: data.getAll("roles"),
                  reason: data.get("reason"),
                })
              }
            >
              <label className="block text-sm">
                Account status
                <select
                  name="status"
                  defaultValue={user.status}
                  className={field}
                >
                  <option>ACTIVE</option>
                  <option>SUSPENDED</option>
                  <option>CLOSED</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-4">
                {["LEARNER", "INSTRUCTOR", "ADMIN"].map((role) => (
                  <label key={role} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      defaultChecked={user.roles.includes(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
              <label className="block text-sm">
                Reason
                <input
                  required
                  name="reason"
                  maxLength={10000}
                  className={field}
                />
              </label>
            </ActionForm>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Instructor applications</h2>
        {!applications.length && <p className={panel}>No applications.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {applications.map((item) =>
            item.status === "PENDING" ? (
              <ActionForm
                key={item.id}
                title={`${item.applicant.displayName} · ${item.applicant.email}`}
                busy={busy}
                submit={(data) =>
                  run(
                    "POST",
                    `/admin/instructor-applications/${item.id}/decision`,
                    { status: data.get("status"), reason: data.get("reason") },
                  )
                }
              >
                <p className="whitespace-pre-wrap text-sm">
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
                  Decision reason
                  <textarea required name="reason" className={field} />
                </label>
              </ActionForm>
            ) : (
              <article key={item.id} className={panel}>
                <h3 className="font-bold">
                  {item.applicant.displayName} · {item.status}
                </h3>
                <p className="text-sm">{item.decisionReason}</p>
              </article>
            ),
          )}
        </div>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ActionForm
          title="Assign an instructor to a course"
          busy={busy}
          submit={(data) =>
            run("POST", `/courses/${data.get("courseId")}/instructors`, {
              instructorId: data.get("instructorId"),
              responsibility: data.get("responsibility"),
              reason: data.get("reason"),
            })
          }
        >
          <label className="block text-sm">
            Course
            <select required name="courseId" className={field}>
              <option value="">Choose course</option>
              {catalog?.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Instructor
            <select required name="instructorId" className={field}>
              <option value="">Choose instructor</option>
              {users
                .filter(
                  (u) =>
                    u.status === "ACTIVE" && u.roles.includes("INSTRUCTOR"),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} · {u.email}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            Responsibility
            <select name="responsibility" className={field}>
              <option>REVIEWER</option>
              <option>OWNER</option>
            </select>
          </label>
          <label className="block text-sm">
            Reason
            <input required name="reason" className={field} />
          </label>
        </ActionForm>
        <ActionForm
          title="Publish a skill"
          busy={busy}
          submit={(data) =>
            run("POST", "/skills", {
              code: data.get("code"),
              name: data.get("name"),
              skillArea: data.get("skillArea"),
              observableDefinition: data.get("definition"),
              status: "PUBLISHED",
            })
          }
        >
          <label className="block text-sm">
            Code
            <input required name="code" maxLength={80} className={field} />
          </label>
          <label className="block text-sm">
            Name
            <input required name="name" maxLength={160} className={field} />
          </label>
          <label className="block text-sm">
            Skill area
            <select name="skillArea" className={field}>
              {["WRITING", "READING", "LISTENING", "SPEAKING"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            What can a teacher observe?
            <textarea required name="definition" className={field} />
          </label>
        </ActionForm>
        <ActionForm
          title="Set skill prerequisites"
          busy={busy}
          submit={(data) =>
            run("PUT", `/skills/${data.get("skillId")}/prerequisites`, {
              prerequisites: data
                .getAll("prerequisite")
                .map((id) => ({
                  prerequisiteSkillId: id,
                  minStrength: Number(data.get("strength")),
                  minSupport: Number(data.get("support")),
                })),
            })
          }
        >
          <label className="block text-sm">
            Target skill
            <select required name="skillId" className={field}>
              <option value="">Choose skill</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.skillArea}: {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Required skills (Ctrl/Cmd-click to select multiple; none clears
            prerequisites)
            <select
              multiple
              name="prerequisite"
              className={`${field} min-h-36`}
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.skillArea}: {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Minimum strength
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              name="strength"
              defaultValue={0.6}
              className={field}
            />
          </label>
          <label className="block text-sm">
            Minimum evidence support
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              name="support"
              defaultValue={0.33}
              className={field}
            />
          </label>
        </ActionForm>
        <section className={panel}>
          <h2 className="text-lg font-bold">Published and archived skills</h2>
          {skills.map((s) => (
            <div key={s.id} className="border-t pt-3">
              <p className="font-semibold">
                {s.name} · {s.status}
              </p>
              <p className="text-sm text-slate-600">{s.observableDefinition}</p>
              <p className="mt-1 text-xs text-slate-500">
                Prerequisites:{" "}
                {s.skillPrerequisites
                  .map(
                    (p) =>
                      skills.find((v) => v.id === p.prerequisiteSkillId)
                        ?.name ?? "Unavailable skill",
                  )
                  .join(", ") || "None"}
              </p>
              <button
                disabled={busy}
                className="mt-2 text-sm font-semibold text-blue-700"
                onClick={() =>
                  void run("PATCH", `/skills/${s.id}`, {
                    status: s.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED",
                  })
                }
              >
                {s.status === "PUBLISHED" ? "Archive skill" : "Publish skill"}
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
