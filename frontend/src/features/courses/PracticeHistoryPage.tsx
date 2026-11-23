import AttemptStatusBadge from "./AttemptStatusBadge";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getPracticeHistory,
    PracticeApiError,
    type PracticeHistoryEntry,
} from "./practiceApi";

type Props = {
    accessToken?: string | null;
    onSessionExpired?: () => void;
};

function HistoryContent({ accessToken, onSessionExpired }: Props) {
    const [entries, setEntries] = useState<PracticeHistoryEntry[]>([]);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!accessToken) return;

        const token = accessToken;
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");

            try {
                const data = await getPracticeHistory(token, controller.signal);

                if (!controller.signal.aborted) setEntries(data);
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setError(
                        cause instanceof Error ? cause.message : "Unable to load history.",
                    );

                    if (cause instanceof PracticeApiError && cause.status === 401) {
                        onSessionExpired?.();
                    }
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, [accessToken, onSessionExpired, reloadKey]);

    return (
        <div className="student-surface-overview min-h-[calc(100vh-4rem)]">
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <Link
                to="/courses"
                className="text-sm font-semibold text-brand-600 hover:underline"
            >
                ← Back to courses
            </Link>

            <header className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-5">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        Practice history
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold text-slate-900">
                        My practice attempts
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Up to 100 recent attempts for your signed-in account.
                    </p>
                </div>
                {accessToken && !loading && !error && entries.length > 0 && (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-xs">
                        {entries.length} {entries.length === 1 ? "attempt" : "attempts"}
                    </span>
                )}
            </header>

            {!accessToken ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-600">
                        Sign in to view your practice history.
                    </p>
                </section>
            ) : loading ? (
                <p
                    role="status"
                    className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm"
                >
                    Loading history...
                </p>
            ) : error ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>
                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mt-3 font-semibold text-brand-600 hover:underline"
                    >
                        Try again
                    </button>
                </section>
            ) : entries.length === 0 ? (
                <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                    No practice attempts yet.
                </p>
            ) : (
                <ul className="mt-6 space-y-4">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className={`flex flex-col gap-4 rounded-xl border border-slate-200 border-l-4 ${
                                entry.status === "IN_PROGRESS"
                                    ? "border-l-brand-600"
                                    : "border-l-emerald-500"
                            } bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between`}
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h2 className="text-base font-bold text-slate-900">
                                        Attempt {entry.attemptNo}
                                    </h2>
                                    <AttemptStatusBadge status={entry.status} />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                    <span>Started: {new Date(entry.startedAt).toLocaleString()}</span>
                                    <span>Submissions: {entry.submissionRevisions.length}</span>
                                </div>
                            </div>
                            <Link
                                to={`/attempts/${encodeURIComponent(entry.id)}`}
                                className="inline-flex w-full shrink-0 justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-600 hover:bg-brand-50/50 hover:text-brand-600 sm:w-auto"
                            >
                                Open attempt →
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
        </div>
    );
}

export default function PracticeHistoryPage(props: Props) {
    return (
        <HistoryContent
            key={props.accessToken ?? "signed-out"}
            {...props}
        />
    );
}