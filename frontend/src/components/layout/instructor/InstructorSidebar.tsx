// src/components/layout/instructor/InstructorSidebar.tsx
import { Link } from "react-router-dom";
import {
  INSTRUCTOR_NAV_ITEMS,
  type InstructorSectionKey,
} from "./instructorNav";

interface InstructorSidebarProps {
  activeKey: InstructorSectionKey;
  roles: string[];
  pendingCount?: number;
  onNavigate?: () => void;
}

function NavIcon({ section }: { section: InstructorSectionKey }) {
  if (section === "review-queue") {
    return (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (section === "course-authoring") {
    return (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default function InstructorSidebar({
  activeKey,
  roles,
  pendingCount,
  onNavigate,
}: InstructorSidebarProps) {
  const isAdmin = roles.includes("ADMIN");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Nhận diện Instructor Workspace */}
      <div className="border-b border-slate-200 px-5 py-4">
        <Link
          to="/teacher/reviews"
          onClick={onNavigate}
          className="block text-base font-bold text-blue-600 focus-visible:outline focus-visible:outline-2"
        >
          IELTS Evaluator Pro
        </Link>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
            Instructor Workspace
          </span>
          {isAdmin && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Menu điều hướng chính */}
      <nav aria-label="Instructor navigation" className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-0 top-2 w-1 rounded-r bg-blue-600"
                />
              )}

              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    isActive
                      ? "text-blue-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }
                >
                  <NavIcon section={item.key} />
                </span>
                <div className="min-w-0">
                  <div className="truncate leading-tight">{item.label}</div>
                  <div
                    className={`mt-0.5 truncate text-[11px] font-normal ${
                      isActive ? "text-blue-600/80" : "text-slate-400"
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {item.key === "review-queue" &&
                typeof pendingCount === "number" &&
                pendingCount > 0 && (
                  <span
                    className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}
            </Link>
          );
        })}
      </nav>

      {/* Chuyển nhanh về Student Catalog */}
      <div className="border-t border-slate-200 p-3">
        <Link
          to="/courses"
          onClick={onNavigate}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600"
        >
          <span>← Student Course Catalog</span>
        </Link>
      </div>
    </aside>
  );
}