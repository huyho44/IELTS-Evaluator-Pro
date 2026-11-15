import { Link } from "react-router-dom";
import { useSession } from "../features/auth/session";

const ROLE_LABELS: Record<string, string> = {
  LEARNER: "Learner",
  INSTRUCTOR: "Instructor",
  ADMIN: "Administrator",
};

export default function Dashboard({ student = true }: { student?: boolean }) {
  const { session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const isLearner = student && user.roles.includes("LEARNER");

  return (
    <div
      className={
        student
          ? "student-surface-overview min-h-[calc(100vh-4rem)]"
          : undefined
      }
    >
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#2563eb] text-base font-bold text-white"
              >
                {user.displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">
                  Account overview
                </p>
                <h1 className="truncate text-2xl font-bold text-[#0f172a]">
                  {user.displayName}
                </h1>
              </div>
            </div>
            <Link
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] sm:w-auto"
              to="../profile"
            >
              {student ? "Edit profile & learning goals" : "Edit profile"}
            </Link>
          </div>

          <dl className="mt-6 grid gap-5 break-words sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Display name
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#0f172a]">
                {user.displayName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Email address
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#0f172a]">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Account roles
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {user.roles.length ? (
                  user.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-semibold text-[#1e40af]"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-semibold text-slate-600">
                    Not set
                  </span>
                )}
              </dd>
            </div>
            {isLearner && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                  Target band
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#0f172a]">
                  {user.targetBand != null
                    ? `Band ${user.targetBand}`
                    : "Not set"}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </main>
    </div>
  );
}
