import { useEffect, useState } from "react";
import {
  getPracticeAssessments,
  PracticeApiError,
  type PracticeAssessment,
} from "./practiceApi";

type Props = {
  submissionId: string;
  accessToken: string;
  onSessionExpired?: () => void;
};

export default function PracticeAssessmentPanel({
  submissionId,
  accessToken,
  onSessionExpired,
}: Props) {
  const [results, setResults] = useState<PracticeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getPracticeAssessments(
          submissionId,
          accessToken,
          controller.signal,
        );

        if (!controller.signal.aborted) setResults(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your result.",
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
  }, [submissionId, accessToken, onSessionExpired, reloadKey]);

  return (
    <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h3 className="text-lg font-semibold text-slate-900">
        Reading result
      </h3>

      {loading ? (
        <p role="status" className="mt-3 text-sm text-slate-600">
          Loading result...
        </p>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : results.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          No Reading result is available to view yet. Grading may still be
          processing, or the result may be awaiting release.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {results.map((result) => (
            <li key={result.id}>
              <p className="text-xs font-semibold text-blue-700">
                {result.isOfficial ? "Official result" : "Result"}
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {result.rawScore}
                <span className="text-lg font-medium text-slate-500">
                  {" "}/ {result.maxScore}
                </span>
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Raw marks for this exercise, not an IELTS band score.
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={() => setReloadKey((value) => value + 1)}
        className="mt-4 text-sm font-semibold text-blue-700 hover:underline disabled:opacity-50"
      >
        Refresh result
      </button>
    </section>
  );
}
