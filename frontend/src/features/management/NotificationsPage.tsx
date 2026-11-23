import { Link, useLocation } from "react-router-dom";
import { useSession } from "../auth/session";
import {
  formatNotificationContext,
  formatUnreadBadge,
  getNotificationActionLabel,
  isInternalNavigationPath,
  loadNotifications,
  markNotificationRead,
  useNotifications,
} from "./notificationsStore";
import { getWorkspaceTheme, type WorkspaceTheme } from "./workspaceTheme";

function NotificationTypeIcon({
  isAssessment,
  unread,
  theme,
}: {
  isAssessment: boolean;
  unread: boolean;
  theme: WorkspaceTheme;
}) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        unread ? theme.chipBadge : "bg-slate-100 text-slate-500"
      }`}
    >
      {isAssessment ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ) : (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      )}
    </span>
  );
}

export default function NotificationsPage({ student = true }: { student?: boolean }) {
  const { session } = useSession();
  const { pathname } = useLocation();
  const theme = getWorkspaceTheme(pathname, student);
  const { items, loading, error, markingIds } = useNotifications(
    session?.user.id,
  );
  const unread = formatUnreadBadge(items);
  const isMarkingAny = Object.keys(markingIds).length > 0;

  return (
    <div className={student ? "student-surface-overview min-h-[calc(100vh-4rem)]" : undefined}>
      <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
        <div
          className={`flex flex-wrap items-end justify-between gap-3 border-b pb-4 ${theme.sectionBorder}`}
        >
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${theme.eyebrowText}`}
            >
              Inbox
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900">
                Notifications
              </h1>
              {session && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    unread.count > 0
                      ? theme.unreadBadge
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {unread.summaryText}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={loading || isMarkingAny}
            onClick={() => void loadNotifications()}
            className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold shadow-2xs transition-colors disabled:opacity-50 ${theme.outlineButton}`}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              disabled={loading || isMarkingAny}
              onClick={() => void loadNotifications()}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading && !items.length && (
          <p
            role="status"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600 shadow-sm"
          >
            Loading notifications...
          </p>
        )}

        {!loading && !error && !items.length && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              No notifications yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {student
                ? "Updates on your published assessments and practice activities will appear here."
                : "Workspace notifications and activity updates will appear here."}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {items.map((notification) => {
              const unreadItem = !notification.readAt;
              const marking = Boolean(markingIds[notification.id]);
              const isAssessment =
                notification.notificationType === "ASSESSMENT_PUBLISHED" ||
                Boolean(notification.navigationPath?.startsWith("/submissions/"));
              const contextLabel = formatNotificationContext(notification);
              const actionLabel = getNotificationActionLabel(notification);

              return (
                <article
                  key={notification.id}
                  className={`border-l-4 px-4 py-4 transition-colors sm:px-6 ${
                    unreadItem
                      ? theme.unreadCardBorder
                      : "border-l-transparent bg-white hover:bg-slate-50/75"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <NotificationTypeIcon
                        isAssessment={isAssessment}
                        unread={unreadItem}
                        theme={theme}
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {unreadItem && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.avatarBadge}`}
                            >
                              New
                            </span>
                          )}
                          <h2
                            className={`text-sm sm:text-base ${
                              unreadItem
                                ? "font-bold text-slate-900"
                                : "font-semibold text-slate-700"
                            }`}
                          >
                            {notification.title}
                          </h2>
                        </div>

                        {contextLabel && (
                          <p
                            className={`text-xs font-semibold ${
                              unreadItem ? theme.accentSummary : "text-slate-600"
                            }`}
                          >
                            {contextLabel}
                          </p>
                        )}

                        <p
                          className={`whitespace-pre-wrap text-sm leading-6 ${
                            unreadItem ? "text-slate-700" : "text-slate-500"
                          }`}
                        >
                          {notification.body}
                        </p>

                        <p className="text-xs text-slate-400">
                          {new Date(notification.createdAt).toLocaleString()}
                          {!unreadItem && notification.readAt
                            ? ` · Read ${new Date(notification.readAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2.5 pl-12 sm:flex-col sm:items-end sm:pl-0">
                      {isInternalNavigationPath(notification.navigationPath) && (
                        <Link
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            unreadItem
                              ? `${theme.primaryButton} shadow-2xs`
                              : `border ${theme.outlineButton}`
                          }`}
                          to={notification.navigationPath}
                          onClick={() => {
                            if (unreadItem) {
                              void markNotificationRead(notification.id);
                            }
                          }}
                        >
                          <span>{actionLabel}</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      )}
                      {unreadItem && (
                        <button
                          type="button"
                          disabled={marking}
                          className={`text-xs font-medium text-slate-600 hover:underline disabled:opacity-50 ${theme.accentLink}`}
                          onClick={() =>
                            void markNotificationRead(notification.id)
                          }
                        >
                          {marking ? "Marking..." : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
