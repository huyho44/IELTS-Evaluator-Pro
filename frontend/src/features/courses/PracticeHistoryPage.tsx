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
                                    className="rounded-lg border border-slate-200 p-4"
                                >
                                    <h2 className="font-semibold">
                                        Attempt {entry.attemptNo}
                                    </h2>

                                    <p className="mt-2 text-sm text-slate-600">
                                        Status: {entry.status.replaceAll("_", " ")}
                                    </p>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Started: {new Date(entry.startedAt).toLocaleString()}
                                    </p>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Submissions: {entry.submissionRevisions.length}
                                    </p>

                                    <Link
                                        to={`/attempts/${encodeURIComponent(entry.id)}`}
                                        className="mt-3 inline-block font-semibold text-blue-600 hover:underline"
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