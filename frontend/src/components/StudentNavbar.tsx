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
  const practice =
    /^\/(practice-history|attempts)(\/|$)/.test(location.pathname) ||
    /\/practices\//.test(location.pathname);
  const courses = !practice && /^\/courses(\/|$)/.test(location.pathname);
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
  function navigation() {
    const tab = (active: boolean) =>
      `flex items-center border-b-[3px] whitespace-nowrap px-1 py-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 ${active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-blue-600"}`;
    return (
      <>
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
          My practice attempts
        </Link>
        {["Feedback & Homework", "My Progress"].map((label) => (
          <span
            key={label}
            className="flex items-center gap-1.5 whitespace-nowrap py-3 text-[13px] text-slate-500"
          >
            {label}
            <span className="inline-flex w-fit shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              Coming soon
            </span>
          </span>
        ))}
      </>
    );
  }
  return (
    <header ref={root} className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-0 px-4 sm:px-8 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-stretch">
        <Link
          to="/courses"
          onClick={() => setMenu(null)}
          className="shrink-0 py-4 text-lg font-bold text-blue-600 focus-visible:outline focus-visible:outline-2"
        >
          IELTS Evaluator Pro
        </Link>
        <nav
          aria-label="Student navigation"
          className="hidden min-h-16 min-w-0 flex-1 items-stretch justify-center gap-6 self-stretch xl:flex"
        >
          {navigation()}
        </nav>
        <div className="relative ml-auto flex min-h-16 shrink-0 items-center gap-2.5 self-stretch">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menu === "mobile"}
            aria-controls="mobile-navigation"
            className="rounded-lg p-2 text-slate-600 focus-visible:outline focus-visible:outline-2 xl:hidden"
            onClick={(e) => toggle("mobile", e.currentTarget)}
          >
            ☰
          </button>
          <div className="relative flex items-center self-stretch">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={menu === "notifications"}
              aria-controls="notifications-panel"
              onClick={(e) => toggle("notifications", e.currentTarget)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 ${menu === "notifications" ? "bg-slate-100 text-blue-600" : ""}`}
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </button>
            {menu === "notifications" && (
              <div
                id="notifications-panel"
                className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Notifications
                  </h2>
                </div>
                <div className="px-4 py-4 text-sm text-slate-500">
                  Notifications are not available yet.
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
                className="flex max-w-[160px] sm:max-w-[200px] items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700"
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {user.displayName}
                  </span>
                  <span className="block text-[11px] font-semibold leading-4 text-blue-600">
                    {user.targetBand == null
                      ? "Target not set"
                      : `Target ${user.targetBand}`}
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className={`shrink-0 ${menu === "account" ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menu === "account" && (
                <div
                  id="account-menu"
                  className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <div className="break-words border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {user.displayName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                    <p className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      Target band: {user.targetBand ?? "Not set"}
                    </p>
                  </div>
                  <div className="p-1.5" onClick={() => setMenu(null)}>
                    <Link className={`${link} text-slate-700 hover:bg-slate-50`} to="/dashboard">
                      Account overview
                    </Link>
                    {user.roles.includes("INSTRUCTOR") && (
                      <Link className={`${link} text-slate-700 hover:bg-slate-50`} to="/teacher/reviews">
                        Instructor reviews
                      </Link>
                    )}
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
            <div className="flex gap-3 text-sm font-semibold">
              <Link
                className="rounded-lg px-2 py-2 text-blue-700 focus-visible:outline"
                to="/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-lg bg-blue-600 px-3 py-2 text-white focus-visible:outline"
                to="/register"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
        {menu === "mobile" && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile student navigation"
            className="w-full border-t border-slate-100 pt-2 xl:hidden"
          >
            {navigation()}
          </nav>
        )}
      </div>
    </header>
  );
}
