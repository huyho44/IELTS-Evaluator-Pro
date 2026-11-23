import type { ReactNode } from "react";
import Icon from "../../components/ui/Icon";
import Spinner from "../../components/ui/Spinner";

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
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            disabled={loading}
            onClick={reload}
            className="ui-btn-secondary"
          >
            {loading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Icon name="repeat" size={16} className="text-slate-500" />
            )}
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
            className="min-h-9 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100"
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
          className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-2xs"
        >
          <Spinner className="h-4 w-4" />
          Loading latest records…
        </div>
      )}
      {children}
    </main>
  );
}
