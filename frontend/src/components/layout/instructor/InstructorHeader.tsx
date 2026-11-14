// src/components/layout/instructor/InstructorHeader.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  INSTRUCTOR_NAV_ITEMS,
  type InstructorSectionKey,
} from "./instructorNav";

interface InstructorHeaderProps {
  activeKey: InstructorSectionKey;
  user: {
    displayName: string;
    email: string;
    roles: string[];
  };
  onOpenMobileMenu: () => void;
  mobileMenuOpen: boolean;
}

export default function InstructorHeader({
  activeKey,
  user,
  onOpenMobileMenu,
  mobileMenuOpen,
}: InstructorHeaderProps) {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentSection = INSTRUCTOR_NAV_ITEMS.find((i) => i.key === activeKey);

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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open instructor menu"
          aria-expanded={mobileMenuOpen}
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          ☰
        </button>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden font-semibold text-slate-500 sm:inline">
            Instructor Workspace
          </span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <h1 className="truncate text-base font-bold text-slate-900">
            {currentSection?.label ?? "Workspace"}
          </h1>
        </div>
      </div>

      {/* Account menu đồng bộ hành vi với StudentNavbar */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen((prev) => !prev)}
          className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3 text-left hover:bg-slate-100"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-900">
              {user.displayName}
            </span>
            <span className="block text-[11px] font-medium text-slate-500">
              {user.roles.includes("ADMIN") ? "Admin · Instructor" : "Instructor"}
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
                to="/dashboard"
                className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Account overview
              </Link>
              <Link
                to="/courses"
                className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Student catalog
              </Link>
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
    </header>
  );
}