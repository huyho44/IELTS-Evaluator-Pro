import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import WorkspaceLinks from "../../../features/auth/components/WorkspaceLinks";
import {
  formatUnreadBadge,
  useNotifications,
} from "../../../features/management/notificationsStore";
import {
  INSTRUCTOR_NAV_ITEMS,
  type InstructorSectionKey,
} from "./instructorNav";

interface InstructorHeaderProps {
  activeKey?: InstructorSectionKey;
  user: {
    id?: string;
    displayName: string;
    email: string;
    roles: string[];
  };
  onOpenMobileMenu: () => void;
  mobileMenuOpen: boolean;
}

function resolveFallbackTitle(pathname: string): string {
  if (pathname.includes("/profile")) return "Profile";
  if (pathname.includes("/notifications")) return "Notifications";
  if (pathname.includes("/dashboard")) return "Account overview";
  return "Account";
}

export default function InstructorHeader({
  activeKey,
  user,
  onOpenMobileMenu,
  mobileMenuOpen,
}: InstructorHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentSection = INSTRUCTOR_NAV_ITEMS.find((i) => i.key === activeKey);
  const pageTitle = currentSection?.label ?? resolveFallbackTitle(pathname);
  const { items: notifications } = useNotifications(user.id);
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
      if (accountOpen && event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-teal-100 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open instructor menu"
          aria-expanded={mobileMenuOpen}
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-teal-50 hover:text-teal-800 lg:hidden"
        >
          ☰
        </button>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden font-semibold text-teal-700/80 sm:inline">
            Instructor Workspace
          </span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="truncate text-base font-bold text-slate-900">
            {pageTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/teacher/notifications"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
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
            <span className="absolute -right-1 -top-1 rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unread.badgeText}
            </span>
          )}
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Open instructor account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-full border border-teal-200/80 bg-teal-50/40 py-1.5 pl-1.5 pr-3 text-left transition hover:border-teal-300 hover:bg-teal-50"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-700 text-xs font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-900">
                {user.displayName}
              </span>
              <span className="block text-[11px] font-medium text-teal-700">
                {user.roles.includes("ADMIN")
                  ? "Admin · Instructor"
                  : "Instructor"}
              </span>
            </span>
          </button>

          {accountOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="p-1.5" onClick={() => setAccountOpen(false)}>
                <Link
                  to="/teacher/dashboard"
                  className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                >
                  Account overview
                </Link>
                <Link
                  to="/teacher/profile"
                  className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                >
                  Profile
                </Link>
                <Link
                  to="/teacher/notifications"
                  className="flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                >
                  <span>Notifications</span>
                  {unread.count > 0 && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                      {unread.badgeText}
                    </span>
                  )}
                </Link>
                <WorkspaceLinks
                  roles={user.roles}
                  currentRole="INSTRUCTOR"
                  className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
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
  );
}
