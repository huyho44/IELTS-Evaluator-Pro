import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import WorkspaceLinks from "../auth/components/WorkspaceLinks";
import { useSession } from "../auth/session";
import {
  formatUnreadBadge,
  useNotifications,
} from "../management/notificationsStore";

type AdminSectionItem = {
  to: string;
  label: string;
  subtitle: string;
  end?: boolean;
  group: "governance" | "curriculum";
};

const ADMIN_SECTIONS: AdminSectionItem[] = [
  {
    to: "/admin",
    label: "Accounts",
    subtitle: "Roles & access status",
    end: true,
    group: "governance",
  },
  {
    to: "/admin/instructor-approvals",
    label: "Instructor approvals",
    subtitle: "Review applications",
    group: "governance",
  },
  {
    to: "/admin/course-assignments",
    label: "Course assignments",
    subtitle: "Owners & reviewers",
    group: "governance",
  },
  {
    to: "/admin/skills",
    label: "Skill catalog",
    subtitle: "Skills & prerequisites",
    group: "curriculum",
  },
  {
    to: "/admin/authoring",
    label: "Grading setup",
    subtitle: "Courses & AI config",
    group: "curriculum",
  },
  {
    to: "/admin/reports",
    label: "Grading reports",
    subtitle: "Operations & latency",
    group: "curriculum",
  },
];

function AdminNavIcon({ to }: { to: string }) {
  if (to === "/admin") {
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (to.includes("instructor-approvals")) {
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
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
  if (to.includes("course-assignments")) {
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
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
  if (to.includes("skills")) {
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    );
  }
  if (to.includes("authoring")) {
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
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

function AdminSidebarNav({
  roles,
  onNavigate,
}: {
  roles: readonly string[];
  onNavigate?: () => void;
}) {
  const governanceItems = ADMIN_SECTIONS.filter((s) => s.group === "governance");
  const curriculumItems = ADMIN_SECTIONS.filter((s) => s.group === "curriculum");
  const hasOtherWorkspaces = roles.some((r) => r === "INSTRUCTOR" || r === "LEARNER");

  const renderNavItem = ({ to, label, subtitle, end }: AdminSectionItem) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition " +
        (isActive
          ? "bg-violet-50 font-semibold text-violet-950 ring-1 ring-inset ring-violet-200/80"
          : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900")
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-violet-700"
            />
          )}
          <span
            className={
              isActive
                ? "text-violet-700"
                : "text-slate-400 group-hover:text-slate-600"
            }
          >
            <AdminNavIcon to={to} />
          </span>
          <span className="min-w-0">
            <span className="block truncate leading-tight">{label}</span>
            <span
              className={`mt-0.5 block truncate text-[11px] font-normal ${
                isActive ? "text-violet-700/80" : "text-slate-400"
              }`}
            >
              {subtitle}
            </span>
          </span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav aria-label="Administration" className="flex flex-col gap-5 p-3">
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-violet-800/80">
          Administration
        </p>
        {governanceItems.map(renderNavItem)}
      </div>

      <div className="space-y-1 border-t border-violet-100/80 pt-3">
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Curriculum &amp; Grading
        </p>
        {curriculumItems.map(renderNavItem)}
      </div>

      <div className="space-y-1 border-t border-violet-100/80 pt-3">
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Account
        </p>
        {[
          { to: "/admin/dashboard", label: "Account overview" },
          { to: "/admin/profile", label: "Profile" },
          { to: "/admin/notifications", label: "Notifications" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              "block rounded-lg px-3 py-2 text-sm font-medium transition " +
              (isActive
                ? "bg-violet-50 font-semibold text-violet-950"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
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
              currentRole="ADMIN"
              onNavigate={onNavigate}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50"
            />
          </div>
        )}
      </div>
    </nav>
  );
}

export default function AdminLayout() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = session?.user;
  const roles = user?.roles ?? [];
  const { items: notifications } = useNotifications(user?.id);
  const unread = formatUnreadBadge(notifications);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-violet-100 bg-white px-4 sm:px-6 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open administration menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-lg p-2 text-slate-600 hover:bg-violet-50 hover:text-violet-900 lg:hidden"
          >
            ☰
          </button>
          <NavLink
            to="/admin"
            className="flex min-w-0 items-center gap-2.5 font-bold text-violet-950"
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-700 text-sm font-bold text-white shadow-2xs"
            >
              A
            </span>
            <span className="truncate text-base">IELTS Evaluator Pro</span>
          </NavLink>
          <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 sm:inline-flex">
            Admin Console
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/admin/notifications"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
          >
            <svg
              aria-hidden="true"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread.count > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-violet-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread.badgeText}
              </span>
            )}
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Open admin account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-full border border-violet-200/80 bg-violet-50/50 py-1.5 pl-1.5 pr-3 text-left transition hover:bg-violet-50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
                {(user?.displayName ?? "A").charAt(0).toUpperCase()}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-900">
                  {user?.displayName ?? "Admin"}
                </span>
                <span className="block text-[11px] font-medium text-violet-700">
                  {roles.includes("INSTRUCTOR")
                    ? "Admin · Instructor"
                    : "Administrator"}
                </span>
              </span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user?.displayName ?? "Administrator"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email ?? ""}
                  </p>
                </div>
                <div className="p-1.5" onClick={() => setAccountOpen(false)}>
                  <Link
                    to="/admin/dashboard"
                    className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-950"
                  >
                    Account overview
                  </Link>
                  <Link
                    to="/admin/profile"
                    className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-950"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/admin/notifications"
                    className="flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-950"
                  >
                    <span>Notifications</span>
                    {unread.count > 0 && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                        {unread.badgeText}
                      </span>
                    )}
                  </Link>
                  <WorkspaceLinks
                    roles={roles}
                    currentRole="ADMIN"
                    className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50"
                  />
                </div>
                <div className="border-t border-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      navigate("/logout");
                    }}
                    className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-violet-100 bg-white lg:block">
          <AdminSidebarNav roles={roles} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-72 flex-col overflow-y-auto border-r border-violet-100 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3.5">
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                  Admin Console
                </span>
                <button
                  type="button"
                  aria-label="Close administration menu"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <AdminSidebarNav
                roles={roles}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
