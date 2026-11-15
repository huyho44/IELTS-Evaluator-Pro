import type { ReactNode } from "react";

export default function AdminSection({
  title,
  description,
  loading,
  error,
  message,
  reload,
  actions,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string;
  message: string;
  reload: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-8 sm:py-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-violet-100 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Admin Console / {title}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            disabled={loading}
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3.5 py-2 text-xs font-semibold text-violet-900 shadow-2xs transition hover:bg-violet-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
            onClick={reload}
          >
            Reload
          </button>
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          {message}
        </div>
      )}
      {loading && (
        <div
          role="status"
          className="rounded-xl border border-violet-100 bg-white/80 px-4 py-2.5 text-sm text-slate-600"
        >
          Loading latest records…
        </div>
      )}
      {children}
    </main>
  );
}
