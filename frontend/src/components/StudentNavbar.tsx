import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/session";

export default function StudentNavbar() {
  const { session } = useSession();
  const user = session?.user;
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<
    "mobile" | "notifications" | "account" | null
  >(null);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const learning = /^\/(learning|skills|recommendations)(\/|$)/.test(
    location.pathname,
  );
  const practice =
    /^\/(practice-history|attempts)(\/|$)/.test(location.pathname) ||
    /\/practices\//.test(location.pathname);
  const courses =
    !practice && !learning && /^\/courses(\/|$)/.test(location.pathname);
  const hasTargetBand =
    user != null &&
    user.targetBand != null &&
    user.roles.includes("LEARNER") &&
    !user.roles.includes("ADMIN") &&
    !user.roles.includes("INSTRUCTOR");
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setMenu(null);
    }
    function escape(event: KeyboardEvent) {
      if (menu !== null && event.key === "Escape") {
        setMenu(null);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  const link =
    "flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";
  function toggle(
    value: "mobile" | "notifications" | "account",
    button: HTMLButtonElement,
  ) {
    trigger.current = button;
    setMenu((previous) => (previous === value ? null : value));
  }
  function navigation(mobile = false) {
    const tab = (active: boolean) =>
      mobile
        ? `flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${active ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#64748b] hover:bg-slate-50 hover:text-[#2563eb]"}`
        : `flex items-center border-b-2 whitespace-nowrap px-1 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${active ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-[#64748b] hover:text-[#2563eb]"}`;
    return (
      <>
        {user?.roles.includes("LEARNER") && (
          <Link
            to="/learning"
            aria-current={learning ? "page" : undefined}
            className={tab(learning)}
            onClick={() => setMenu(null)}
          >
            My Learning
          </Link>
        )}
        <Link
          to="/courses"
          aria-current={courses ? "page" : undefined}
          className={tab(courses)}
          onClick={() => setMenu(null)}
        >
          Courses
        </Link>
        <Link
          to="/practice-history"
          aria-current={practice ? "page" : undefined}
          className={tab(practice)}
          onClick={() => setMenu(null)}
        >
          My Practice Attempts
        </Link>
        {user?.roles.includes("INSTRUCTOR") && (
          <Link
            to="/teacher/reviews"
            aria-current={
              location.pathname.startsWith("/teacher/reviews")
                ? "page"
                : undefined
            }
            className={tab(location.pathname.startsWith("/teacher/reviews"))}
            onClick={() => setMenu(null)}
          >
            Review queue
          </Link>
        )}
        {user?.roles.includes("ADMIN") && (
          <Link
            to="/admin"
            aria-current={
              location.pathname.startsWith("/admin") ? "page" : undefined
            }
            className={tab(location.pathname.startsWith("/admin"))}
            onClick={() => setMenu(null)}
          >
            Administration
          </Link>
        )}
      </>
    );
  }
  return (
    <header ref={root} className="border-b border-[#e2e8f0] bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-0 px-4 sm:px-8 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-stretch">
        <Link
          to="/courses"
          onClick={() => setMenu(null)}
          className="shrink-0 whitespace-nowrap py-3.5 text-sm font-semibold text-[#2563eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] sm:text-lg xl:py-4 xl:text-[20px]"
        >
          IELTS Evaluator Pro
        </Link>
        <nav
          aria-label="Student navigation"
          className="hidden min-h-[66px] min-w-0 flex-1 items-stretch justify-center gap-7 self-stretch xl:flex"
        >
          {navigation()}
        </nav>
        <div className="relative ml-auto flex min-h-[56px] shrink-0 items-center gap-2 self-stretch sm:gap-2.5 xl:min-h-[66px]">
          <div className="relative flex items-center self-stretch">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={menu === "notifications"}
              aria-controls="notifications-panel"
              onClick={(e) => toggle("notifications", e.currentTarget)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] transition-colors hover:bg-slate-100 hover:text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${menu === "notifications" ? "bg-slate-100 text-[#2563eb]" : ""}`}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </button>
            {menu === "notifications" && (
              <div
                id="notifications-panel"
                className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[#e2e8f0] bg-white shadow-lg"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#0f172a]">
                    Notifications
                  </h2>
                </div>
                <div className="px-4 py-4 text-sm text-[#64748b]">
                  <Link
                    to={user ? "/notifications" : "/login"}
                    onClick={() => setMenu(null)}
                    className="font-semibold text-[#2563eb] hover:underline"
                  >
                    {user
                      ? "View your notifications"
                      : "Sign in to view notifications"}
                  </Link>
                </div>
              </div>
            )}
          </div>
          {user ? (
            <div className="relative flex min-w-0 items-center self-stretch">
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={menu === "account"}
                aria-controls="account-menu"
                onClick={(e) => toggle("account", e.currentTarget)}
                className="flex max-w-[180px] items-center gap-1.5 rounded-full border border-slate-200/80 bg-[#f8fafc] p-1 pr-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] sm:max-w-[260px] sm:pr-2.5"
              >
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-xs font-semibold text-[#1e40af]"
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span
                  className={
                    hasTargetBand
                      ? "hidden max-w-[140px] truncate text-sm font-semibold text-[#0f172a] sm:inline"
                      : "max-w-[84px] truncate text-sm font-semibold text-[#0f172a] sm:max-w-[140px]"
                  }
                >
                  {user.displayName}
                </span>
                {hasTargetBand && (
                  <span className="shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-semibold leading-4 text-[#1e40af]">
                    <span className="hidden sm:inline">Target </span>
                    {user.targetBand}
                  </span>
                )}
              </button>
              {menu === "account" && (
                <div
                  id="account-menu"
                  className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[#e2e8f0] bg-white shadow-lg"
                >
                  <div className="break-words border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-[#0f172a]">
                      {user.displayName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#64748b]">
                      {user.email}
                    </p>
                    {hasTargetBand && (
                      <p className="mt-1.5 inline-flex rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-semibold text-[#1e40af]">
                        Target band: {user.targetBand}
                      </p>
                    )}
                  </div>
                  <div className="p-1.5" onClick={() => setMenu(null)}>
                    <Link
                      className={`${link} text-slate-700 hover:bg-slate-50`}
                      to="/dashboard"
                    >
                      Account overview
                    </Link>
                    {user.roles.includes("INSTRUCTOR") && (
                      <Link
                        className={`${link} text-slate-700 hover:bg-slate-50`}
                        to="/teacher/reviews"
                      >
                        Instructor reviews
                      </Link>
                    )}
                    {user.roles.some((role) =>
                      ["INSTRUCTOR", "ADMIN"].includes(role),
                    ) && (
                      <Link
                        className={`${link} text-slate-700 hover:bg-slate-50`}
                        to="/teacher/authoring"
                      >
                        Course authoring
                      </Link>
                    )}
                    {user.roles.includes("ADMIN") && (
                      <Link
                        className={`${link} text-slate-700 hover:bg-slate-50`}
                        to="/admin"
                      >
                        Administration
                      </Link>
                    )}
                    <Link
                      className={`${link} text-slate-700 hover:bg-slate-50`}
                      to="/profile"
                    >
                      Profile & learning goals
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      className={`${link} w-full text-left text-red-600 hover:bg-red-50`}
                      onClick={() => {
                        setMenu(null);
                        navigate("/logout");
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold sm:gap-3">
              <Link
                className="rounded-lg px-2 py-2 text-[#1e40af] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
                to="/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-lg bg-[#2563eb] px-3 py-2 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
                to="/register"
              >
                Sign up
              </Link>
            </div>
          )}
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menu === "mobile"}
            aria-controls="mobile-navigation"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0f172a] transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] xl:hidden ${menu === "mobile" ? "bg-slate-100 text-[#2563eb]" : ""}`}
            onClick={(e) => toggle("mobile", e.currentTarget)}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {menu === "mobile" && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile student navigation"
            className="flex w-full flex-col gap-1 border-t border-slate-100 py-2 xl:hidden"
          >
            {navigation(true)}
          </nav>
        )}
      </div>
    </header>
  );
}
