import { Link, NavLink } from "react-router-dom";
import WorkspaceLinks from "../../../features/auth/components/WorkspaceLinks";
import { useSession } from "../../../features/auth/session";
import {
  INSTRUCTOR_NAV_ITEMS,
  type InstructorSectionKey,
} from "./instructorNav";

interface InstructorSidebarProps {
  activeKey?: InstructorSectionKey;
  onNavigate?: () => void;
}

function NavIcon({ section }: { section: InstructorSectionKey }) {
  if (section === "review-queue") {
    return (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (section === "course-authoring") {
    return (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default function InstructorSidebar({
  activeKey,
  onNavigate,
}: InstructorSidebarProps) {
  const { session } = useSession();
  const roles = session?.user.roles ?? [];
  const hasOtherWorkspaces = roles.some((r) => r === "ADMIN" || r === "LEARNER");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-teal-100 bg-[#f5fbfa]">
      <div className="border-b border-teal-100 px-5 py-4">
        <Link
          to="/teacher/reviews"
          onClick={onNavigate}
          className="block text-base font-bold text-teal-700 focus-visible:outline focus-visible:outline-2"
        >
          IELTS Evaluator Pro
        </Link>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20">
            Instructor Workspace
          </span>
        </div>
      </div>

      <nav
        aria-label="Instructor navigation"
        className="flex flex-1 flex-col gap-5 p-3"
      >
        <div className="space-y-1">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800/70">
            Workspace
          </p>

          {INSTRUCTOR_NAV_ITEMS.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-white font-semibold text-teal-800 shadow-2xs ring-1 ring-teal-200/70"
                    : "font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-teal-600"
                  />
                )}

                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={
                      isActive
                        ? "text-teal-700"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  >
                    <NavIcon section={item.key} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate leading-tight">{item.label}</div>
                    <div
                      className={`mt-0.5 truncate text-[11px] font-normal ${
                        isActive ? "text-teal-700/80" : "text-slate-400"
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-teal-100 pt-3">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Account
          </p>
          {[
            { to: "/teacher/dashboard", label: "Account overview" },
            { to: "/teacher/profile", label: "Profile" },
            { to: "/teacher/notifications", label: "Notifications" },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                "block rounded-lg px-3 py-2 text-sm font-medium transition " +
                (isActive
                  ? "bg-white font-semibold text-teal-800 ring-1 ring-teal-200/70"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900")
              }
            >
              {item.label}
            </NavLink>
          ))}
          {hasOtherWorkspaces && (
            <div className="pt-2">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Switch workspace
              </p>
              <WorkspaceLinks
                roles={roles}
                currentRole="INSTRUCTOR"
                onNavigate={onNavigate}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-teal-800 hover:bg-white"
              />
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
