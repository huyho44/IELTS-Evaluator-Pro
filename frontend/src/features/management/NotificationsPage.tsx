import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import {
  managementRequest as request,
  managementError,
  panel,
} from "./managementApi";

type Notification = {
  id: string;
  title: string;
  body: string;
  navigationPath: string | null;
  readAt: string | null;
  createdAt: string;
};
export default function NotificationsPage() {
  const { session } = useSession();
  return <Content key={session?.user.id} />;
}
function Content() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [refresh, setRefresh] = useState(0);
  const action = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await request<Notification[]>("GET", "/notifications");
        if (!Array.isArray(data))
          throw new Error("The notifications response could not be verified.");
        if (active) setItems(data);
      } catch (cause) {
        if (active) setError(managementError(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refresh]);
  async function read(id: string) {
    if (action.current) return;
    action.current = true;
    setBusy(id);
    setError("");
    try {
      const updated = await request<Notification>(
        "POST",
        `/notifications/${encodeURIComponent(id)}/read`,
      );
      setItems((previous) =>
        previous.map((notification) =>
          notification.id === id ? updated : notification,
        ),
      );
    } catch (cause) {
      setError(managementError(cause));
    } finally {
      action.current = false;
      setBusy("");
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          disabled={loading || !!busy}
          onClick={() => setRefresh((value) => value + 1)}
          className="text-sm font-semibold text-blue-600"
        >
          Refresh
        </button>
      </div>
      {error && (
        <div role="alert" className="space-y-2 text-red-700">
          <p>{error}</p>
          <button
            disabled={loading || !!busy}
            onClick={() => setRefresh((value) => value + 1)}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      {loading && <p role="status">Loading notifications...</p>}
      {!loading && !error && !items.length && (
        <p className={panel}>No notifications yet.</p>
      )}
      {items.map((notification) => (
        <article
          key={notification.id}
          className={`${panel} ${notification.readAt ? "" : "border-blue-300"}`}
        >
          <div className="flex justify-between gap-3">
            <h2 className="font-bold">{notification.title}</h2>
            <span className="text-xs text-slate-500">
              {new Date(notification.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {notification.body}
          </p>
          <div className="flex gap-4">
            {notification.navigationPath?.startsWith("/") &&
              !notification.navigationPath.startsWith("//") &&
              !notification.navigationPath.includes("\\") && (
                <Link
                  className="text-sm font-semibold text-blue-600"
                  to={notification.navigationPath}
                  onClick={() => void read(notification.id)}
                >
                  Open
                </Link>
              )}
            {!notification.readAt && (
              <button
                disabled={!!busy}
                className="text-sm text-blue-600"
                onClick={() => void read(notification.id)}
              >
                Mark as read
              </button>
            )}
          </div>
        </article>
      ))}
    </main>
  );
}
