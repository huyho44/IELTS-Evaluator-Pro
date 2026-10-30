import { useEffect, useRef, useState } from "react";
import { refreshSession, useSession } from "../auth/session";
import ActionForm from "./ActionForm";
import {
  managementRequest as request,
  managementError,
  field,
  panel,
  type UserRow,
  type ApplicationRow,
} from "./managementApi";

export default function ProfilePage() {
  const { session } = useSession();
  return <Content key={session?.user.id} />;
}
function Content() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const action = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profile, ownApplications] = await Promise.all([
          request<UserRow>("GET", "/auth/me"),
          request<ApplicationRow[]>("GET", "/me/instructor-applications"),
        ]);
        if (active) {
          setUser(profile);
          setApplications(ownApplications);
        }
      } catch (cause) {
        if (active) setError(managementError(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refresh]);

  async function run(
    path: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST",
  ) {
    if (action.current) return false;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await request<UserRow>(method, path, body);
      let sessionUpdated = true;
      if (method === "PATCH") {
        setUser(updated);
        try {
          await refreshSession();
        } catch {
          sessionUpdated = false;
        }
      }
      setRefresh((value) => value + 1);
      setMessage(
        sessionUpdated
          ? "Saved."
          : "Your profile was saved. Your account menu could not refresh yet; check your connection and reload it later.",
      );
      return true;
    } catch (cause) {
      setError(managementError(cause));
      return false;
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  const pendingApplication = applications.some(
    (application) => application.status === "PENDING",
  );
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Profile and learning goals</h1>
      {error && (
        <div role="alert" className="space-y-2 text-red-700">
          <p>{error}</p>
          <button
            disabled={loading || busy}
            onClick={() => setRefresh((value) => value + 1)}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
      {loading && !user && <p role="status">Loading profile...</p>}
      {user && (
        <>
          <ActionForm
            key={`${user.displayName}:${user.targetBand}:${user.targetExamDate}`}
            title={user.email}
            busy={busy || loading}
            submit={(data) =>
              run(
                "/me/profile",
                {
                  displayName: data.get("displayName"),
                  targetBand: data.get("targetBand")
                    ? Number(data.get("targetBand"))
                    : null,
                  targetExamDate: data.get("examDate") || null,
                },
                "PATCH",
              )
            }
          >
            <label className="block text-sm">
              Display name
              <input
                required
                name="displayName"
                maxLength={120}
                defaultValue={user.displayName}
                className={field}
              />
            </label>
            <label className="block text-sm">
              Target band
              <input
                name="targetBand"
                type="number"
                min={0}
                max={9}
                step={0.5}
                defaultValue={user.targetBand ?? ""}
                className={field}
              />
            </label>
            <label className="block text-sm">
              Target exam date
              <input
                name="examDate"
                type="date"
                defaultValue={user.targetExamDate?.slice(0, 10) ?? ""}
                className={field}
              />
            </label>
          </ActionForm>
          {user.roles.includes("LEARNER") &&
            !user.roles.includes("INSTRUCTOR") && (
              <ActionForm
                title="Apply to become an instructor"
                busy={busy || loading || pendingApplication}
                label="Submit application"
                submit={(data) =>
                  run("/instructor-applications", {
                    profileText: data.get("profileText"),
                  })
                }
              >
                <p className="text-sm text-slate-600">
                  Describe your qualifications and teaching experience. An
                  administrator will review your application.
                </p>
                <label className="block text-sm">
                  Qualifications and experience
                  <textarea
                    required
                    maxLength={20000}
                    name="profileText"
                    rows={6}
                    className={field}
                  />
                </label>
                {pendingApplication && (
                  <p className="text-sm">
                    You already have a pending application.
                  </p>
                )}
              </ActionForm>
            )}
          {applications.map((application) => (
            <article key={application.id} className={panel}>
              <h2 className="font-bold">
                Instructor application · {application.status}
              </h2>
              <p className="whitespace-pre-wrap text-sm">
                {application.profileText}
              </p>
              {application.decisionReason && (
                <p className="text-sm text-slate-600">
                  Decision: {application.decisionReason}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
