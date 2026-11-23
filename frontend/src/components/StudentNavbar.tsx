import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/session";
import {
  formatNotificationContext,
  formatUnreadBadge,
  getNotificationActionLabel,
  isInternalNavigationPath,
  loadNotifications,
  markNotificationRead,
  useNotifications,
} from "../features/management/notificationsStore";
import Icon from "./ui/Icon";
import Logo from "./ui/Logo";

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
  const {
    items: notifications,
    loading: notificationsLoading,
    error: notificationsError,
    markingIds,
  } = useNotifications(user?.id);
  const unread = formatUnreadBadge(notifications);
  const recentNotifications = notifications.slice(0, 4);

  const learning = /^\/(learning|skills|recommendations)(\/|$)/.test(
    location.pathname,
  );
  const practice = /^\/practice-history(\/|$)/.test(location.pathname);
  const courses = !learning && /^\/courses(\/|$)/.test(location.pathname);
  const hasTargetBand =
    user != null &&
    user.targetBand != null &&
    user.roles.includes("LEARNER");

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

  const link = "ui-menu-item";

  function toggle(
    value: "mobile" | "notifications" | "account",
    button: HTMLButtonElement,
  ) {
    trigger.current = button;
    const opening = menu !== value;
    setMenu((previous) => (previous === value ? null : value));
    if (value === "notifications" && opening && user) {
      void loadNotifications();
    }
  }

  function navigation(mobile = false) {
    const tab = (active: boolean) =>
      mobile
        ? `flex min-h-11 items-center rounded-xl px-3 py-2 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`
        : `flex min-h-10 items-center whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`;
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
        {user?.roles.includes("LEARNER") && (
          <Link
            to="/practice-history"
            aria-current={practice ? "page" : undefined}
            className={tab(practice)}
            onClick={() => setMenu(null)}
          >
            My Practice Attempts
          </Link>
        )}
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
    <header
      ref={root}
      className="student-navbar-surface sticky top-0 z-30 border-b border-slate-200/80"
    >
      <div className="relative mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/courses"
          onClick={() => setMenu(null)}
          aria-label="IELTS Evaluator Pro, go to courses"
          className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
        >
          <Logo className="hidden sm:flex" />
          <Logo compact className="sm:hidden" />
        </Link>
        <nav
          aria-label="Student navigation"
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
        >
          {navigation()}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex items-center self-stretch sm:relative">
            <button
              type="button"
              aria-label={
                user && unread.count > 0
                  ? `Notifications (${unread.summaryText})`
                  : "Notifications"
              }
              aria-expanded={menu === "notifications"}
              aria-controls="notifications-panel"
              onClick={(e) => toggle("notifications", e.currentTarget)}
              className={`ui-icon-btn ${menu === "notifications" ? "bg-slate-100 text-slate-900" : ""}`}
            >
              <Icon name="bell" size={19} />
              {user && unread.count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
                >
                  {unread.badgeText}
                </span>
              )}
            </button>
            {menu === "notifications" && (
              <div
                id="notifications-panel"
                className="ui-menu absolute right-4 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden sm:right-0 sm:w-96"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Notifications
                  </h2>
                  {user && (
                    <span className="text-xs font-medium text-slate-500">
                      {unread.summaryText}
                    </span>
                  )}
                </div>
                {!user ? (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    <Link
                      to="/login"
                      onClick={() => setMenu(null)}
                      className="font-semibold text-brand-600 hover:underline"
                    >
                      Sign in to view notifications
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      {notificationsLoading && !recentNotifications.length && (
                        <p role="status" className="px-4 py-4 text-xs text-slate-500">
                          Loading notifications...
                        </p>
                      )}
                      {notificationsError && (
                        <div role="alert" className="space-y-1.5 px-4 py-3 text-xs text-red-700">
                          <p>{notificationsError}</p>
                          <button
                            type="button"
                            onClick={() => void loadNotifications()}
                            className="font-semibold underline"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                      {!notificationsLoading &&
                        !notificationsError &&
                        !recentNotifications.length && (
                          <p className="px-4 py-5 text-center text-xs text-slate-500">
                            No notifications yet.
                          </p>
                        )}
                      {recentNotifications.map((item) => {
                        const isUnread = !item.readAt;
                        const marking = Boolean(markingIds[item.id]);
                        const contextLabel = formatNotificationContext(item);
                        const actionLabel = getNotificationActionLabel(item);
                        return (
                          <div
                            key={item.id}
                            className={`space-y-1.5 px-4 py-3 text-xs ${
                              isUnread ? "bg-brand-50/60" : "bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                {isUnread && (
                                  <span
                                    aria-label="Unread notification"
                                    className="h-2 w-2 shrink-0 rounded-full bg-brand-600"
                                  />
                                )}
                                <p
                                  className={`truncate text-sm ${
                                    isUnread
                                      ? "font-semibold text-slate-900"
                                      : "font-medium text-slate-700"
                                  }`}
                                >
                                  {item.title}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] text-slate-500">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {contextLabel && (
                              <p className="truncate text-[11px] font-semibold text-brand-800">
                                {contextLabel}
                              </p>
                            )}
                            <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                              {item.body}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 pt-0.5">
                              {isInternalNavigationPath(item.navigationPath) && (
                                <Link
                                  to={item.navigationPath}
                                  onClick={() => {
                                    setMenu(null);
                                    if (isUnread) {
                                      void markNotificationRead(item.id);
                                    }
                                  }}
                                  className="font-semibold text-brand-600 hover:underline"
                                >
                                  {actionLabel} →
                                </Link>
                              )}
                              {isUnread && (
                                <button
                                  type="button"
                                  disabled={marking}
                                  onClick={() => void markNotificationRead(item.id)}
                                  className="font-medium text-slate-600 hover:text-brand-600 hover:underline disabled:opacity-50"
                                >
                                  {marking ? "Marking..." : "Mark as read"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                      <Link
                        to="/student/notifications"
                        onClick={() => setMenu(null)}
                        className="flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {user ? (
            <div className="flex min-w-0 items-center self-stretch sm:relative">
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={menu === "account"}
                aria-controls="account-menu"
                onClick={(e) => toggle("account", e.currentTarget)}
                className={`flex min-h-10 max-w-[160px] items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 sm:max-w-[260px] sm:pr-2.5 ${menu === "account" ? "bg-slate-100" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white"
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="hidden max-w-[140px] truncate text-sm font-semibold text-slate-900 sm:block">
                    {user.displayName}
                  </span>
                  {hasTargetBand && (
                    <span className="mt-0.5 hidden text-xs font-medium text-amber-700 sm:block">
                      Target band {user.targetBand}
                    </span>
                  )}
                </span>
              </button>
              {menu === "account" && (
                <div
                  id="account-menu"
                  className="ui-menu absolute right-4 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] sm:right-0"
                >
                  <div className="break-words border-b border-slate-100 px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {user.displayName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                    {hasTargetBand && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Target band: {user.targetBand}
                      </p>
                    )}
                  </div>
                  <div className="p-1.5" onClick={() => setMenu(null)}>
                    <Link
                      className={link}
                      to="/student/profile"
                    >
                      Profile & learning goals
                    </Link>
                    <Link
                      className={link}
                      to="/student/dashboard"
                    >
                      Account overview
                    </Link>
                    {user.roles.includes("INSTRUCTOR") && (
                      <Link
                        className={link}
                        to="/teacher/reviews"
                      >
                        Instructor reviews
                      </Link>
                    )}
                    {user.roles.includes("ADMIN") && (
                      <Link
                        className={link}
                        to="/admin"
                      >
                        Administration
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      className={`${link} text-red-600 hover:bg-red-50 hover:text-red-700`}
                      onClick={() => {
                        setMenu(null);
                        navigate("/logout");
                      }}
                    >
                      <Icon name="logOut" size={17} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold sm:gap-3">
              <Link
                className="ui-btn-ghost px-3"
                to="/login"
              >
                Sign in
              </Link>
              <Link
                className="ui-btn-primary px-3.5"
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
            className={`ui-icon-btn lg:hidden ${menu === "mobile" ? "bg-slate-100 text-slate-900" : ""}`}
            onClick={(e) => toggle("mobile", e.currentTarget)}
          >
            <Icon name={menu === "mobile" ? "close" : "menu"} size={20} />
          </button>
        </div>
        {menu === "mobile" && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile student navigation"
            className="absolute inset-x-0 top-full flex animate-pop-in flex-col gap-1 border-b border-slate-200/80 bg-white px-3 py-3 shadow-raised lg:hidden"
          >
            {navigation(true)}
          </nav>
        )}
      </div>
    </header>
  );
}
