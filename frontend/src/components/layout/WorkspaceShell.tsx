import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import WorkspaceLinks from "../../features/auth/components/WorkspaceLinks";
import { useSession } from "../../features/auth/session";
import {
  formatUnreadBadge,
  useNotifications,
} from "../../features/management/notificationsStore";
import Icon, { type IconName } from "../ui/Icon";
import Logo from "../ui/Logo";

export type ShellNavItem = {
  to: string;
  label: string;
  subtitle?: string;
  icon: IconName;
  /** Only active on an exact path match. */
  end?: boolean;
};

export type ShellNavGroup = { label: string; items: ShellNavItem[] };

export type WorkspaceShellProps = {
  workspace: "instructor" | "admin";
  /** Caption under the logo and first breadcrumb segment. */
  caption: string;
  homeTo: string;
  /** Prefix for the shared account pages, e.g. "/teacher". */
  accountBase: string;
  currentRole: "INSTRUCTOR" | "ADMIN";
  roleLabel: string;
  groups: ShellNavGroup[];
  labels: {
    nav: string;
    openMenu: string;
    closeMenu: string;
    accountMenu: string;
  };
  children: ReactNode;
};

const ACCOUNT_TITLES: Array<[string, string]> = [
  ["/profile", "Profile"],
  ["/notifications", "Notifications"],
  ["/dashboard", "Account overview"],
];

function isActivePath(pathname: string, item: ShellNavItem) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function SidebarNav({
  groups,
  accountBase,
  currentRole,
  roles,
  navLabel,
  unreadBadge,
  onNavigate,
}: {
  groups: ShellNavGroup[];
  accountBase: string;
  currentRole: string;
  roles: readonly string[];
  navLabel: string;
  unreadBadge: string | null;
  onNavigate?: () => void;
}) {
  const hasOtherWorkspaces = roles.some(
    (role) => role !== currentRole && ["ADMIN", "INSTRUCTOR", "LEARNER"].includes(role),
  );
  const accountItems: ShellNavItem[] = [
    { to: `${accountBase}/dashboard`, label: "Account overview", icon: "layout" },
    { to: `${accountBase}/profile`, label: "Profile", icon: "user" },
    { to: `${accountBase}/notifications`, label: "Notifications", icon: "bell" },
  ];

  const renderItem = (item: ShellNavItem, compact = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
          compact ? "min-h-10 py-2" : "min-h-11 py-2.5"
        } ${
          isActive
            ? "bg-brand-50 font-semibold text-brand-900"
            : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-600"
            />
          )}
          <Icon
            name={item.icon}
            size={18}
            className={
              isActive
                ? "shrink-0 text-brand-600"
                : "shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
            }
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate leading-tight">{item.label}</span>
            {item.subtitle && (
              <span
                className={`mt-0.5 block truncate text-xs font-normal ${
                  isActive ? "text-brand-700/80" : "text-slate-500"
                }`}
              >
                {item.subtitle}
              </span>
            )}
          </span>
          {item.icon === "bell" && unreadBadge && (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
              {unreadBadge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <nav aria-label={navLabel} className="flex flex-col gap-6 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {group.label}
          </p>
          {group.items.map((item) => renderItem(item))}
        </div>
      ))}
      <div className="space-y-0.5 border-t border-slate-200/80 pt-5">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Account
        </p>
        {accountItems.map((item) => renderItem(item, true))}
      </div>
      {hasOtherWorkspaces && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2">
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Switch workspace
          </p>
          <WorkspaceLinks
            roles={roles}
            currentRole={currentRole}
            onNavigate={onNavigate}
            className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white hover:text-slate-900"
          />
        </div>
      )}
    </nav>
  );
}

