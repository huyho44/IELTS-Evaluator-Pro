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
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <Link
                to="/courses"
                className="text-sm font-semibold text-blue-600 hover:underline"
            >
                ← Back to courses
            </Link>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl font-bold">My practice attempts</h1>

                {!accessToken ? (
                    <p className="mt-4 text-sm text-slate-600">
                        Sign in to view your practice history.
                    </p>
                ) : loading ? (
                    <p role="status" className="mt-4 text-sm text-slate-500">
                        Loading history...
                    </p>
                ) : error ? (
                    <div className="mt-4">
                        <p role="alert" className="text-sm text-red-700">
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            className="mt-3 font-semibold text-blue-600 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : entries.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                        No practice attempts yet.
                    </p>
                ) : (
                    <>
                        <p className="mt-3 text-sm text-slate-500">
                            Up to 100 recent attempts for your signed-in account.
                        </p>

                        <ul className="mt-5 space-y-4">
                            {entries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <h2 className="font-semibold">Attempt {entry.attemptNo}</h2>
                                            <AttemptStatusBadge status={entry.status} />
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                            <span>Started: {new Date(entry.startedAt).toLocaleString()}</span>
                                            <span>Submissions: {entry.submissionRevisions.length}</span>
                                        </div>
                                    </div><Link
                                        to={`/attempts/${encodeURIComponent(entry.id)}`}
                                        className="inline-flex shrink-0 justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-600"
                                    >
                                        Open attempt →
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </main>
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