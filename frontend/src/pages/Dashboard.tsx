import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/session";
export default function Dashboard() {
  const { session } = useSession();
  const navigate = useNavigate();
  const user = session?.user;
  if (!user) return null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Account overview</h1>
        <dl className="mt-6 grid gap-5 break-words sm:grid-cols-2">
          {[
            ["Display name", user.displayName],
            ["Email", user.email],
            ["Roles", user.roles.join(", ") || "Not set"],
            ["Target band", user.targetBand ?? "Not set"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            to="/courses"
          >
            Browse courses
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            to="/practice-history"
          >
            My practice attempts
          </Link>
          <button
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
            onClick={() => {
              navigate("/logout");
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
