import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../auth/session";
import WorkspaceLinks from "../auth/components/WorkspaceLinks";

const sections = [
  { to: "/admin", label: "Accounts", end: true },
  { to: "/admin/instructor-approvals", label: "Instructor approvals" },
  { to: "/admin/course-assignments", label: "Course assignments" },
  { to: "/admin/skills", label: "Skill catalog" },
  { to: "/admin/authoring", label: "Grading setup" },
  { to: "/admin/reports", label: "Grading reports" },
];

const accountLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-100";

export default function AdminLayout() {
  const { session } = useSession();
  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      <header className="border-b border-violet-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <NavLink
            to="/admin"
            className="flex items-center gap-3 font-bold text-violet-950"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-violet-700 text-white"
            >
              A
            </span>
            IELTS Evaluator Pro
          </NavLink>
          <nav
            aria-label="Admin account"
            className="flex flex-wrap items-center gap-1"
          >
            <NavLink to="/admin/dashboard" className={accountLink}>
              Account
            </NavLink>
            <NavLink to="/admin/notifications" className={accountLink}>
              Notifications
            </NavLink>
            <NavLink to="/admin/profile" className={accountLink}>
              Profile
            </NavLink>
            <NavLink to="/logout" className={accountLink}>
              Sign out
            </NavLink>
          </nav>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-violet-100 bg-white px-4 py-5 lg:border-b-0 lg:border-r">
          <p className="px-3 pb-3 text-xs font-bold uppercase tracking-wider text-violet-800">
            Administration
          </p>
          <nav
            aria-label="Administration"
            className="flex flex-wrap gap-1 lg:flex-col"
          >
            {sections.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  "rounded-lg px-3 py-2.5 text-sm font-medium " +
                  (isActive
                    ? "bg-violet-100 text-violet-900"
                    : "text-slate-700 hover:bg-violet-50")
                }
              >
                {label}
              </NavLink>
            ))}
            <WorkspaceLinks
              roles={session?.user.roles ?? []}
              currentRole="ADMIN"
              className={accountLink}
            />
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
