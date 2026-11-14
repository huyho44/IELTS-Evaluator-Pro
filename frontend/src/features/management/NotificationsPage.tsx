import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import { panel } from "./managementApi";
import {
  formatUnreadBadge,
  isInternalNavigationPath,
  loadNotifications,
  markNotificationRead,
  useNotifications,
} from "./notificationsStore";

export default function NotificationsPage() {
  const { session } = useSession();
  const { items, loading, error, markingIds } = useNotifications(
    session?.user.id,
  );
  const unread = formatUnreadBadge(items);
  const isMarkingAny = Object.keys(markingIds).length > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-[#0f172a]">Notifications</h1>
          {session && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                unread.count > 0
                  ? "bg-blue-50 text-[#1e40af]"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {unread.summaryText}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={loading || isMarkingAny}
          onClick={() => void loadNotifications()}
          className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && (
        <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <p role="status" className="text-sm text-slate-600">
          Loading notifications...
        </p>
      )}
      {!loading && !error && !items.length && (
        <p className={panel}>No notifications yet.</p>
      )}
      {items.map((notification) => {
        const unreadItem = !notification.readAt;
        const marking = Boolean(markingIds[notification.id]);
        return (
          <article
            key={notification.id}
            className={`${panel} ${
              unreadItem ? "border-blue-300 bg-blue-50/30" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {unreadItem && (
                  <span className="inline-flex items-center rounded-full bg-[#2563eb] px-2 py-0.5 text-[11px] font-semibold text-white">
                    Unread
                  </span>
                )}
                <h2 className="font-bold text-[#0f172a]">
                  {notification.title}
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(notification.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {notification.body}
            </p>
            <div className="flex flex-wrap gap-4">
              {isInternalNavigationPath(notification.navigationPath) && (
                <Link
                  className="text-sm font-semibold text-blue-600 hover:underline"
                  to={notification.navigationPath}
                  onClick={() => {
                    if (unreadItem) void markNotificationRead(notification.id);
                  }}
                >
                  Open
                </Link>
              )}
              {unreadItem && (
                <button
                  type="button"
                  disabled={marking}
                  className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                  onClick={() => void markNotificationRead(notification.id)}
                >
                  {marking ? "Marking..." : "Mark as read"}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </main>
  );
}