export default function WorkspaceShell({
  workspace,
  caption,
  homeTo,
  accountBase,
  currentRole,
  roleLabel,
  groups,
  labels,
  children,
}: WorkspaceShellProps) {
  const { session } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const user = session?.user;
  const roles = user?.roles ?? [];
  const { items: notifications } = useNotifications(user?.id);
  const unread = formatUnreadBadge(notifications);
  const unreadBadge = unread.count > 0 ? unread.badgeText : null;

  const activeItem = groups
    .flatMap((group) => group.items)
    .filter((item) => isActivePath(pathname, item))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const pageTitle =
    activeItem?.label ??
    ACCOUNT_TITLES.find(([suffix]) => pathname.includes(suffix))?.[1] ??
    "Account";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      setMobileOpen((open) => {
        if (open) menuButtonRef.current?.focus();
        return false;
      });
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    drawerCloseRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const closeDrawer = () => setMobileOpen(false);
  const initial = (user?.displayName ?? caption).charAt(0).toUpperCase();

  return (
    <div data-workspace={workspace} className="min-h-screen bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-[17rem] shrink-0 border-r border-slate-200/80 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200/80 px-5">
          <Link
            to={homeTo}
            className="min-w-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
          >
            <Logo caption={caption} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            groups={groups}
            accountBase={accountBase}
            currentRole={currentRole}
            roles={roles}
            navLabel={labels.nav}
            unreadBadge={unreadBadge}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={labels.nav}
        >
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] animate-slide-in-left flex-col overflow-y-auto bg-white shadow-popover">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 pl-5 pr-3">
              <Logo caption={caption} />
              <button
                ref={drawerCloseRef}
                type="button"
                aria-label={labels.closeMenu}
                onClick={closeDrawer}
                className="ui-icon-btn"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <SidebarNav
              groups={groups}
              accountBase={accountBase}
              currentRole={currentRole}
              roles={roles}
              navLabel={`${labels.nav} (mobile)`}
              unreadBadge={unreadBadge}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md backdrop-saturate-150 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={labels.openMenu}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="ui-icon-btn -ml-2 lg:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden shrink-0 font-medium text-slate-500 sm:block">
                  {caption}
                </li>
                <li aria-hidden="true" className="hidden text-slate-300 sm:block">
                  <Icon name="chevronRight" size={14} />
                </li>
                <li
                  aria-current="page"
                  className="truncate text-base font-semibold text-slate-900"
                >
                  {pageTitle}
                </li>
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to={`${accountBase}/notifications`}
              aria-label={
                unreadBadge ? `Notifications (${unread.summaryText})` : "Notifications"
              }
              className="ui-icon-btn"
            >
              <Icon name="bell" size={19} />
              {unreadBadge && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
                >
                  {unreadBadge}
                </span>
              )}
            </Link>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label={labels.accountMenu}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
                className={`flex min-h-10 items-center gap-2.5 rounded-xl py-1 pl-1 pr-1 text-left transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 sm:pr-2.5 ${
                  accountOpen ? "bg-slate-100" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white"
                >
                  {initial}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-[150px] truncate text-sm font-semibold leading-tight text-slate-900">
                    {user?.displayName ?? caption}
                  </span>
                  <span className="block text-xs font-medium leading-tight text-slate-500">
                    {roleLabel}
                  </span>
                </span>
                <Icon
                  name="chevronDown"
                  size={16}
                  className={`hidden text-slate-400 transition-transform sm:block ${
                    accountOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountOpen && (
                <div className="ui-menu absolute right-0 top-full mt-2 w-72">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white"
                    >
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user?.displayName ?? caption}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user?.email ?? ""}</p>
                    </div>
                  </div>
                  <div className="p-1.5" onClick={() => setAccountOpen(false)}>
                    <Link to={`${accountBase}/dashboard`} className="ui-menu-item">
                      <Icon name="layout" size={17} className="text-slate-400" />
                      Account overview
                    </Link>
                    <Link to={`${accountBase}/profile`} className="ui-menu-item">
                      <Icon name="user" size={17} className="text-slate-400" />
                      Profile
                    </Link>
                    <Link to={`${accountBase}/notifications`} className="ui-menu-item">
                      <Icon name="bell" size={17} className="text-slate-400" />
                      <span className="flex-1">Notifications</span>
                      {unreadBadge && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 tabular-nums">
                          {unreadBadge}
                        </span>
                      )}
                    </Link>
                    <WorkspaceLinks
                      roles={roles}
                      currentRole={currentRole}
                      className="ui-menu-item"
                    />
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate("/logout");
                      }}
                      className="ui-menu-item text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Icon name="logOut" size={17} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
