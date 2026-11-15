import type { ReactNode } from "react";

export default function AdminSection({
  title,
  description,
  loading,
  error,
  message,
  reload,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string;
  message: string;
  reload: () => void;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-7 sm:px-8">
      <header className="border-b border-violet-100 pb-5">
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}{" "}
          <button type="button" className="ml-2 underline" onClick={reload}>
            Reload
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm font-semibold text-emerald-800">
          {message}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {children}
    </main>
  );
}
