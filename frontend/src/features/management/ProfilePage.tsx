import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { refreshSession, useSession } from "../auth/session";
import ChangePasswordForm from "../auth/components/ChangePasswordForm";
import {
  managementRequest as request,
  managementError,
  field,
  panel,
  type UserRow,
  type ApplicationRow,
} from "./managementApi";
import { getWorkspaceTheme } from "./workspaceTheme";

const APPLICATION_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending review",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
};

export default function ProfilePage({ student = true }: { student?: boolean }) {
  const { session } = useSession();
  return <Content key={session?.user.id} student={student} />;
}

function Content({ student }: { student: boolean }) {
  const { pathname } = useLocation();
  const theme = getWorkspaceTheme(pathname, student);
  const [user, setUser] = useState<UserRow | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [applicationError, setApplicationError] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [busySection, setBusySection] = useState<
    "profile" | "application" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const action = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [profile, ownApplications] = await Promise.all([
          request<UserRow>("GET", "/auth/me"),
          student ? request<ApplicationRow[]>("GET", "/me/instructor-applications") : [],
        ]);
        if (active) {
          setUser(profile);
          setApplications(ownApplications);
        }
      } catch (cause) {
        if (active) setLoadError(managementError(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refresh, student]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.current || loading || busySection) return;
    const data = new FormData(event.currentTarget);

    action.current = true;
    setBusySection("profile");
    setProfileError("");
    setProfileMessage("");

    try {
      const updated = await request<UserRow>("PATCH", "/me/profile", {
        displayName: data.get("displayName"),
        ...(student && {
          targetBand: data.get("targetBand") ? Number(data.get("targetBand")) : null,
          targetExamDate: data.get("examDate") || null,
        }),
      });
      setUser(updated);
      let sessionUpdated = true;
      try {
        await refreshSession();
      } catch {
        sessionUpdated = false;
      }
      setRefresh((value) => value + 1);
      setProfileMessage(
        sessionUpdated
          ? "Your profile has been saved."
          : "Your profile was saved. Your account menu could not refresh yet; reload later if needed.",
      );
    } catch (cause) {
      setProfileError(managementError(cause));
    } finally {
      action.current = false;
      setBusySection(null);
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.current || loading || busySection) return;
    const form = event.currentTarget;
    const data = new FormData(form);

    action.current = true;
    setBusySection("application");
    setApplicationError("");
    setApplicationMessage("");

    try {
      await request<ApplicationRow>("POST", "/instructor-applications", {
        profileText: data.get("profileText"),
      });
      form.reset();
      setRefresh((value) => value + 1);
      setApplicationMessage(
        "Your instructor application has been submitted for review.",
      );
    } catch (cause) {
      setApplicationError(managementError(cause));
    } finally {
      action.current = false;
      setBusySection(null);
    }
  }

  const pendingApplication = applications.some(
    (application) => application.status === "PENDING",
  );
  const canApplyAsInstructor =
    student && user != null &&
    user.roles.includes("LEARNER") &&
    !user.roles.includes("INSTRUCTOR");

  return (
    <div className={student ? "student-surface-overview min-h-[calc(100vh-4rem)]" : undefined}>
      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${theme.eyebrowText}`}
        >
          Account settings
        </span>
        <h1 className="text-2xl font-bold text-slate-900">
          {student ? "Profile and learning goals" : "Profile"}
        </h1>
        <p className="text-sm text-slate-500">
          {student ? "Manage your display name and IELTS learning goals." : "Manage how your name appears across the workspace."}
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{loadError}</p>
          <button
            type="button"
            disabled={loading || !!busySection}
            onClick={() => setRefresh((value) => value + 1)}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !user && (
        <p role="status" className="text-sm text-slate-500">
          Loading profile...
        </p>
      )}

      {user && (
        <>
          <form
            key={`${user.displayName}:${user.targetBand}:${user.targetExamDate}`}
            onSubmit={(event) => void handleProfileSubmit(event)}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <fieldset
              disabled={busySection !== null || loading}
              className="min-w-0 space-y-6"
            >
              <section className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Account details
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">
                    Email address
                    <input
                      readOnly
                      value={user.email}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">
                    Display name
                    <input
                      required
                      name="displayName"
                      maxLength={120}
                      defaultValue={user.displayName}
                      className={`${field} mt-1.5`}
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Shown in the navigation bar and on your course submissions.
                  </p>
                </div>
              </section>

              {student && <section className="space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Learning goals
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Personal IELTS preparation references saved to your learner
                    profile.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-900">
                      Target band
                      <input
                        name="targetBand"
                        type="number"
                        min={0}
                        max={9}
                        step={0.5}
                        defaultValue={user.targetBand ?? ""}
                        placeholder="e.g. 7.0"
                        className={`${field} mt-1.5`}
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Shown in your learner header and account menu when set.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900">
                      Target exam date
                      <input
                        name="examDate"
                        type="date"
                        defaultValue={user.targetExamDate?.slice(0, 10) ?? ""}
                        className={`${field} mt-1.5`}
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved as your personal exam date reference; does not alter
                      course due dates or recommendations.
                    </p>
                  </div>
                </div>
              </section>}

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className={`w-full rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto ${theme.primaryButton}`}
                  >
                    {busySection === "profile"
                      ? "Saving..."
                      : student ? "Save profile and goals" : "Save profile"}
                  </button>
                </div>
                {profileMessage && (
                  <p
                    role="status"
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
                  >
                    {profileMessage}
                  </p>
                )}
                {profileError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                  >
                    {profileError}
                  </p>
                )}
              </div>
            </fieldset>
          </form>

          <ChangePasswordForm buttonClassName={theme.primaryButton} />

          {student && (canApplyAsInstructor || applications.length > 0) && (
            <section className={`${panel} shadow-sm`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Instructor access
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Apply for instructor permissions to author courses and review
                    learner submissions.
                  </p>
                </div>
                {user.roles.includes("INSTRUCTOR") && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Instructor active
                  </span>
                )}
              </div>

              {applicationMessage && (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
                >
                  {applicationMessage}
                </p>
              )}
              {applicationError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {applicationError}
                </p>
              )}

              {applications.map((application) => {
                const badge = APPLICATION_STATUS_STYLES[application.status] ?? {
                  label: application.status,
                  className: "bg-slate-100 text-slate-700",
                };
                return (
                  <article
                    key={application.id}
                    className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        Submitted{" "}
                        {new Date(application.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {application.decisionReason && (
                      <p className="text-sm text-slate-900">
                        <span className="font-semibold">Decision note:</span>{" "}
                        {application.decisionReason}
                      </p>
                    )}
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer font-semibold text-brand-800 hover:underline">
                        View submitted qualifications
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        {application.profileText}
                      </p>
                    </details>
                  </article>
                );
              })}

              {canApplyAsInstructor && pendingApplication && (
                <p
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
                >
                  You already have a pending instructor application. An
                  administrator will review it before you can submit another.
                </p>
              )}

              {canApplyAsInstructor && !pendingApplication && (
                <details className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-brand-800 [&::-webkit-details-marker]:hidden">
                    <span>
                      {applications.length > 0
                        ? "Submit a new instructor application"
                        : "Apply to become an instructor"}
                    </span>
                    <span className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 group-open:hidden">
                      Open form
                    </span>
                    <span className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 group-open:inline">
                      Hide form
                    </span>
                  </summary>
                  <form
                    onSubmit={(event) => void handleApplicationSubmit(event)}
                    className="mt-4 border-t border-slate-200 pt-4"
                  >
                    <fieldset
                      disabled={busySection !== null || loading}
                      className="min-w-0 space-y-3"
                    >
                      <p className="text-sm text-slate-500">
                        Describe your qualifications and teaching experience. An
                        administrator will review your application.
                      </p>
                      <label className="block text-sm font-medium text-slate-900">
                        Qualifications and experience
                        <textarea
                          required
                          maxLength={20000}
                          name="profileText"
                          rows={5}
                          className={`${field} mt-1.5`}
                        />
                      </label>
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50 sm:w-auto"
                      >
                        {busySection === "application"
                          ? "Submitting..."
                          : "Submit application"}
                      </button>
                    </fieldset>
                  </form>
                </details>
              )}
            </section>
          )}
        </>
      )}
      </main>
    </div>
  );
}
