import { useCallback, useEffect, useState, type FormEvent } from "react";
import Spinner from "../../components/ui/Spinner";
import { discussionError } from "../discussions/discussionsApi";
import { analyticsApi, type AuditEvent, type AuditFilters } from "./analyticsApi";

const EMPTY: AuditFilters = { action: "", entityType: "", entityKey: "", from: "", to: "" };
const toIso = (local: string | undefined) =>
  local ? new Date(local).toISOString() : undefined;

// A7: admin audit log with filters and "load more" paging.
export default function AuditLogPage() {
  const [draft, setDraft] = useState<AuditFilters>(EMPTY);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State is only set after the request settles, so the initial effect does
  // not trigger a synchronous re-render.
  const fetchPage = useCallback(
    async (next: AuditFilters, after: string | null) => {
      try {
        const page = await analyticsApi.audit(
          { ...next, from: toIso(next.from), to: toIso(next.to) },
          after,
        );
        setEvents((current) => (after ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setError("");
      } catch (cause) {
        setError(discussionError(cause, "Unable to load the audit log."));
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  const load = (next: AuditFilters, after: string | null) => {
    setLoading(true);
    void fetchPage(next, after);
  };

  useEffect(() => {
    let active = true;
    analyticsApi
      .audit(EMPTY)
      .then((page) => {
        if (!active) return;
        setEvents(page.items);
        setCursor(page.nextCursor);
      })
      .catch((cause) => {
        if (active) setError(discussionError(cause, "Unable to load the audit log."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft });
    load(draft, null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="ui-eyebrow">Accountability</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every sensitive change: accounts, roles, grades, content, moderation
          and passwords. Newest first.
        </p>
      </header>
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:grid-cols-2 lg:grid-cols-6"
      >
        {(
          [
            ["action", "Action", "e.g. PASSWORD_RESET", "text"],
            ["entityType", "Entity type", "e.g. Course", "text"],
            ["entityKey", "Entity id", "", "text"],
            ["from", "From", "", "datetime-local"],
            ["to", "To", "", "datetime-local"],
          ] as const
        ).map(([key, label, placeholder, type]) => (
          <label key={key} className="block text-xs font-medium text-slate-700">
            {label}
            <input
              type={type}
              value={draft[key] ?? ""}
              placeholder={placeholder}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              className="ui-input mt-1 text-sm"
            />
          </label>
        ))}
        <div className="flex items-end gap-2">
          <button type="submit" className="ui-btn-primary">
            Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setFilters(EMPTY);
              load(EMPTY, null);
            }}
            className="ui-btn-secondary"
          >
            Clear
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {new Date(event.occurredAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-800">
                  {event.actor ? event.actor.displayName : "System"}
                  {event.actor && (
                    <span className="block text-xs text-slate-400">{event.actor.email}</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-800">
                  {event.action}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {event.entityType}
                  <span className="block break-all font-mono text-slate-400">{event.entityKey}</span>
                </td>
                <td className="px-4 py-2">
                  {event.afterJson != null && (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                        Show
                      </summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                        {JSON.stringify({ before: event.beforeJson, after: event.afterJson }, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && events.length === 0 && !error && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No matching events.</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {loading && (
          <span role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="h-4 w-4 text-brand-600" /> Loading...
          </span>
        )}
        {cursor && !loading && (
          <button type="button" onClick={() => load(filters, cursor)} className="ui-btn-secondary">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
